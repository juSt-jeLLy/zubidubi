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
        address secondaryOracleAddress;
        uint32 maxDeviationBps;
        uint32 deviationHaircutBps;
        // Term-structure curve family. 0 = linear, 1 = convex.
        // Appended last so legacy 166-byte args (shipped strategies) still parse
        // with the default linear curve: older strategies keep their exact pricing.
        uint8 curveFamily;
        uint32 convexityBps;
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
    error AquaExitTermMissingSecondaryOracleArg();
    error AquaExitTermMissingMaxDeviationArg();
    error AquaExitTermMissingDeviationHaircutArg();
    error AquaExitTermMissingCurveFamilyArg();
    error AquaExitTermMissingConvexityArg();
    error AquaExitTermTokenDecimalsTooHigh(uint8 decimals);
    error AquaExitTermConvexityTooHigh(uint32 convexityBps);
    error AquaExitTermUnknownCurveFamily(uint8 curveFamily);

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
        require(data.convexityBps < BPS, AquaExitTermConvexityTooHigh(data.convexityBps));
        require(data.curveFamily <= 1, AquaExitTermUnknownCurveFamily(data.curveFamily));
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
        bytes memory oracleIntegrity = abi.encodePacked(
            data.secondaryOracleAddress,
            data.maxDeviationBps,
            data.deviationHaircutBps
        );
        bytes memory curveFamilyBytes = abi.encodePacked(data.curveFamily, data.convexityBps);

        return bytes.concat(market, makerRisk, oracleIntegrity, curveFamilyBytes);
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
        parsed.secondaryOracleAddress = address(bytes20(args.slice(138, 158, AquaExitTermMissingSecondaryOracleArg.selector)));
        parsed.maxDeviationBps = uint32(bytes4(args.slice(158, 162, AquaExitTermMissingMaxDeviationArg.selector)));
        parsed.deviationHaircutBps = uint32(bytes4(args.slice(162, 166, AquaExitTermMissingDeviationHaircutArg.selector)));
        // Backward-compatible extension: legacy 166-byte args (pre curve-family)
        // keep the linear curve. New 171-byte args opt into convexity.
        if (args.length >= 171) {
            parsed.curveFamily = uint8(bytes1(args.slice(166, 167, AquaExitTermMissingCurveFamilyArg.selector)));
            parsed.convexityBps = uint32(bytes4(args.slice(167, 171, AquaExitTermMissingConvexityArg.selector)));
        }
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
    error AquaExitTermDeviationTooHigh(uint256 deviationBps, uint32 maxDeviationBps);

    uint8 internal constant _CURVE_LINEAR = 0;
    uint8 internal constant _CURVE_CONVEX = 1;

    /// @notice Reusable backing/oracle guard for delayed-redemption assets.
    /// @dev Validates asset pair, maturity window, and oracle freshness. If a
    ///      secondary real oracle is configured, it also enforces a cross-provider
    ///      deviation bound. It does not mutate swap registers.
    function _aquaExitBackingOracleCheck(Context memory ctx, bytes calldata args) internal view {
        AquaExitTermArgsBuilder.Args memory parsed = AquaExitTermArgsBuilder.parse(args);

        _checkAllowedMarket(ctx.query.tokenIn, ctx.query.tokenOut, parsed.allowedTokenIn, parsed.allowedTokenOut);
        _checkMaturity(parsed.maturity, parsed.minMaturity, parsed.maxMaturity);

        uint256 primaryPrice = _oraclePrice1e18(parsed.oracleAddress, parsed.oracleDecimals, parsed.maxStaleness);
        _oracleDeviationBps(parsed, primaryPrice);
    }

    /// @notice Cross-provider oracle integrity check.
    /// @dev Reads a secondary real feed (e.g. a Pyth adapter) and reverts if the
    ///      two independent providers deviate more than the maker's bound.
    function _oracleDeviationBps(
        AquaExitTermArgsBuilder.Args memory parsed,
        uint256 primaryPrice
    ) private view returns (uint256 extraDiscountBps) {
        if (parsed.secondaryOracleAddress == address(0) || parsed.maxDeviationBps == 0) return 0;
        if (primaryPrice == 0) return 0;

        uint256 secondaryPrice = _oraclePrice1e18(
            parsed.secondaryOracleAddress,
            parsed.oracleDecimals,
            parsed.maxStaleness
        );
        if (secondaryPrice == 0) return 0;

        uint256 diff = primaryPrice > secondaryPrice ? primaryPrice - secondaryPrice : secondaryPrice - primaryPrice;
        uint256 deviationBps = diff * _BPS / primaryPrice;
        if (deviationBps > parsed.maxDeviationBps) {
            revert AquaExitTermDeviationTooHigh(deviationBps, parsed.maxDeviationBps);
        }

        if (parsed.deviationHaircutBps > 0 && deviationBps > 0) {
            extraDiscountBps = deviationBps * parsed.deviationHaircutBps / parsed.maxDeviationBps;
        }
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
        uint256 extraDiscountBps = _oracleDeviationBps(parsed, price);
        if (extraDiscountBps > 0) {
            // Fold the cross-provider deviation haircut into the base discount.
            // The maxDiscountBps guardrail caps the combined discount below par.
            parsed.baseDiscountBps = uint32(uint256(parsed.baseDiscountBps) + extraDiscountBps);
        }
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
                parsed.riskTierBps,
                parsed.curveFamily,
                parsed.convexityBps,
                parsed.maturity,
                ctx.swap.balanceIn,
                ctx.swap.amountIn,
                parsed.maxExposure,
                parsed.inventorySlopeBps,
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
        uint32 riskTierBps,
        uint8 curveFamily,
        uint32 convexityBps,
        uint40 maturity,
        uint256 currentExposure,
        uint256 fillAmount,
        uint128 maxExposure,
        uint32 inventorySlopeBps,
        uint32 maxDiscountBps
    ) private view returns (uint256 discountBps) {
        uint256 exposureAfter = _checkExposureLimit(currentExposure, fillAmount, maxExposure);

        discountBps = _termDiscountBps(baseDiscountBps, annualRateBps, riskTierBps, curveFamily, convexityBps, maturity);
        if (maxExposure > 0 && inventorySlopeBps > 0) {
            discountBps += uint256(inventorySlopeBps) * exposureAfter / maxExposure;
        }

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

    /// @notice Term-structure discount curve.
    /// @dev Family 0 (linear): discount grows linearly with time to maturity.
    ///      Family 1 (convex): adds a quadratic convexity premium so long-dated
    ///      receipts are discounted more steeply than a straight line — the same
    ///      shape real yield curves take when duration risk is repriced.
    ///      `riskTierBps` is an ANNUALIZED asset-class haircut (e.g. LRT depeg
    ///      premium) that also scales with the remaining duration, so the same
    ///      tier byte produces a bigger premium for longer-dated claims.
    function _termDiscountBps(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 riskTierBps,
        uint8 curveFamily,
        uint32 convexityBps,
        uint40 maturity
    ) private view returns (uint256) {
        if (block.timestamp >= maturity) {
            return baseDiscountBps;
        }

        uint256 secondsToMaturity = uint256(maturity) - block.timestamp;
        // The asset-class haircut is an annualized rate, folded into the term rate.
        uint256 rateBps = uint256(annualRateBps) + uint256(riskTierBps);
        uint256 linearDiscountBps = rateBps * secondsToMaturity / _YEAR;

        if (curveFamily == _CURVE_CONVEX && convexityBps > 0) {
            // True quadratic convexity premium, annualized at the 1-year horizon:
            //   premiumBps = convexityBps * (secondsToMaturity / YEAR)^2
            // Computed in full precision (Math.mulDiv) so short-dated receipts still
            // quote a measurable, non-truncated convexity premium: convexity is a
            // duration-of-duration term, so it scales with the square of remaining
            // time, not with the discount rate itself.
            linearDiscountBps += Math.mulDiv(
                uint256(convexityBps) * secondsToMaturity,
                secondsToMaturity,
                _YEAR * _YEAR
            );
        }

        return uint256(baseDiscountBps) + linearDiscountBps;
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
            parsed.riskTierBps,
            parsed.curveFamily,
            parsed.convexityBps,
            parsed.maturity,
            currentExposure,
            0,
            parsed.maxExposure,
            parsed.inventorySlopeBps,
            parsed.maxDiscountBps
        );
        discountBps = _discountWithLiquidityDepth(discountBps, parsed.liquiditySlopeBps, amountOut, balanceOut, parsed.maxDiscountBps);
        amountIn = _amountIn(amountOut, price, parsed.tokenInDecimals, parsed.tokenOutDecimals, discountBps);

        for (uint256 i = 0; i < 3; i++) {
            discountBps = _checkedDiscountBps(
                parsed.baseDiscountBps,
                parsed.annualRateBps,
                parsed.riskTierBps,
                parsed.curveFamily,
                parsed.convexityBps,
                parsed.maturity,
                currentExposure,
                amountIn,
                parsed.maxExposure,
                parsed.inventorySlopeBps,
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
