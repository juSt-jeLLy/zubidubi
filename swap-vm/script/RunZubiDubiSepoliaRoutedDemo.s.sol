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
import { ZubiDubiDemoSeller } from "../src/ZubiDubiDemoSeller.sol";
import { ZubiDubiRouteExecutor } from "../src/ZubiDubiRouteExecutor.sol";
import { ZubiDubiConfig } from "./ZubiDubiConfig.sol";

interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract RunZubiDubiSepoliaRoutedDemo is Script {
    uint8 private constant OP_AQUA_EXIT_BACKING_ORACLE_CHECK = 0x24;
    uint8 private constant OP_AQUA_EXIT_EXPOSURE_CAP = 0x25;
    uint8 private constant OP_AQUA_EXIT_DISCOUNT_CURVE_1D = 0x26;

    function run() external {
        ZubiDubiConfig.NetworkConfig memory config = ZubiDubiConfig.sepolia();
        ZubiDubiConfig.TokenConfig memory receiptAsset = ZubiDubiConfig.sepoliaReceiptAsset();
        ZubiDubiConfig.TokenConfig memory quoteAsset = ZubiDubiConfig.sepoliaQuoteAsset();

        require(block.chainid == config.chainId, "RunZubiDubiSepoliaRoutedDemo: wrong chain");
        require(config.routeExecutor != address(0), "RunZubiDubiSepoliaRoutedDemo: missing route executor");

        uint256 deployerPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address maker = vm.addr(deployerPk);

        Aqua aqua = Aqua(config.aqua);
        AquaSwapVMRouter router = AquaSwapVMRouter(payable(config.aquaSwapVMRouter));
        ZubiDubiRouteExecutor routeExecutor = ZubiDubiRouteExecutor(config.routeExecutor);
        ZubiDubiExitReceipt receipt = ZubiDubiExitReceipt(config.exitReceipt);
        IERC20 usdc = IERC20(config.usdc);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](3);
        orders[0] = _order(maker, _program(receiptAsset, quoteAsset, 200, 2_400, 500));
        orders[1] = _order(maker, _program(receiptAsset, quoteAsset, 100, 1_200, 300));
        orders[2] = _order(maker, _program(receiptAsset, quoteAsset, 50, 600, 300));

        vm.startBroadcast(deployerPk);

        ZubiDubiDemoSeller seller = new ZubiDubiDemoSeller(routeExecutor, maker);
        IWETH(config.weth).deposit{ value: 0.003 ether }();
        IWETH(config.weth).approve(address(receipt), 0.003 ether);
        receipt.issue(0.003 ether, address(seller));
        usdc.approve(address(aqua), type(uint256).max);

        _ship(aqua, router, orders[0], receiptAsset.token, quoteAsset.token, 0.002 ether, 100e6);
        _ship(aqua, router, orders[1], receiptAsset.token, quoteAsset.token, 0.0015 ether, 100e6);
        _ship(aqua, router, orders[2], receiptAsset.token, quoteAsset.token, 0.001 ether, 100e6);

        vm.stopBroadcast();

        (uint256 quotedIn, uint256 quotedOut,) = routeExecutor.quoteExactIn(
            orders,
            receiptAsset.token,
            quoteAsset.token,
            0.003 ether
        );

        uint256 makerUsdcBefore = usdc.balanceOf(maker);
        uint256 sellerUsdcBefore = usdc.balanceOf(address(seller));
        uint256 sellerReceiptBefore = receipt.balanceOf(address(seller));

        vm.startBroadcast(deployerPk);

        (uint256 totalIn, uint256 totalOut) = seller.sellExactIn(
            orders,
            receiptAsset.token,
            quoteAsset.token,
            0.003 ether,
            quotedOut,
            address(seller)
        );

        vm.stopBroadcast();

        console2.log("ZubiDubi routed Sepolia seller:", address(seller));
        console2.log("Route executor:", address(routeExecutor));
        console2.log("Quoted receipt in:", quotedIn);
        console2.log("Quoted USDC out:", quotedOut);
        console2.log("Executed receipt in:", totalIn);
        console2.log("Executed USDC out:", totalOut);
        console2.log("Maker USDC before:", makerUsdcBefore);
        console2.log("Maker USDC after:", usdc.balanceOf(maker));
        console2.log("Seller USDC before:", sellerUsdcBefore);
        console2.log("Seller USDC after:", usdc.balanceOf(address(seller)));
        console2.log("Seller receipt before:", sellerReceiptBefore);
        console2.log("Seller receipt after:", receipt.balanceOf(address(seller)));
        console2.log("Receipt underlying WETH backing:", IERC20(config.weth).balanceOf(address(receipt)));
    }

    function _ship(
        Aqua aqua,
        AquaSwapVMRouter router,
        ISwapVM.Order memory order,
        address tokenIn,
        address tokenOut,
        uint256,
        uint256 usdcLiquidity
    ) private {
        address[] memory tokens = new address[](2);
        tokens[0] = tokenIn;
        tokens[1] = tokenOut;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0;
        amounts[1] = usdcLiquidity;

        bytes32 shippedHash = aqua.ship(address(router), abi.encode(order), tokens, amounts);
        require(shippedHash == router.hash(order), "RunZubiDubiSepoliaRoutedDemo: order hash mismatch");
    }

    function _program(
        ZubiDubiConfig.TokenConfig memory receiptAsset,
        ZubiDubiConfig.TokenConfig memory quoteAsset,
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps
    ) private view returns (bytes memory) {
        bytes memory args = AquaExitTermArgsBuilder.build(AquaExitTermArgsBuilder.Args({
                baseDiscountBps: baseDiscountBps,
                annualRateBps: annualRateBps,
                maxDiscountBps: maxDiscountBps,
                maturity: uint40(block.timestamp + 30 days),
                maxStaleness: 2 days,
                tokenInDecimals: receiptAsset.decimals,
                tokenOutDecimals: quoteAsset.decimals,
                oracleDecimals: receiptAsset.priceFeedDecimals,
                oracleAddress: receiptAsset.priceFeed,
                maxExposure: 0.01 ether,
                inventorySlopeBps: 250,
                maxNotionalOut: 0,
                liquiditySlopeBps: 50,
                riskTierBps: 25,
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
}
