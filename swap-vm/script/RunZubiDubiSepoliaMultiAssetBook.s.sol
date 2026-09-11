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
import { ZubiDubiConfig } from "./ZubiDubiConfig.sol";

/// @notice Publishes a Sepolia term-liquidity book over real Sepolia tokens:
///         WETH-, USDC-, and LINK-backed receipts, paid out in real USDC/WETH.
contract RunZubiDubiSepoliaMultiAssetBook is Script {
    uint8 private constant OP_AQUA_EXIT_BACKING_ORACLE_CHECK = 0x24;
    uint8 private constant OP_AQUA_EXIT_EXPOSURE_CAP = 0x25;
    uint8 private constant OP_AQUA_EXIT_DISCOUNT_CURVE_1D = 0x26;

    struct ReceiptAsset {
        string key;
        string symbol;
        string family;
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
    }

    function run() external {
        ZubiDubiConfig.NetworkConfig memory config = ZubiDubiConfig.sepolia();
        require(block.chainid == config.chainId, "RunZubiDubiSepoliaMultiAssetBook: wrong chain");

        uint256 deployerPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address maker = vm.addr(deployerPk);
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/deployments/sepolia/ZubiDubiAssets.json"));

        Aqua aqua = Aqua(config.aqua);
        AquaSwapVMRouter router = AquaSwapVMRouter(payable(config.aquaSwapVMRouter));

        MarketSpec[7] memory markets = _markets(json, config);

        vm.startBroadcast(deployerPk);

        for (uint256 i = 0; i < markets.length; i++) {
            IERC20(markets[i].quote.token).approve(address(aqua), type(uint256).max);

            uint40 maturity = ZubiDubiExitReceipt(markets[i].receipt.token).maturity();
            ISwapVM.Order memory order = _order(maker, _program(markets[i], maturity));

            address[] memory tokens = new address[](2);
            tokens[0] = markets[i].receipt.token;
            tokens[1] = markets[i].quote.token;

            uint256[] memory amounts = new uint256[](2);
            amounts[0] = 0;
            amounts[1] = markets[i].quoteLiquidity;

            bytes32 shippedHash = aqua.ship(address(router), abi.encode(order), tokens, amounts);
            require(shippedHash == router.hash(order), "RunZubiDubiSepoliaMultiAssetBook: order hash mismatch");

            console2.log("Shipped market:", markets[i].receipt.symbol, "->", markets[i].quote.symbol);
            console2.log("Receipt:", markets[i].receipt.token);
            console2.log("Quote token:", markets[i].quote.token);
            console2.log("Oracle:", markets[i].oracle);
            console2.logBytes32(shippedHash);
        }

        vm.stopBroadcast();
    }

    function _markets(
        string memory json,
        ZubiDubiConfig.NetworkConfig memory config
    ) private pure returns (MarketSpec[7] memory markets) {
        QuoteAsset memory usdc = QuoteAsset("USDC", config.usdc, 6);
        QuoteAsset memory weth = QuoteAsset("WETH", config.weth, 18);

        ReceiptAsset memory eth30 = _receipt(json, "ptZbEth30d", "PT-zbETH-30D", "ETH", 18, 0.03 ether);
        ReceiptAsset memory eth180 = _receipt(json, "ptZbEth180d", "PT-zbETH-180D", "ETH", 18, 0.05 ether);
        ReceiptAsset memory usd30 = _receipt(json, "ptZbUsd30d", "PT-zbUSD-30D", "USD", 18, 50_000 ether);
        ReceiptAsset memory usd180 = _receipt(json, "ptZbUsd180d", "PT-zbUSD-180D", "USD", 18, 75_000 ether);
        ReceiptAsset memory link30 = _receipt(json, "ptZbLink30d", "PT-zbLINK-30D", "LINK", 18, 5_000 ether);
        ReceiptAsset memory link180 = _receipt(json, "ptZbLink180d", "PT-zbLINK-180D", "LINK", 18, 7_500 ether);

        markets[0] = _market(eth30, usdc, vm.parseJsonAddress(json, ".ethUsdcOracle"), 50, 550, 800, 175, 25, 20, 1000, 25e6);
        markets[1] = _market(eth180, usdc, vm.parseJsonAddress(json, ".ethUsdcOracle"), 80, 900, 1200, 225, 35, 35, 2500, 50e6);
        markets[2] = _market(eth30, weth, vm.parseJsonAddress(json, ".ethWethOracle"), 35, 350, 650, 150, 20, 15, 750, 0.02 ether);
        markets[3] = _market(usd30, usdc, vm.parseJsonAddress(json, ".usdcUsdcOracle"), 20, 250, 450, 80, 15, 5, 400, 50e6);
        markets[4] = _market(usd180, weth, vm.parseJsonAddress(json, ".usdcWethOracle"), 55, 650, 950, 175, 30, 20, 1600, 0.05 ether);
        markets[5] = _market(link30, usdc, vm.parseJsonAddress(json, ".linkUsdcOracle"), 70, 800, 1200, 225, 35, 40, 1800, 30e6);
        markets[6] = _market(link180, weth, vm.parseJsonAddress(json, ".linkWethOracle"), 110, 1100, 1800, 300, 55, 60, 3600, 0.08 ether);
    }

    function _receipt(
        string memory json,
        string memory key,
        string memory symbol,
        string memory family,
        uint8 decimals,
        uint128 maxExposure
    ) private pure returns (ReceiptAsset memory) {
        return ReceiptAsset({
            key: key,
            symbol: symbol,
            family: family,
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
        uint256 quoteLiquidity
    ) private pure returns (MarketSpec memory) {
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
            quoteLiquidity: quoteLiquidity
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
