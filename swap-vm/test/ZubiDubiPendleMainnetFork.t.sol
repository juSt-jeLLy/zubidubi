// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";

import { AquaSwapVMRouter } from "../src/routers/AquaSwapVMRouter.sol";
import { ISwapVM } from "../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../src/libs/MakerTraits.sol";
import { AquaExitTerm, AquaExitTermArgsBuilder } from "../src/instructions/AquaExitTerm.sol";
import { Controls, ControlsArgsBuilder } from "../src/instructions/Controls.sol";
import { ZubiDubiConfig } from "../script/ZubiDubiConfig.sol";
import { ZubiDubiDemoSeller } from "../src/ZubiDubiDemoSeller.sol";
import { ZubiDubiRouteExecutor } from "../src/ZubiDubiRouteExecutor.sol";

import { Program, ProgramBuilder } from "./utils/ProgramBuilder.sol";
import { AquaOpcodesDebug } from "../src/opcodes/AquaOpcodesDebug.sol";

interface IERC20Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

interface IPendleExpiry {
    function expiry() external view returns (uint256);
}

contract ZubiDubiPendleMainnetForkTest is Test, AquaOpcodesDebug {
    using ProgramBuilder for Program;

    Aqua public aqua;
    AquaSwapVMRouter public swapVM;
    ZubiDubiRouteExecutor public routeExecutor;
    ZubiDubiDemoSeller public seller;
    IERC20 public ptUsd3;
    IERC20 public usdc;

    address private makerA = vm.addr(0xA11CE);
    address private makerB = vm.addr(0xB0B);
    address private unavailableMaker = vm.addr(0xBADC0DE);
    address private feeRecipient = vm.addr(0xFEE);

    constructor() AquaOpcodesDebug(address(0)) { }

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
        }
        vm.createSelectFork(rpc);
        require(block.chainid == ZubiDubiConfig.MAINNET_CHAIN_ID, "Wrong fork");

        aqua = new Aqua();
        swapVM = new AquaSwapVMRouter(
            address(aqua),
            ZubiDubiConfig.MAINNET_WETH,
            address(this),
            "ZubiDubiAquaSwapVMRouter",
            "1.0.0"
        );
        routeExecutor = new ZubiDubiRouteExecutor(aqua, swapVM, feeRecipient, 10, 8);
        seller = new ZubiDubiDemoSeller(routeExecutor, address(this));
        ptUsd3 = IERC20(ZubiDubiConfig.MAINNET_PT_USD3_17DEC2026);
        usdc = IERC20(ZubiDubiConfig.MAINNET_USDC);
    }

    function test_ZubiDubiPendleMainnetFork_RoutesRealPtUsd3EarlyExit() public {
        uint40 maturity = uint40(IPendleExpiry(ZubiDubiConfig.MAINNET_PENDLE_USD3_MARKET_17DEC2026).expiry());
        assertEq(maturity, IPendleExpiry(address(ptUsd3)).expiry());
        assertGt(maturity, block.timestamp);
        assertEq(IERC20Metadata(address(ptUsd3)).decimals(), 6);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](3);
        orders[0] = _createExitOrder(
            unavailableMaker,
            _buildPendlePtExitArgs(25, 500, 500, maturity),
            bytes32("unavailable-pendle")
        );
        orders[1] = _createExitOrder(
            makerA,
            _buildPendlePtExitArgs(50, 600, 650, maturity),
            bytes32("maker-a-pendle")
        );
        orders[2] = _createExitOrder(
            makerB,
            _buildPendlePtExitArgs(100, 1_000, 900, maturity),
            bytes32("maker-b-pendle")
        );

        bytes32 unavailableHash = _shipExitOrder(unavailableMaker, orders[0], 100e6);
        bytes32 orderHashA = _shipExitOrder(makerA, orders[1], 100e6);
        bytes32 orderHashB = _shipExitOrder(makerB, orders[2], 150e6);

        deal(address(usdc), makerA, 100e6);
        deal(address(usdc), makerB, 150e6);
        deal(address(ptUsd3), address(seller), 220e6);

        (uint256 quotedIn, uint256 quotedOut, ZubiDubiRouteExecutor.Quote[] memory quotes) =
            routeExecutor.quoteExactIn(orders, address(ptUsd3), address(usdc), 220e6);

        assertEq(quotedIn, 220e6);
        assertGt(quotedOut, 0);
        assertEq(quotes[0].orderHash, unavailableHash);
        assertTrue(quotes[0].skipped);
        assertEq(_deliverableUsdc(orders[0]), 0);
        assertEq(_deliverableUsdc(orders[1]), 100e6);
        assertEq(_deliverableUsdc(orders[2]), 150e6);

        uint256 makerAPtBefore = ptUsd3.balanceOf(makerA);
        uint256 makerBPtBefore = ptUsd3.balanceOf(makerB);
        uint256 sellerUsdcBefore = usdc.balanceOf(address(seller));
        uint256 feeRecipientBefore = usdc.balanceOf(feeRecipient);

        (uint256 totalIn, uint256 totalOut) = seller.sellExactIn(
            orders,
            address(ptUsd3),
            address(usdc),
            220e6,
            quotedOut,
            address(seller)
        );

        assertEq(totalIn, 220e6);
        assertEq(totalOut, quotedOut);
        assertEq(ptUsd3.balanceOf(address(seller)), 0);
        assertEq(usdc.balanceOf(address(seller)) - sellerUsdcBefore, quotedOut);
        assertGt(usdc.balanceOf(feeRecipient) - feeRecipientBefore, 0);
        assertEq(ptUsd3.balanceOf(makerA) + ptUsd3.balanceOf(makerB) - makerAPtBefore - makerBPtBefore, 220e6);

        (, uint256 unavailableUsdcBalance) = aqua.safeBalances(
            unavailableMaker,
            address(swapVM),
            unavailableHash,
            address(ptUsd3),
            address(usdc)
        );
        (, uint256 makerAUsdcBalance) = aqua.safeBalances(
            makerA,
            address(swapVM),
            orderHashA,
            address(ptUsd3),
            address(usdc)
        );
        (, uint256 makerBUsdcBalance) = aqua.safeBalances(
            makerB,
            address(swapVM),
            orderHashB,
            address(ptUsd3),
            address(usdc)
        );

        assertEq(unavailableUsdcBalance, 100e6);
        assertLt(makerAUsdcBalance, 100e6);
        assertLt(makerBUsdcBalance, 150e6);

        console2.log("Pendle PT token:", address(ptUsd3));
        console2.log("Pendle PT symbol:", IERC20Metadata(address(ptUsd3)).symbol());
        console2.log("Pendle market:", ZubiDubiConfig.MAINNET_PENDLE_USD3_MARKET_17DEC2026);
        console2.log("Pendle maturity:", maturity);
        console2.log("Real mainnet USDC:", address(usdc));
        console2.log("Real Chainlink USDC/USD:", ZubiDubiConfig.MAINNET_CHAINLINK_USDC_USD);
        console2.log("PT sold:", totalIn);
        console2.log("USDC paid after DAO fee:", totalOut);
    }

    function _shipExitOrder(
        address maker,
        ISwapVM.Order memory order,
        uint256 usdcLiquidity
    ) internal returns (bytes32 orderHash) {
        orderHash = swapVM.hash(order);

        vm.prank(maker);
        ptUsd3.approve(address(aqua), type(uint256).max);
        vm.prank(maker);
        usdc.approve(address(aqua), type(uint256).max);

        address[] memory tokens = new address[](2);
        tokens[0] = address(ptUsd3);
        tokens[1] = address(usdc);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0;
        amounts[1] = usdcLiquidity;

        vm.prank(maker);
        bytes32 strategyHash = aqua.ship(address(swapVM), abi.encode(order), tokens, amounts);

        assertEq(strategyHash, orderHash);
    }

    function _deliverableUsdc(ISwapVM.Order memory order) internal view returns (uint256) {
        bytes32 orderHash = swapVM.hash(order);
        (, uint256 aquaBalanceOut) = aqua.safeBalances(
            order.maker,
            address(swapVM),
            orderHash,
            address(ptUsd3),
            address(usdc)
        );

        uint256 walletBalance = usdc.balanceOf(order.maker);
        uint256 walletAllowance = usdc.allowance(order.maker, address(aqua));

        return _min(aquaBalanceOut, _min(walletBalance, walletAllowance));
    }

    function _buildPendlePtExitArgs(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity
    ) internal view returns (bytes memory) {
        return AquaExitTermArgsBuilder.build(AquaExitTermArgsBuilder.Args({
            baseDiscountBps: baseDiscountBps,
            annualRateBps: annualRateBps,
            maxDiscountBps: maxDiscountBps,
            maturity: maturity,
            maxStaleness: 2 days,
            tokenInDecimals: 6,
            tokenOutDecimals: 6,
            oracleDecimals: 8,
            oracleAddress: ZubiDubiConfig.MAINNET_CHAINLINK_USDC_USD,
            maxExposure: 1_000e6,
            inventorySlopeBps: 150,
            maxNotionalOut: 0,
            liquiditySlopeBps: 25,
            riskTierBps: 10,
            minMaturity: uint40(block.timestamp + 1 days),
            maxMaturity: type(uint40).max,
            allowedTokenIn: ZubiDubiConfig.MAINNET_PT_USD3_17DEC2026,
            allowedTokenOut: ZubiDubiConfig.MAINNET_USDC
        }));
    }

    function _createExitOrder(
        address maker,
        bytes memory args,
        bytes32 saltSeed
    ) internal pure returns (ISwapVM.Order memory order) {
        Program memory p = ProgramBuilder.init(_opcodes());

        bytes memory program = bytes.concat(
            p.build(AquaExitTerm._aquaExitBackingOracleCheck, args),
            p.build(AquaExitTerm._aquaExitExposureCap, args),
            p.build(AquaExitTerm._aquaExitDiscountCurve1D, args),
            p.build(Controls._salt, ControlsArgsBuilder.buildSalt(uint64(uint256(saltSeed))))
        );

        order = MakerTraitsLib.build(MakerTraitsLib.Args({
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

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
