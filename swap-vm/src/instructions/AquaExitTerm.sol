// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { Calldata } from "@1inch/solidity-utils/contracts/libraries/Calldata.sol";
import { Context } from "../libs/VM.sol";
import { IPriceOracle } from "./interfaces/IPriceOracle.sol";

library AquaExitTermArgsBuilder {
    using Calldata for bytes;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant YEAR = 365 days;

    error AquaExitTermBaseDiscountTooHigh(uint32 baseDiscountBps);
    error AquaExitTermAnnualRateTooHigh(uint32 annualRateBps);
    error AquaExitTermMaxDiscountTooHigh(uint32 maxDiscountBps);
    error AquaExitTermMissingBaseDiscountArg();
    error AquaExitTermMissingAnnualRateArg();
    error AquaExitTermMissingMaxDiscountArg();
    error AquaExitTermMissingMaturityArg();
    error AquaExitTermMissingMaxStalenessArg();
    error AquaExitTermMissingTokenInDecimalsArg();
    error AquaExitTermMissingTokenOutDecimalsArg();
    error AquaExitTermMissingOracleDecimalsArg();
    error AquaExitTermMissingOracleAddressArg();
    error AquaExitTermTokenDecimalsTooHigh(uint8 decimals);

    /// @param baseDiscountBps Fixed maker spread in basis points.
    /// @param annualRateBps Annualized duration discount in basis points.
    /// @param maxDiscountBps Maximum total discount accepted by the maker.
    /// @param maturity Timestamp when the delayed-redemption asset is expected to redeem.
    /// @param maxStaleness Maximum oracle staleness in seconds; zero disables the check.
    /// @param tokenInDecimals Decimals for the delayed-redemption asset.
    /// @param tokenOutDecimals Decimals for the liquid quote token.
    /// @param oracleDecimals Decimals for oracle answer; zero fetches decimals from the oracle.
    /// @param oracleAddress Oracle returning tokenOut whole units per one tokenIn whole unit.
    function build(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness,
        uint8 tokenInDecimals,
        uint8 tokenOutDecimals,
        uint8 oracleDecimals,
        address oracleAddress
    ) internal pure returns (bytes memory) {
        require(baseDiscountBps < BPS, AquaExitTermBaseDiscountTooHigh(baseDiscountBps));
        require(annualRateBps < BPS, AquaExitTermAnnualRateTooHigh(annualRateBps));
        require(maxDiscountBps < BPS, AquaExitTermMaxDiscountTooHigh(maxDiscountBps));
        require(tokenInDecimals <= 36, AquaExitTermTokenDecimalsTooHigh(tokenInDecimals));
        require(tokenOutDecimals <= 36, AquaExitTermTokenDecimalsTooHigh(tokenOutDecimals));

        return abi.encodePacked(
            baseDiscountBps,
            annualRateBps,
            maxDiscountBps,
            maturity,
            maxStaleness,
            tokenInDecimals,
            tokenOutDecimals,
            oracleDecimals,
            oracleAddress
        );
    }

    function parse(bytes calldata args) internal pure returns (
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness,
        uint8 tokenInDecimals,
        uint8 tokenOutDecimals,
        uint8 oracleDecimals,
        address oracleAddress
    ) {
        baseDiscountBps = uint32(bytes4(args.slice(0, 4, AquaExitTermMissingBaseDiscountArg.selector)));
        annualRateBps = uint32(bytes4(args.slice(4, 8, AquaExitTermMissingAnnualRateArg.selector)));
        maxDiscountBps = uint32(bytes4(args.slice(8, 12, AquaExitTermMissingMaxDiscountArg.selector)));
        maturity = uint40(bytes5(args.slice(12, 17, AquaExitTermMissingMaturityArg.selector)));
        maxStaleness = uint32(bytes4(args.slice(17, 21, AquaExitTermMissingMaxStalenessArg.selector)));
        tokenInDecimals = uint8(bytes1(args.slice(21, 22, AquaExitTermMissingTokenInDecimalsArg.selector)));
        tokenOutDecimals = uint8(bytes1(args.slice(22, 23, AquaExitTermMissingTokenOutDecimalsArg.selector)));
        oracleDecimals = uint8(bytes1(args.slice(23, 24, AquaExitTermMissingOracleDecimalsArg.selector)));
        oracleAddress = address(bytes20(args.slice(24, 44, AquaExitTermMissingOracleAddressArg.selector)));
    }
}

/**
 * @notice Term-discount swap instruction for delayed-redemption assets.
 * @dev The oracle price is normalized to 1e18 whole-token units, then converted to
 *      token base units with explicit token decimal arguments.
 */
contract AquaExitTerm {
    using Math for uint256;
    using SafeCast for int256;

    uint256 internal constant _BPS = 10_000;
    uint256 internal constant _YEAR = 365 days;

    error AquaExitTermOraclePriceStale(uint256 currentTime, uint256 updatedAt, uint32 maxStaleness);
    error AquaExitTermDiscountTooHigh(uint256 discountBps, uint32 maxDiscountBps);
    error AquaExitTermDiscountExceedsPar(uint256 discountBps);
    error AquaExitTermRequiresInputAmount();
    error AquaExitTermRequiresOutputAmount();
    error AquaExitTermInsufficientMakerInputCapacity(uint256 amountIn, uint256 balanceIn);
    error AquaExitTermInsufficientMakerOutputLiquidity(uint256 amountOut, uint256 balanceOut);

    /// @param args.baseDiscountBps  | 4 bytes
    /// @param args.annualRateBps    | 4 bytes
    /// @param args.maxDiscountBps   | 4 bytes
    /// @param args.maturity         | 5 bytes
    /// @param args.maxStaleness     | 4 bytes
    /// @param args.tokenInDecimals  | 1 byte
    /// @param args.tokenOutDecimals | 1 byte
    /// @param args.oracleDecimals   | 1 byte
    /// @param args.oracleAddress    | 20 bytes
    function _aquaExitTermSwap1D(Context memory ctx, bytes calldata args) internal view {
        (
            uint32 baseDiscountBps,
            uint32 annualRateBps,
            uint32 maxDiscountBps,
            uint40 maturity,
            uint32 maxStaleness,
            uint8 tokenInDecimals,
            uint8 tokenOutDecimals,
            uint8 oracleDecimals,
            address oracleAddress
        ) = AquaExitTermArgsBuilder.parse(args);

        uint256 price = _oraclePrice1e18(oracleAddress, oracleDecimals, maxStaleness);
        uint256 discountBps = _discountBps(baseDiscountBps, annualRateBps, maturity);

        require(discountBps <= maxDiscountBps, AquaExitTermDiscountTooHigh(discountBps, maxDiscountBps));
        require(discountBps < _BPS, AquaExitTermDiscountExceedsPar(discountBps));

        uint256 payoutFactorBps = _BPS - discountBps;

        if (ctx.query.isExactIn) {
            require(ctx.swap.amountIn > 0, AquaExitTermRequiresInputAmount());
            require(ctx.swap.amountIn <= ctx.swap.balanceIn, AquaExitTermInsufficientMakerInputCapacity(ctx.swap.amountIn, ctx.swap.balanceIn));
            ctx.swap.amountOut = ctx.swap.amountIn * price * (10 ** tokenOutDecimals) * payoutFactorBps / (10 ** tokenInDecimals) / 1e18 / _BPS;
            require(ctx.swap.amountOut <= ctx.swap.balanceOut, AquaExitTermInsufficientMakerOutputLiquidity(ctx.swap.amountOut, ctx.swap.balanceOut));
        } else {
            require(ctx.swap.amountOut > 0, AquaExitTermRequiresOutputAmount());
            require(ctx.swap.amountOut <= ctx.swap.balanceOut, AquaExitTermInsufficientMakerOutputLiquidity(ctx.swap.amountOut, ctx.swap.balanceOut));
            ctx.swap.amountIn = (ctx.swap.amountOut * (10 ** tokenInDecimals) * 1e18 * _BPS).ceilDiv(price * (10 ** tokenOutDecimals) * payoutFactorBps);
            require(ctx.swap.amountIn <= ctx.swap.balanceIn, AquaExitTermInsufficientMakerInputCapacity(ctx.swap.amountIn, ctx.swap.balanceIn));
        }
    }

    function _oraclePrice1e18(
        address oracleAddress,
        uint8 oracleDecimals,
        uint32 maxStaleness
    ) private view returns (uint256 price) {
        IPriceOracle oracle = IPriceOracle(oracleAddress);
        (, int256 answer, , uint256 updatedAt, ) = oracle.latestRoundData();
        require(maxStaleness == 0 || block.timestamp <= updatedAt + maxStaleness, AquaExitTermOraclePriceStale(block.timestamp, updatedAt, maxStaleness));

        if (oracleDecimals == 0) {
            oracleDecimals = oracle.decimals();
        }

        price = answer.toUint256();
        if (oracleDecimals < 18) {
            price *= 10 ** (18 - oracleDecimals);
        } else if (oracleDecimals > 18) {
            price /= 10 ** (oracleDecimals - 18);
        }
    }

    function _discountBps(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint40 maturity
    ) private view returns (uint256) {
        if (block.timestamp >= maturity) {
            return baseDiscountBps;
        }

        uint256 secondsToMaturity = uint256(maturity) - block.timestamp;
        uint256 durationDiscountBps = uint256(annualRateBps) * secondsToMaturity / _YEAR;
        return uint256(baseDiscountBps) + durationDiscountBps;
    }
}
