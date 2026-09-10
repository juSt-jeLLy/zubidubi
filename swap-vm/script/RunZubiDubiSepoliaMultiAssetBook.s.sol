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

/// @notice Publishes a five-market Sepolia term-liquidity book:
///         PT-zbETH 30D/60D/90D/180D/360D -> USDC.
contract RunZubiDubiSepoliaMultiAssetBook is Script {
    uint8 private constant OP_AQUA_EXIT_BACKING_ORACLE_CHECK = 0x24;
    uint8 private constant OP_AQUA_EXIT_EXPOSURE_CAP = 0x25;
    uint8 private constant OP_AQUA_EXIT_DISCOUNT_CURVE_1D = 0x26;

    function run() external {
        ZubiDubiConfig.NetworkConfig memory config = ZubiDubiConfig.sepolia();
        ZubiDubiConfig.TokenConfig memory quoteAsset = ZubiDubiConfig.sepoliaQuoteAsset();

        require(block.chainid == config.chainId, "RunZubiDubiSepoliaMultiAssetBook: wrong chain");

        uint256 deployerPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address maker = vm.addr(deployerPk);
        uint256 quoteLiquidity = vm.envOr("ZUBIDUBI_MARKET_USDC_LIQUIDITY", uint256(25e6));

        Aqua aqua = Aqua(config.aqua);
        AquaSwapVMRouter router = AquaSwapVMRouter(payable(config.aquaSwapVMRouter));
        IERC20 usdc = IERC20(config.usdc);

        vm.startBroadcast(deployerPk);
        usdc.approve(address(aqua), type(uint256).max);

        for (uint256 i = 0; i < 5; i++) {
            ZubiDubiConfig.TokenConfig memory receiptAsset = ZubiDubiConfig.sepoliaMaturingReceiptAsset(i);
            uint40 maturity = ZubiDubiExitReceipt(receiptAsset.token).maturity();
            ISwapVM.Order memory order = _order(maker, _program(receiptAsset, quoteAsset, maturity, i));

            address[] memory tokens = new address[](2);
            tokens[0] = receiptAsset.token;
            tokens[1] = quoteAsset.token;

            uint256[] memory amounts = new uint256[](2);
            amounts[0] = 0;
            amounts[1] = quoteLiquidity;

            bytes32 shippedHash = aqua.ship(address(router), abi.encode(order), tokens, amounts);
            require(shippedHash == router.hash(order), "RunZubiDubiSepoliaMultiAssetBook: order hash mismatch");

            console2.log("Shipped market:", receiptAsset.symbol, "->", quoteAsset.symbol);
            console2.log("Receipt:", receiptAsset.token);
            console2.log("Maturity:", maturity);
            console2.logBytes32(shippedHash);
        }

        vm.stopBroadcast();
    }

    function _program(
        ZubiDubiConfig.TokenConfig memory receiptAsset,
        ZubiDubiConfig.TokenConfig memory quoteAsset,
        uint40 maturity,
        uint256 index
    ) private pure returns (bytes memory) {
        bytes memory args = AquaExitTermArgsBuilder.build(AquaExitTermArgsBuilder.Args({
                baseDiscountBps: uint32(50 + index * 15),
                annualRateBps: uint32(500 + index * 90),
                maxDiscountBps: uint32(800 + index * 200),
                maturity: maturity,
                maxStaleness: 2 days,
                tokenInDecimals: receiptAsset.decimals,
                tokenOutDecimals: quoteAsset.decimals,
                oracleDecimals: receiptAsset.priceFeedDecimals,
                oracleAddress: receiptAsset.priceFeed,
                maxExposure: 0.025 ether,
                inventorySlopeBps: uint32(150 + index * 25),
                maxNotionalOut: 0,
                liquiditySlopeBps: uint32(25 + index * 10),
                riskTierBps: uint32(10 + index * 10),
                minMaturity: 0,
                maxMaturity: type(uint40).max,
                allowedTokenIn: receiptAsset.token,
                allowedTokenOut: quoteAsset.token,
                secondaryOracleAddress: address(0),
                maxDeviationBps: 0,
                deviationHaircutBps: 0,
                curveFamily: 1,
                convexityBps: uint32(1_000 + index * 750)
        }));

        return bytes.concat(
            abi.encodePacked(OP_AQUA_EXIT_BACKING_ORACLE_CHECK, uint8(args.length)), args,
            abi.encodePacked(OP_AQUA_EXIT_EXPOSURE_CAP, uint8(args.length)), args,
            abi.encodePacked(OP_AQUA_EXIT_DISCOUNT_CURVE_1D, uint8(args.length)), args
        );
    }

    function _order(address maker, bytes memory program) private pure returns (ISwapVM.Order memory) {
        return MakerTraitsLib.build(MakerTraitsLib.Args({
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
        }));
    }
}
