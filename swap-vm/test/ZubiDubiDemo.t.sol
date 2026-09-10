// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm/blob/main/LICENSES/SwapVM-1.1.txt

import { console2 } from "forge-std/console2.sol";
import { TokenMock } from "@1inch/solidity-utils/contracts/mocks/TokenMock.sol";

import { ISwapVM } from "../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../src/libs/MakerTraits.sol";
import { TakerTraitsLib } from "../src/libs/TakerTraits.sol";
import { AquaExitTerm, AquaExitTermArgsBuilder } from "../src/instructions/AquaExitTerm.sol";
import { Controls, ControlsArgsBuilder } from "../src/instructions/Controls.sol";

import { AquaSwapVMTest } from "./base/AquaSwapVMTest.sol";
import { Program, ProgramBuilder } from "./utils/ProgramBuilder.sol";
import { MockPriceOracle } from "./mocks/MockPriceOracle.sol";

contract ZubiDubiDemoTest is AquaSwapVMTest {
    using ProgramBuilder for Program;

    TokenMock public exitReceipt;
    TokenMock public usdc;
    MockPriceOracle public oracle;

    function setUp() public override {
        super.setUp();

        exitReceipt = new TokenMock("ZubiDubi Mock Delayed Exit Receipt", "mxETH");
        usdc = new TokenMock("ZubiDubi Mock USDC", "mUSDC");
        oracle = new MockPriceOracle(3000e18, 18);
    }

    function test_ZubiDubiDemo_RoutesExitAcrossSolventAquaMakers() public {
        address unavailableMaker = vm.addr(0xBADC0DE);
        address makerA = vm.addr(0xA11CE);
        address makerB = vm.addr(0xB0B);
        address makerC = vm.addr(0xCAFE);

        ISwapVM.Order memory unavailableOrder = _createExitOrderFor(
            unavailableMaker,
            _buildAquaExitArgs(25, 500, 250, uint40(block.timestamp + 30 days), 1 hours),
            bytes32("unavailable-maker")
        );
        ISwapVM.Order memory orderA = _createExitOrderFor(
            makerA,
            _buildAquaExitArgs(50, 600, 300, uint40(block.timestamp + 30 days), 1 hours),
            bytes32("maker-a")
        );
        ISwapVM.Order memory orderB = _createExitOrderFor(
            makerB,
            _buildAquaExitArgs(100, 1200, 300, uint40(block.timestamp + 30 days), 1 hours),
            bytes32("maker-b")
        );
        ISwapVM.Order memory orderC = _createExitOrderFor(
            makerC,
            _buildAquaExitArgs(200, 2400, 500, uint40(block.timestamp + 30 days), 1 hours),
            bytes32("maker-c")
        );

        bytes32 unavailableHash = _shipExitOrderFor(unavailableMaker, unavailableOrder, 10 ether, 10_000 ether);
        bytes32 orderHashA = _shipExitOrderFor(makerA, orderA, 1 ether, 10_000 ether);
        bytes32 orderHashB = _shipExitOrderFor(makerB, orderB, 1.5 ether, 10_000 ether);
        bytes32 orderHashC = _shipExitOrderFor(makerC, orderC, 2 ether, 10_000 ether);

        usdc.mint(makerA, 10_000 ether);
        usdc.mint(makerB, 10_000 ether);
        usdc.mint(makerC, 10_000 ether);
        exitReceipt.mint(address(taker), 3 ether);

        console2.log("ZubiDubi demo: taker exits 3 mxETH immediately for wallet-held maker USDC");

        uint256 skipped;
        uint256 totalIn;
        uint256 totalOut;

        (skipped, totalIn, totalOut) = _tryRouteLeg(unavailableOrder, 0.5 ether, skipped, totalIn, totalOut);
        (skipped, totalIn, totalOut) = _tryRouteLeg(orderA, 1 ether, skipped, totalIn, totalOut);
        (skipped, totalIn, totalOut) = _tryRouteLeg(orderB, 1.5 ether, skipped, totalIn, totalOut);
        (skipped, totalIn, totalOut) = _tryRouteLeg(orderC, 0.5 ether, skipped, totalIn, totalOut);

        assertEq(skipped, 1);
        assertEq(totalIn, 3 ether);
        assertEq(totalOut, 8_821.65 ether);

        assertEq(exitReceipt.balanceOf(address(taker)), 0);
        assertEq(usdc.balanceOf(address(taker)), 8_821.65 ether);

        assertEq(exitReceipt.balanceOf(unavailableMaker), 0);
        assertEq(usdc.balanceOf(address(taker)), totalOut);

        _assertAquaBalances(unavailableMaker, unavailableHash, 0, 10_000 ether);
        assertEq(usdc.balanceOf(unavailableMaker), 0);
        _assertAquaBalances(makerA, orderHashA, 1 ether, 10_000 ether - 2_970.3 ether);
        _assertAquaBalances(makerB, orderHashB, 1.5 ether, 10_000 ether - 4_410.9 ether);
        _assertAquaBalances(makerC, orderHashC, 0.5 ether, 10_000 ether - 1_440.45 ether);

        console2.log("ZubiDubi demo filled mxETH:", totalIn);
        console2.log("ZubiDubi demo paid mUSDC:", totalOut);
        console2.log("ZubiDubi skipped insolvent makers:", skipped);
    }

    function _tryRouteLeg(
        ISwapVM.Order memory order,
        uint256 amountIn,
        uint256 skipped,
        uint256 totalIn,
        uint256 totalOut
    ) internal returns (uint256, uint256, uint256) {
        (bool canFill, uint256 quotedOut) = _tryQuoteExactIn(order, amountIn);

        if (!canFill) {
            console2.log("Skipped maker with unavailable deliverable liquidity:", order.maker);
            return (skipped + 1, totalIn, totalOut);
        }

        if (_deliverableUsdc(order) < quotedOut) {
            console2.log("Skipped maker with virtual liquidity but insufficient wallet liquidity:", order.maker);
            return (skipped + 1, totalIn, totalOut);
        }

        uint256 amountOut = _swapExactIn(order, amountIn);
        assertEq(amountOut, quotedOut);

        console2.log("Filled maker:", order.maker);
        console2.log("  mxETH in:", amountIn);
        console2.log("  mUSDC out:", amountOut);

        return (skipped, totalIn + amountIn, totalOut + amountOut);
    }

    function _tryQuoteExactIn(
        ISwapVM.Order memory order,
        uint256 amountIn
    ) internal returns (bool canFill, uint256 amountOut) {
        bytes memory sigAndTakerData = abi.encodePacked(_takerData(address(taker), true));

        try ISwapVM(address(swapVM)).quote(
            order,
            address(exitReceipt),
            address(usdc),
            amountIn,
            sigAndTakerData
        ) returns (uint256, uint256 quotedAmountOut, bytes32) {
            return (true, quotedAmountOut);
        } catch {
            return (false, 0);
        }
    }

    function _deliverableUsdc(ISwapVM.Order memory order) internal view returns (uint256) {
        bytes32 orderHash = swapVM.hash(order);
        (, uint256 aquaBalanceOut) = aqua.safeBalances(
            order.maker,
            address(swapVM),
            orderHash,
            address(exitReceipt),
            address(usdc)
        );

        uint256 walletBalance = usdc.balanceOf(order.maker);
        uint256 walletAllowance = usdc.allowance(order.maker, address(aqua));

        return _min(aquaBalanceOut, _min(walletBalance, walletAllowance));
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _swapExactIn(ISwapVM.Order memory order, uint256 amountIn) internal returns (uint256 amountOut) {
        SwapProgram memory swapProgram = SwapProgram({
            amount: amountIn,
            taker: taker,
            tokenA: exitReceipt,
            tokenB: usdc,
            zeroForOne: true,
            isExactIn: true
        });

        (, amountOut) = swap(swapProgram, order);
    }

    function _buildAquaExitArgs(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness
    ) internal view returns (bytes memory) {
        return AquaExitTermArgsBuilder.build(AquaExitTermArgsBuilder.Args({
            baseDiscountBps: baseDiscountBps,
            annualRateBps: annualRateBps,
            maxDiscountBps: maxDiscountBps,
            maturity: maturity,
            maxStaleness: maxStaleness,
            tokenInDecimals: 18,
            tokenOutDecimals: 18,
            oracleDecimals: 18,
            oracleAddress: address(oracle),
            maxExposure: 5 ether,
            inventorySlopeBps: 0,
            maxNotionalOut: 0,
            liquiditySlopeBps: 0,
            riskTierBps: 0,
            minMaturity: 0,
            maxMaturity: type(uint40).max,
            allowedTokenIn: address(exitReceipt),
            allowedTokenOut: address(usdc)
        }));
    }

    function _shipExitOrderFor(
        address makerAddress,
        ISwapVM.Order memory order,
        uint256,
        uint256 usdcLiquidity
    ) internal returns (bytes32 orderHash) {
        orderHash = swapVM.hash(order);

        vm.prank(makerAddress);
        exitReceipt.approve(address(aqua), type(uint256).max);
        vm.prank(makerAddress);
        usdc.approve(address(aqua), type(uint256).max);

        address[] memory tokens = new address[](2);
        tokens[0] = address(exitReceipt);
        tokens[1] = address(usdc);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0;
        amounts[1] = usdcLiquidity;

        vm.prank(makerAddress);
        bytes32 strategyHash = aqua.ship(address(swapVM), abi.encode(order), tokens, amounts);

        assertEq(strategyHash, orderHash);
    }

    function _assertAquaBalances(
        address makerAddress,
        bytes32 orderHash,
        uint256 expectedReceiptBalance,
        uint256 expectedUsdcBalance
    ) internal view {
        (uint256 receiptVirtualBalance, uint256 usdcVirtualBalance) = aqua.safeBalances(
            makerAddress,
            address(swapVM),
            orderHash,
            address(exitReceipt),
            address(usdc)
        );

        assertEq(receiptVirtualBalance, expectedReceiptBalance);
        assertEq(usdcVirtualBalance, expectedUsdcBalance);
    }

    function _createExitOrderFor(
        address makerAddress,
        bytes memory args,
        bytes32 saltSeed
    ) internal pure returns (ISwapVM.Order memory order) {
        Program memory p = ProgramBuilder.init(_opcodes());

        bytes memory program = bytes.concat(
            p.build(AquaExitTerm._aquaExitTermSwap1D, args),
            p.build(Controls._salt, ControlsArgsBuilder.buildSalt(uint64(uint256(saltSeed))))
        );

        order = MakerTraitsLib.build(MakerTraitsLib.Args({
            maker: makerAddress,
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

    function _takerData(address takerAddress, bool isExactIn) internal pure returns (bytes memory) {
        return TakerTraitsLib.build(TakerTraitsLib.Args({
            taker: takerAddress,
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
