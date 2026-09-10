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

    struct Args {
        uint32 baseDiscountBps;
        uint32 annualRateBps;
        uint32 maxDiscountBps;
        uint40 maturity;
        uint32 maxStaleness;
        uint8 tokenInDecimals;
        uint8 tokenOutDecimals;
        uint8 oracleDecimals;
        address oracleAddress;
        uint128 maxExposure;
        uint32 inventorySlopeBps;
        uint128 maxNotionalOut;
        uint32 liquiditySlopeBps;
        uint32 riskTierBps;
        uint40 minMaturity;
        uint40 maxMaturity;
        address allowedTokenIn;
        address allowedTokenOut;
    }

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
    error AquaExitTermMissingMaxExposureArg();
    error AquaExitTermMissingInventorySlopeArg();
    error AquaExitTermMissingMaxNotionalOutArg();
    error AquaExitTermMissingLiquiditySlopeArg();
    error AquaExitTermMissingRiskTierArg();
    error AquaExitTermMissingMinMaturityArg();
    error AquaExitTermMissingMaxMaturityArg();
    error AquaExitTermMissingAllowedTokenInArg();
    error AquaExitTermMissingAllowedTokenOutArg();
    error AquaExitTermTokenDecimalsTooHigh(uint8 decimals);
    error AquaExitTermInventorySlopeTooHigh(uint32 inventorySlopeBps);
    error AquaExitTermLiquiditySlopeTooHigh(uint32 liquiditySlopeBps);
    error AquaExitTermRiskTierTooHigh(uint32 riskTierBps);

    /// @param data Encoded term-pricing, market, risk, and maker-limit fields.
    function build(Args memory data) internal pure returns (bytes memory) {
        require(data.baseDiscountBps < BPS, AquaExitTermBaseDiscountTooHigh(data.baseDiscountBps));
        require(data.annualRateBps < BPS, AquaExitTermAnnualRateTooHigh(data.annualRateBps));
        require(data.maxDiscountBps < BPS, AquaExitTermMaxDiscountTooHigh(data.maxDiscountBps));
        require(data.inventorySlopeBps < BPS, AquaExitTermInventorySlopeTooHigh(data.inventorySlopeBps));
        require(data.liquiditySlopeBps < BPS, AquaExitTermLiquiditySlopeTooHigh(data.liquiditySlopeBps));
        require(data.riskTierBps < BPS, AquaExitTermRiskTierTooHigh(data.riskTierBps));
        require(data.tokenInDecimals <= 36, AquaExitTermTokenDecimalsTooHigh(data.tokenInDecimals));
        require(data.tokenOutDecimals <= 36, AquaExitTermTokenDecimalsTooHigh(data.tokenOutDecimals));

        bytes memory market = abi.encodePacked(
            data.baseDiscountBps,
            data.annualRateBps,
            data.maxDiscountBps,
            data.maturity,
            data.maxStaleness,
            data.tokenInDecimals,
            data.tokenOutDecimals,
            data.oracleDecimals,
            data.oracleAddress
        );
        bytes memory makerRisk = abi.encodePacked(
            data.maxExposure,
            data.inventorySlopeBps,
            data.maxNotionalOut,
            data.liquiditySlopeBps,
            data.riskTierBps,
            data.minMaturity,
            data.maxMaturity,
            data.allowedTokenIn,
            data.allowedTokenOut
        );

        return bytes.concat(market, makerRisk);
    }

    function parse(bytes calldata args) internal pure returns (Args memory parsed) {
        parsed.baseDiscountBps = uint32(bytes4(args.slice(0, 4, AquaExitTermMissingBaseDiscountArg.selector)));
        parsed.annualRateBps = uint32(bytes4(args.slice(4, 8, AquaExitTermMissingAnnualRateArg.selector)));
        parsed.maxDiscountBps = uint32(bytes4(args.slice(8, 12, AquaExitTermMissingMaxDiscountArg.selector)));
        parsed.maturity = uint40(bytes5(args.slice(12, 17, AquaExitTermMissingMaturityArg.selector)));
        parsed.maxStaleness = uint32(bytes4(args.slice(17, 21, AquaExitTermMissingMaxStalenessArg.selector)));
        parsed.tokenInDecimals = uint8(bytes1(args.slice(21, 22, AquaExitTermMissingTokenInDecimalsArg.selector)));
        parsed.tokenOutDecimals = uint8(bytes1(args.slice(22, 23, AquaExitTermMissingTokenOutDecimalsArg.selector)));
        parsed.oracleDecimals = uint8(bytes1(args.slice(23, 24, AquaExitTermMissingOracleDecimalsArg.selector)));
        parsed.oracleAddress = address(bytes20(args.slice(24, 44, AquaExitTermMissingOracleAddressArg.selector)));
        parsed.maxExposure = uint128(bytes16(args.slice(44, 60, AquaExitTermMissingMaxExposureArg.selector)));
        parsed.inventorySlopeBps = uint32(bytes4(args.slice(60, 64, AquaExitTermMissingInventorySlopeArg.selector)));
        parsed.maxNotionalOut = uint128(bytes16(args.slice(64, 80, AquaExitTermMissingMaxNotionalOutArg.selector)));
        parsed.liquiditySlopeBps = uint32(bytes4(args.slice(80, 84, AquaExitTermMissingLiquiditySlopeArg.selector)));
        parsed.riskTierBps = uint32(bytes4(args.slice(84, 88, AquaExitTermMissingRiskTierArg.selector)));
        parsed.minMaturity = uint40(bytes5(args.slice(88, 93, AquaExitTermMissingMinMaturityArg.selector)));
        parsed.maxMaturity = uint40(bytes5(args.slice(93, 98, AquaExitTermMissingMaxMaturityArg.selector)));
        parsed.allowedTokenIn = address(bytes20(args.slice(98, 118, AquaExitTermMissingAllowedTokenInArg.selector)));
        parsed.allowedTokenOut = address(bytes20(args.slice(118, 138, AquaExitTermMissingAllowedTokenOutArg.selector)));
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
    error AquaExitTermExposureLimitExceeded(uint256 exposureAfter, uint128 maxExposure);
    error AquaExitTermNotionalLimitExceeded(uint256 notionalAfter, uint128 maxNotionalOut);
    error AquaExitTermTokenNotAllowed(address tokenIn, address tokenOut, address allowedTokenIn, address allowedTokenOut);
    error AquaExitTermMaturityOutOfRange(uint40 maturity, uint40 minMaturity, uint40 maxMaturity);
    error AquaExitTermInsufficientMakerOutputLiquidity(uint256 amountOut, uint256 balanceOut);

    /// @notice Reusable backing/oracle guard for delayed-redemption assets.
    /// @dev Validates asset pair, maturity window, and oracle freshness. It does not
    ///      mutate swap registers, so it can be shared across multiple term curves.
    function _aquaExitBackingOracleCheck(Context memory ctx, bytes calldata args) internal view {
        AquaExitTermArgsBuilder.Args memory parsed = AquaExitTermArgsBuilder.parse(args);

        _checkAllowedMarket(ctx.query.tokenIn, ctx.query.tokenOut, parsed.allowedTokenIn, parsed.allowedTokenOut);
        _checkMaturity(parsed.maturity, parsed.minMaturity, parsed.maxMaturity);
        _oraclePrice1e18(parsed.oracleAddress, parsed.oracleDecimals, parsed.maxStaleness);
    }

    /// @notice Reusable maker exposure/notional guard.
    /// @dev Checks receipt inventory limits before pricing. If an earlier instruction
    ///      has already set amountOut, it also enforces the notional output cap.
    function _aquaExitExposureCap(Context memory ctx, bytes calldata args) internal pure {
        AquaExitTermArgsBuilder.Args memory parsed = AquaExitTermArgsBuilder.parse(args);

        uint256 fillAmount = ctx.query.isExactIn ? ctx.swap.amountIn : 0;
        _checkExposureLimit(ctx.swap.balanceIn, fillAmount, parsed.maxExposure);

        if (ctx.swap.amountOut > 0) {
            _checkNotionalLimit(ctx.swap.amountOut, ctx.swap.balanceOut, parsed.maxNotionalOut);
        }
    }

    /// @notice Reusable maturity/inventory/depth discount curve.
    /// @dev Computes missing swap amount from oracle backing value, term discount,
    ///      maker exposure, risk tier, and output-liquidity depth.
    function _aquaExitDiscountCurve1D(Context memory ctx, bytes calldata args) internal view {
        AquaExitTermArgsBuilder.Args memory parsed = AquaExitTermArgsBuilder.parse(args);

        uint256 price = _oraclePrice1e18(parsed.oracleAddress, parsed.oracleDecimals, parsed.maxStaleness);
        _applyDiscountCurve(ctx, parsed, price);
    }

    function _applyDiscountCurve(
        Context memory ctx,
        AquaExitTermArgsBuilder.Args memory parsed,
        uint256 price
    ) private view {
        if (ctx.query.isExactIn) {
            require(ctx.swap.amountIn > 0, AquaExitTermRequiresInputAmount());
            uint256 discountBps = _checkedDiscountBps(
                parsed.baseDiscountBps,
                parsed.annualRateBps,
                parsed.maturity,
                ctx.swap.balanceIn,
                ctx.swap.amountIn,
                parsed.maxExposure,
                parsed.inventorySlopeBps,
                parsed.riskTierBps,
                parsed.maxDiscountBps
            );
            ctx.swap.amountOut = _amountOutWithDepth(ctx.swap.amountIn, price, parsed.tokenInDecimals, parsed.tokenOutDecimals, discountBps, parsed.liquiditySlopeBps, ctx.swap.balanceOut, parsed.maxDiscountBps);
            _checkNotionalLimit(ctx.swap.amountOut, ctx.swap.balanceOut, parsed.maxNotionalOut);
            require(ctx.swap.amountOut <= ctx.swap.balanceOut, AquaExitTermInsufficientMakerOutputLiquidity(ctx.swap.amountOut, ctx.swap.balanceOut));
        } else {
            require(ctx.swap.amountOut > 0, AquaExitTermRequiresOutputAmount());
            require(ctx.swap.amountOut <= ctx.swap.balanceOut, AquaExitTermInsufficientMakerOutputLiquidity(ctx.swap.amountOut, ctx.swap.balanceOut));
            _checkNotionalLimit(ctx.swap.amountOut, ctx.swap.balanceOut, parsed.maxNotionalOut);
            ctx.swap.amountIn = _amountInWithInventory(
                ctx.swap.amountOut,
                price,
                ctx.swap.balanceIn,
                ctx.swap.balanceOut,
                parsed
            );
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

    function _checkedDiscountBps(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint40 maturity,
        uint256 currentExposure,
        uint256 fillAmount,
        uint128 maxExposure,
        uint32 inventorySlopeBps,
        uint32 riskTierBps,
        uint32 maxDiscountBps
    ) private view returns (uint256 discountBps) {
        uint256 exposureAfter = _checkExposureLimit(currentExposure, fillAmount, maxExposure);

        discountBps = _termDiscountBps(baseDiscountBps, annualRateBps, maturity);
        if (maxExposure > 0 && inventorySlopeBps > 0) {
            discountBps += uint256(inventorySlopeBps) * exposureAfter / maxExposure;
        }
        discountBps += riskTierBps;

        require(discountBps <= maxDiscountBps, AquaExitTermDiscountTooHigh(discountBps, maxDiscountBps));
        require(discountBps < _BPS, AquaExitTermDiscountExceedsPar(discountBps));
    }

    function _checkExposureLimit(
        uint256 currentExposure,
        uint256 fillAmount,
        uint128 maxExposure
    ) private pure returns (uint256 exposureAfter) {
        exposureAfter = currentExposure + fillAmount;
        require(maxExposure == 0 || exposureAfter <= maxExposure, AquaExitTermExposureLimitExceeded(exposureAfter, maxExposure));
    }

    function _termDiscountBps(
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

    function _amountOut(
        uint256 amountIn,
        uint256 price,
        uint8 tokenInDecimals,
        uint8 tokenOutDecimals,
        uint256 discountBps
    ) private pure returns (uint256) {
        return amountIn * price * (10 ** tokenOutDecimals) * (_BPS - discountBps) / (10 ** tokenInDecimals) / 1e18 / _BPS;
    }

    function _amountIn(
        uint256 amountOut,
        uint256 price,
        uint8 tokenInDecimals,
        uint8 tokenOutDecimals,
        uint256 discountBps
    ) private pure returns (uint256) {
        return (amountOut * (10 ** tokenInDecimals) * 1e18 * _BPS).ceilDiv(price * (10 ** tokenOutDecimals) * (_BPS - discountBps));
    }

    function _amountInWithInventory(
        uint256 amountOut,
        uint256 price,
        uint256 currentExposure,
        uint256 balanceOut,
        AquaExitTermArgsBuilder.Args memory parsed
    ) private view returns (uint256 amountIn) {
        uint256 discountBps = _checkedDiscountBps(
            parsed.baseDiscountBps,
            parsed.annualRateBps,
            parsed.maturity,
            currentExposure,
            0,
            parsed.maxExposure,
            parsed.inventorySlopeBps,
            parsed.riskTierBps,
            parsed.maxDiscountBps
        );
        discountBps = _discountWithLiquidityDepth(discountBps, parsed.liquiditySlopeBps, amountOut, balanceOut, parsed.maxDiscountBps);
        amountIn = _amountIn(amountOut, price, parsed.tokenInDecimals, parsed.tokenOutDecimals, discountBps);

        for (uint256 i = 0; i < 3; i++) {
            discountBps = _checkedDiscountBps(
                parsed.baseDiscountBps,
                parsed.annualRateBps,
                parsed.maturity,
                currentExposure,
                amountIn,
                parsed.maxExposure,
                parsed.inventorySlopeBps,
                parsed.riskTierBps,
                parsed.maxDiscountBps
            );
            discountBps = _discountWithLiquidityDepth(discountBps, parsed.liquiditySlopeBps, amountOut, balanceOut, parsed.maxDiscountBps);
            amountIn = _amountIn(amountOut, price, parsed.tokenInDecimals, parsed.tokenOutDecimals, discountBps);
        }
    }

    function _amountOutWithDepth(
        uint256 amountIn,
        uint256 price,
        uint8 tokenInDecimals,
        uint8 tokenOutDecimals,
        uint256 discountBps,
        uint32 liquiditySlopeBps,
        uint256 balanceOut,
        uint32 maxDiscountBps
    ) private pure returns (uint256 amountOut) {
        amountOut = _amountOut(amountIn, price, tokenInDecimals, tokenOutDecimals, discountBps);
        discountBps = _discountWithLiquidityDepth(discountBps, liquiditySlopeBps, amountOut, balanceOut, maxDiscountBps);
        amountOut = _amountOut(amountIn, price, tokenInDecimals, tokenOutDecimals, discountBps);
    }

    function _discountWithLiquidityDepth(
        uint256 discountBps,
        uint32 liquiditySlopeBps,
        uint256 amountOut,
        uint256 balanceOut,
        uint32 maxDiscountBps
    ) private pure returns (uint256) {
        if (liquiditySlopeBps > 0 && balanceOut > 0) {
            discountBps += uint256(liquiditySlopeBps) * amountOut / balanceOut;
        }
        require(discountBps <= maxDiscountBps, AquaExitTermDiscountTooHigh(discountBps, maxDiscountBps));
        require(discountBps < _BPS, AquaExitTermDiscountExceedsPar(discountBps));
        return discountBps;
    }

    function _checkNotionalLimit(
        uint256 amountOut,
        uint256 balanceOut,
        uint128 maxNotionalOut
    ) private pure {
        if (maxNotionalOut == 0) return;
        uint256 spentOut = maxNotionalOut > balanceOut ? uint256(maxNotionalOut) - balanceOut : 0;
        uint256 notionalAfter = spentOut + amountOut;
        require(notionalAfter <= maxNotionalOut, AquaExitTermNotionalLimitExceeded(notionalAfter, maxNotionalOut));
    }

    function _checkAllowedMarket(
        address tokenIn,
        address tokenOut,
        address allowedTokenIn,
        address allowedTokenOut
    ) private pure {
        bool tokenInAllowed = allowedTokenIn == address(0) || tokenIn == allowedTokenIn;
        bool tokenOutAllowed = allowedTokenOut == address(0) || tokenOut == allowedTokenOut;
        require(tokenInAllowed && tokenOutAllowed, AquaExitTermTokenNotAllowed(tokenIn, tokenOut, allowedTokenIn, allowedTokenOut));
    }

    function _checkMaturity(
        uint40 maturity,
        uint40 minMaturity,
        uint40 maxMaturity
    ) private pure {
        bool afterMin = minMaturity == 0 || maturity >= minMaturity;
        bool beforeMax = maxMaturity == 0 || maturity <= maxMaturity;
        require(afterMin && beforeMax, AquaExitTermMaturityOutOfRange(maturity, minMaturity, maxMaturity));
    }
}
