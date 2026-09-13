// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";

import { AquaSwapVMRouter } from "../src/routers/AquaSwapVMRouter.sol";
import { ISwapVM } from "../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../src/libs/MakerTraits.sol";
import { AquaExitTermArgsBuilder } from "../src/instructions/AquaExitTerm.sol";
import { ZubiDubiExitReceipt } from "../src/ZubiDubiExitReceipt.sol";
import { ZubiDubiRouteExecutor } from "../src/ZubiDubiRouteExecutor.sol";
import { ZubiDubiConfig } from "./ZubiDubiConfig.sol";

/// @notice Publishes additional Sepolia strategies from two independent maker EOAs.
///         These orders are meant for live demos of multi-maker route splitting,
///         solvency checks, and shared term-risk budget pressure repricing.
contract RunZubiDubiSepoliaMultiMakerBook is Script {
    uint8 private constant OP_AQUA_EXIT_BACKING_ORACLE_CHECK = 0x24;
    uint8 private constant OP_AQUA_EXIT_EXPOSURE_CAP = 0x25;
    uint8 private constant OP_AQUA_EXIT_DISCOUNT_CURVE_1D = 0x26;

    struct ReceiptAsset {
        string key;
        string symbol;
        address token;
        uint8 decimals;
        uint128 maxExposure;
    }

    struct QuoteAsset {
        string symbol;
        address token;
        uint8 decimals;
    }

    struct MarketSpec {
        ReceiptAsset receipt;
        QuoteAsset quote;
        address oracle;
        uint32 baseDiscountBps;
        uint32 annualRateBps;
        uint32 maxDiscountBps;
        uint32 inventorySlopeBps;
        uint32 liquiditySlopeBps;
        uint32 riskTierBps;
        uint32 convexityBps;
        uint256 quoteLiquidity;
        bytes32 budgetId;
        uint128 budgetReceiptExposure;
        uint128 budgetQuoteSpend;
        uint32 pressurePenaltyBps;
    }

    function run() external {
        ZubiDubiConfig.NetworkConfig memory config = ZubiDubiConfig.sepolia();
        require(block.chainid == config.chainId, "RunZubiDubiSepoliaMultiMakerBook: wrong chain");

        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/deployments/sepolia/ZubiDubiAssets.json"));

        Aqua aqua = Aqua(config.aqua);
        AquaSwapVMRouter router = AquaSwapVMRouter(payable(config.aquaSwapVMRouter));
        ZubiDubiRouteExecutor routeExecutor = ZubiDubiRouteExecutor(config.routeExecutor);

        uint256 maker1Pk = vm.envUint("WALLET_PRIVATE_KEY1");
        uint256 maker2Pk = vm.envUint("WALLET_PRIVATE_KEY2");

        _publishMaker1Book(maker1Pk, json, config, aqua, router, routeExecutor);
        _publishMaker2Book(maker2Pk, json, config, aqua, router, routeExecutor);
    }

    function _publishMaker1Book(
        uint256 makerPk,
        string memory json,
        ZubiDubiConfig.NetworkConfig memory config,
        Aqua aqua,
        AquaSwapVMRouter router,
        ZubiDubiRouteExecutor routeExecutor
    )
        private
    {
        QuoteAsset memory usdc = QuoteAsset("USDC", config.usdc, 6);

        ReceiptAsset memory eth30 = _receipt(json, "ptZbEth30d", "PT-zbETH-30D", 18, 0.05 ether);
        ReceiptAsset memory eth180 = _receipt(json, "ptZbEth180d", "PT-zbETH-180D", 18, 0.08 ether);
        ReceiptAsset memory usd30 = _receipt(json, "ptZbUsd30d", "PT-zbUSD-30D", 18, 75_000 ether);

        bytes32 ethBook = keccak256("zubi-maker1-eth-usdc-term-book");
        bytes32 usdBook = keccak256("zubi-maker1-usd-usdc-term-book");

        MarketSpec[3] memory markets;
        markets[0] = _market(
            eth30,
            usdc,
            vm.parseJsonAddress(json, ".ethUsdcOracle"),
            45,
            520,
            850,
            175,
            20,
            15,
            900,
            110e6,
            ethBook,
            0.12 ether,
            220e6,
            125
        );
        markets[1] = _market(
            eth180,
            usdc,
            vm.parseJsonAddress(json, ".ethUsdcOracle"),
            70,
            880,
            1250,
            240,
            35,
            35,
            2400,
            120e6,
            ethBook,
            0.12 ether,
            220e6,
            125
        );
        markets[2] = _market(
            usd30,
            usdc,
            vm.parseJsonAddress(json, ".usdcUsdcOracle"),
            18,
            220,
            420,
            90,
            15,
            5,
            350,
            70e6,
            usdBook,
            150_000 ether,
            140e6,
            70
        );

        _publishBook("maker1", makerPk, markets, aqua, router, routeExecutor);
    }

    function _publishMaker2Book(
        uint256 makerPk,
        string memory json,
        ZubiDubiConfig.NetworkConfig memory config,
        Aqua aqua,
        AquaSwapVMRouter router,
        ZubiDubiRouteExecutor routeExecutor
    )
        private
    {
        QuoteAsset memory usdc = QuoteAsset("USDC", config.usdc, 6);
        QuoteAsset memory weth = QuoteAsset("WETH", config.weth, 18);

        ReceiptAsset memory eth30 = _receipt(json, "ptZbEth30d", "PT-zbETH-30D", 18, 0.06 ether);
        ReceiptAsset memory link30 = _receipt(json, "ptZbLink30d", "PT-zbLINK-30D", 18, 7500 ether);

        bytes32 ethUsdcBook = keccak256("zubi-maker2-eth-usdc-term-book");
        bytes32 ethWethBook = keccak256("zubi-maker2-eth-weth-term-book");
        bytes32 linkBook = keccak256("zubi-maker2-link-usdc-term-book");

        MarketSpec[3] memory markets;
        markets[0] = _market(
            eth30,
            usdc,
            vm.parseJsonAddress(json, ".ethUsdcOracle"),
            60,
            620,
            950,
            220,
            28,
            25,
            1100,
            150e6,
            ethUsdcBook,
            0.1 ether,
            180e6,
            220
        );
        markets[1] = _market(
            eth30,
            weth,
            vm.parseJsonAddress(json, ".ethWethOracle"),
            30,
            330,
            650,
            150,
            20,
            15,
            750,
            0.04 ether,
            ethWethBook,
            0.08 ether,
            0.04 ether,
            140
        );
        markets[2] = _market(
            link30,
            usdc,
            vm.parseJsonAddress(json, ".linkUsdcOracle"),
            65,
            760,
            1150,
            240,
            30,
            40,
            1700,
            85e6,
            linkBook,
            10_000 ether,
            120e6,
            180
        );

        _publishBook("maker2", makerPk, markets, aqua, router, routeExecutor);
    }

    function _publishBook(
        string memory makerLabel,
        uint256 makerPk,
        MarketSpec[3] memory markets,
        Aqua aqua,
        AquaSwapVMRouter router,
        ZubiDubiRouteExecutor routeExecutor
    )
        private
    {
        address maker = vm.addr(makerPk);

        vm.startBroadcast(makerPk);

        for (uint256 i = 0; i < markets.length; i++) {
            uint40 maturity = ZubiDubiExitReceipt(markets[i].receipt.token).maturity();
            ISwapVM.Order memory order = _order(maker, _program(markets[i], maturity));
            bytes32 orderHash = router.hash(order);
            (address assignedMaker,,,, bool active) = routeExecutor.termRiskBudgetMemberships(orderHash);

            if (active && assignedMaker == maker) {
                console2.log("Skipping already assigned multi-maker market:", makerLabel);
                console2.log("Receipt symbol:", markets[i].receipt.symbol);
                console2.log("Quote symbol:", markets[i].quote.symbol);
                console2.logBytes32(orderHash);
                continue;
            }

            IERC20(markets[i].quote.token).approve(address(aqua), type(uint256).max);
            routeExecutor.setTermRiskBudget(
                markets[i].budgetId,
                markets[i].budgetReceiptExposure,
                markets[i].budgetQuoteSpend,
                markets[i].pressurePenaltyBps
            );

            address[] memory tokens = new address[](2);
            tokens[0] = markets[i].receipt.token;
            tokens[1] = markets[i].quote.token;

            uint256[] memory amounts = new uint256[](2);
            amounts[0] = 0;
            amounts[1] = markets[i].quoteLiquidity;

            bytes32 shippedHash = aqua.ship(address(router), abi.encode(order), tokens, amounts);
            require(shippedHash == orderHash, "RunZubiDubiSepoliaMultiMakerBook: order hash mismatch");

            routeExecutor.assignOrderTermRiskBudget(
                orderHash, markets[i].budgetId, markets[i].receipt.token, markets[i].quote.token
            );

            console2.log("Shipped multi-maker market:", makerLabel);
            console2.log("Receipt symbol:", markets[i].receipt.symbol);
            console2.log("Quote symbol:", markets[i].quote.symbol);
            console2.log("Maker:", maker);
            console2.log("Receipt:", markets[i].receipt.token);
            console2.log("Quote token:", markets[i].quote.token);
            console2.log("Pressure penalty bps:", markets[i].pressurePenaltyBps);
            console2.logBytes32(orderHash);
        }

        vm.stopBroadcast();
    }

    function _receipt(
        string memory json,
        string memory key,
        string memory symbol,
        uint8 decimals,
        uint128 maxExposure
    )
        private
        pure
        returns (ReceiptAsset memory)
    {
        return ReceiptAsset({
            key: key,
            symbol: symbol,
            token: vm.parseJsonAddress(json, string.concat(".", key, "Address")),
            decimals: decimals,
            maxExposure: maxExposure
        });
    }

    function _market(
        ReceiptAsset memory receipt,
        QuoteAsset memory quote,
        address oracle,
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint32 inventorySlopeBps,
        uint32 liquiditySlopeBps,
        uint32 riskTierBps,
        uint32 convexityBps,
        uint256 quoteLiquidity,
        bytes32 budgetId,
        uint128 budgetReceiptExposure,
        uint128 budgetQuoteSpend,
        uint32 pressurePenaltyBps
    )
        private
        pure
        returns (MarketSpec memory)
    {
        return MarketSpec({
            receipt: receipt,
            quote: quote,
            oracle: oracle,
            baseDiscountBps: baseDiscountBps,
            annualRateBps: annualRateBps,
            maxDiscountBps: maxDiscountBps,
            inventorySlopeBps: inventorySlopeBps,
            liquiditySlopeBps: liquiditySlopeBps,
            riskTierBps: riskTierBps,
            convexityBps: convexityBps,
            quoteLiquidity: quoteLiquidity,
            budgetId: budgetId,
            budgetReceiptExposure: budgetReceiptExposure,
            budgetQuoteSpend: budgetQuoteSpend,
            pressurePenaltyBps: pressurePenaltyBps
        });
    }

    function _program(MarketSpec memory market, uint40 maturity) private pure returns (bytes memory) {
        bytes memory args = AquaExitTermArgsBuilder.build(
            AquaExitTermArgsBuilder.Args({
                baseDiscountBps: market.baseDiscountBps,
                annualRateBps: market.annualRateBps,
                maxDiscountBps: market.maxDiscountBps,
                maturity: maturity,
                maxStaleness: 2 days,
                tokenInDecimals: market.receipt.decimals,
                tokenOutDecimals: market.quote.decimals,
                oracleDecimals: 18,
                oracleAddress: market.oracle,
                maxExposure: market.receipt.maxExposure,
                inventorySlopeBps: market.inventorySlopeBps,
                maxNotionalOut: 0,
                liquiditySlopeBps: market.liquiditySlopeBps,
                riskTierBps: market.riskTierBps,
                minMaturity: 0,
                maxMaturity: type(uint40).max,
                allowedTokenIn: market.receipt.token,
                allowedTokenOut: market.quote.token,
                secondaryOracleAddress: address(0),
                maxDeviationBps: 0,
                deviationHaircutBps: 0,
                curveFamily: 1,
                convexityBps: market.convexityBps
            })
        );

        return bytes.concat(
            abi.encodePacked(OP_AQUA_EXIT_BACKING_ORACLE_CHECK, uint8(args.length)),
            args,
            abi.encodePacked(OP_AQUA_EXIT_EXPOSURE_CAP, uint8(args.length)),
            args,
            abi.encodePacked(OP_AQUA_EXIT_DISCOUNT_CURVE_1D, uint8(args.length)),
            args
        );
    }

    function _order(address maker, bytes memory program) private pure returns (ISwapVM.Order memory) {
        return MakerTraitsLib.build(
            MakerTraitsLib.Args({
                maker: maker,
                shouldUnwrapWeth: false,
                useAquaInsteadOfSignature: true,
                allowZeroAmountIn: false,
                receiver: address(0),
                hasPreTransferInHook: false,
                hasPostTransferInHook: false,
                hasPreTransferOutHook: false,
                hasPostTransferOutHook: false,
                preTransferInTarget: address(0),
                preTransferInData: "",
                postTransferInTarget: address(0),
                postTransferInData: "",
                preTransferOutTarget: address(0),
                preTransferOutData: "",
                postTransferOutTarget: address(0),
                postTransferOutData: "",
                program: program
            })
        );
    }
}
