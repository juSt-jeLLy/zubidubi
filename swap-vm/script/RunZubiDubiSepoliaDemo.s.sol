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

contract RunZubiDubiSepoliaDemo is Script {
    uint256 private constant SEPOLIA_CHAIN_ID = 11_155_111;

    address private constant AQUA = 0xf2A123D6a9Be099283b836EB5D74c08a3F3e013e;
    address private constant ROUTER = 0x6BeA330Bd4Ca9B631B2f935C30047C76EC2DAb99;
    address private constant EXIT_RECEIPT = 0x23F341b571434cD17b1232703Cd41569C58106EB;
    address private constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address private constant SEPOLIA_CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    uint8 private constant OP_AQUA_EXIT_TERM_SWAP_1D = 0x22;
    uint256 private constant RECEIPT_CAPACITY = 1 ether;
    uint256 private constant USDC_LIQUIDITY = 100e6;
    uint256 private constant RECEIPT_TO_SELL = 0.001 ether;

    function run() external {
        require(block.chainid == SEPOLIA_CHAIN_ID, "RunZubiDubiSepoliaDemo: wrong chain");

        uint256 deployerPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address maker = vm.addr(deployerPk);

        Aqua aqua = Aqua(AQUA);
        AquaSwapVMRouter router = AquaSwapVMRouter(payable(ROUTER));
        ZubiDubiExitReceipt receipt = ZubiDubiExitReceipt(EXIT_RECEIPT);
        IERC20 usdc = IERC20(SEPOLIA_USDC);

        bytes memory program = _program();
        ISwapVM.Order memory order = _order(maker, program);
        bytes32 orderHash = router.hash(order);

        vm.startBroadcast(deployerPk);

        ZubiDubiDemoTaker taker = new ZubiDubiDemoTaker(aqua, router, maker);

        receipt.mint(address(taker), RECEIPT_TO_SELL);
        usdc.approve(address(aqua), type(uint256).max);

        address[] memory tokens = new address[](2);
        tokens[0] = EXIT_RECEIPT;
        tokens[1] = SEPOLIA_USDC;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = RECEIPT_CAPACITY;
        amounts[1] = USDC_LIQUIDITY;

        bytes32 shippedHash = aqua.ship(address(router), abi.encode(order), tokens, amounts);
        require(shippedHash == orderHash, "RunZubiDubiSepoliaDemo: order hash mismatch");

        bytes memory takerData = _takerData(address(taker), true);

        vm.stopBroadcast();

        (, uint256 quotedOut,) = ISwapVM(address(router)).quote(
            order,
            EXIT_RECEIPT,
            SEPOLIA_USDC,
            RECEIPT_TO_SELL,
            takerData
        );

        uint256 makerUsdcBefore = usdc.balanceOf(maker);
        uint256 takerUsdcBefore = usdc.balanceOf(address(taker));
        uint256 takerReceiptBefore = receipt.balanceOf(address(taker));

        vm.startBroadcast(deployerPk);

        (uint256 amountIn, uint256 amountOut,) = taker.swap(
            order,
            EXIT_RECEIPT,
            SEPOLIA_USDC,
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
    }

    function _program() private view returns (bytes memory) {
        return bytes.concat(
            abi.encodePacked(OP_AQUA_EXIT_TERM_SWAP_1D, uint8(44)),
            AquaExitTermArgsBuilder.build({
                baseDiscountBps: 100,
                annualRateBps: 1_200,
                maxDiscountBps: 300,
                maturity: uint40(block.timestamp + 30 days),
                maxStaleness: 2 days,
                tokenInDecimals: 18,
                tokenOutDecimals: 6,
                oracleDecimals: 8,
                oracleAddress: SEPOLIA_CHAINLINK_ETH_USD
            })
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
