// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";

import { AquaSwapVMRouter } from "../src/routers/AquaSwapVMRouter.sol";
import { ISwapVM } from "../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../src/libs/MakerTraits.sol";
import { TakerTraitsLib } from "../src/libs/TakerTraits.sol";
import { AquaExitTermArgsBuilder } from "../src/instructions/AquaExitTerm.sol";
import { ZubiDubiExitReceipt } from "../src/ZubiDubiExitReceipt.sol";
import { ZubiDubiDemoTaker } from "../src/ZubiDubiDemoTaker.sol";
import { ZubiDubiConfig } from "./ZubiDubiConfig.sol";

interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract RunZubiDubiSepoliaDemo is Script {
    uint8 private constant OP_AQUA_EXIT_BACKING_ORACLE_CHECK = 0x24;
    uint8 private constant OP_AQUA_EXIT_EXPOSURE_CAP = 0x25;
    uint8 private constant OP_AQUA_EXIT_DISCOUNT_CURVE_1D = 0x26;
    uint256 private constant RECEIPT_CAPACITY = 1 ether;
    uint256 private constant USDC_LIQUIDITY = 100e6;
    uint256 private constant RECEIPT_TO_SELL = 0.001 ether;

    function run() external {
        ZubiDubiConfig.NetworkConfig memory config = ZubiDubiConfig.sepolia();
        ZubiDubiConfig.TokenConfig memory receiptAsset = ZubiDubiConfig.sepoliaReceiptAsset();
        ZubiDubiConfig.TokenConfig memory quoteAsset = ZubiDubiConfig.sepoliaQuoteAsset();

        require(block.chainid == config.chainId, "RunZubiDubiSepoliaDemo: wrong chain");

        uint256 deployerPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address maker = vm.addr(deployerPk);

        Aqua aqua = Aqua(config.aqua);
        AquaSwapVMRouter router = AquaSwapVMRouter(payable(config.aquaSwapVMRouter));
        ZubiDubiExitReceipt receipt = ZubiDubiExitReceipt(config.exitReceipt);
        IERC20 usdc = IERC20(config.usdc);

        bytes memory program = _program(receiptAsset, quoteAsset);
        ISwapVM.Order memory order = _order(maker, program);
        bytes32 orderHash = router.hash(order);

        vm.startBroadcast(deployerPk);

        ZubiDubiDemoTaker taker = new ZubiDubiDemoTaker(aqua, router, maker);

        IWETH(config.weth).deposit{ value: RECEIPT_TO_SELL }();
        IWETH(config.weth).approve(address(receipt), RECEIPT_TO_SELL);
        receipt.issue(RECEIPT_TO_SELL, address(taker));
        usdc.approve(address(aqua), type(uint256).max);

        address[] memory tokens = new address[](2);
        tokens[0] = receiptAsset.token;
        tokens[1] = quoteAsset.token;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0;
        amounts[1] = USDC_LIQUIDITY;

        bytes32 shippedHash = aqua.ship(address(router), abi.encode(order), tokens, amounts);
        require(shippedHash == orderHash, "RunZubiDubiSepoliaDemo: order hash mismatch");

        bytes memory takerData = _takerData(address(taker), true);

        vm.stopBroadcast();

        (, uint256 quotedOut,) = ISwapVM(address(router)).quote(
            order,
            receiptAsset.token,
            quoteAsset.token,
            RECEIPT_TO_SELL,
            takerData
        );

        uint256 makerUsdcBefore = usdc.balanceOf(maker);
        uint256 takerUsdcBefore = usdc.balanceOf(address(taker));
        uint256 takerReceiptBefore = receipt.balanceOf(address(taker));

        vm.startBroadcast(deployerPk);

        (uint256 amountIn, uint256 amountOut,) = taker.swap(
            order,
            receiptAsset.token,
            quoteAsset.token,
            RECEIPT_TO_SELL,
            takerData
        );

        uint256 makerUsdcAfter = usdc.balanceOf(maker);
        uint256 takerUsdcAfter = usdc.balanceOf(address(taker));
        uint256 takerReceiptAfter = receipt.balanceOf(address(taker));

        vm.stopBroadcast();

        console2.log("ZubiDubi live Sepolia taker:", address(taker));
        console2.log("ZubiDubi live Sepolia order hash:");
        console2.logBytes32(orderHash);
        console2.log("Quoted USDC units:", quotedOut);
        console2.log("Receipt sold:", amountIn);
        console2.log("USDC paid:", amountOut);
        console2.log("Maker USDC before:", makerUsdcBefore);
        console2.log("Maker USDC after:", makerUsdcAfter);
        console2.log("Taker USDC before:", takerUsdcBefore);
        console2.log("Taker USDC after:", takerUsdcAfter);
        console2.log("Taker receipt before:", takerReceiptBefore);
        console2.log("Taker receipt after:", takerReceiptAfter);
        console2.log("Receipt underlying WETH backing:", IERC20(config.weth).balanceOf(address(receipt)));
    }

    function _program(
        ZubiDubiConfig.TokenConfig memory receiptAsset,
        ZubiDubiConfig.TokenConfig memory quoteAsset
    ) private view returns (bytes memory) {
        bytes memory args = AquaExitTermArgsBuilder.build(AquaExitTermArgsBuilder.Args({
                baseDiscountBps: 100,
                annualRateBps: 1_200,
                maxDiscountBps: 300,
                maturity: uint40(block.timestamp + 30 days),
                maxStaleness: 2 days,
                tokenInDecimals: receiptAsset.decimals,
                tokenOutDecimals: quoteAsset.decimals,
                oracleDecimals: receiptAsset.priceFeedDecimals,
                oracleAddress: receiptAsset.priceFeed,
                maxExposure: 0.01 ether,
                inventorySlopeBps: 0,
                maxNotionalOut: 0,
                liquiditySlopeBps: 0,
                riskTierBps: 0,
                minMaturity: 0,
                maxMaturity: type(uint40).max,
                allowedTokenIn: receiptAsset.token,
                allowedTokenOut: quoteAsset.token
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

    function _takerData(address taker, bool isExactIn) private pure returns (bytes memory) {
        return TakerTraitsLib.build(TakerTraitsLib.Args({
            taker: taker,
            isExactIn: isExactIn,
            shouldUnwrapWeth: false,
            hasPreTransferInCallback: true,
            hasPreTransferOutCallback: false,
            isStrictThresholdAmount: false,
            isFirstTransferFromTaker: false,
            useTransferFromAndAquaPush: false,
            threshold: "",
            to: address(0),
            deadline: 0,
            preTransferInHookData: "",
            postTransferInHookData: "",
            preTransferOutHookData: "",
            postTransferOutHookData: "",
            preTransferInCallbackData: "",
            preTransferOutCallbackData: "",
            instructionsArgs: "",
            signature: ""
        }));
    }
}
