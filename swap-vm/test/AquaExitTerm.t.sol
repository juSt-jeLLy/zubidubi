// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { TokenMock } from "@1inch/solidity-utils/contracts/mocks/TokenMock.sol";

import { ISwapVM } from "../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../src/libs/MakerTraits.sol";
import { AquaExitTerm, AquaExitTermArgsBuilder } from "../src/instructions/AquaExitTerm.sol";
import { Controls, ControlsArgsBuilder } from "../src/instructions/Controls.sol";

import { AquaSwapVMTest } from "./base/AquaSwapVMTest.sol";
import { Program, ProgramBuilder } from "./utils/ProgramBuilder.sol";
import { MockPriceOracle } from "./mocks/MockPriceOracle.sol";

contract AquaExitTermTest is AquaSwapVMTest {
    using ProgramBuilder for Program;

    TokenMock public exitReceipt;
    TokenMock public usdc;
    MockPriceOracle public oracle;

    function setUp() public override {
        super.setUp();

        exitReceipt = new TokenMock("Mock Delayed Exit Receipt", "mxETH");
        usdc = new TokenMock("Mock USDC", "mUSDC");
        oracle = new MockPriceOracle(3000e18, 18);
    }

    function test_AquaExitTerm_ExactInSellsDelayedReceiptForUsdc() public {
        uint256 receiptAmount = 1 ether;
        uint256 makerUsdcLiquidity = 10_000 ether;
        uint256 makerReceiptCapacity = 5 ether;

        (ISwapVM.Order memory order, bytes32 orderHash) = _shipDefaultAquaExitOrder(makerReceiptCapacity, makerUsdcLiquidity);
        SwapProgram memory swapProgram = _prepareSwap(receiptAmount, makerUsdcLiquidity, true);

        (uint256 quotedAmountIn, uint256 quotedAmountOut) = quote(swapProgram, order);
        assertEq(quotedAmountIn, receiptAmount);
        assertEq(quotedAmountOut, 2_940.6 ether);

        (uint256 amountIn, uint256 amountOut) = swap(swapProgram, order);
        assertEq(amountIn, quotedAmountIn);
        assertEq(amountOut, quotedAmountOut);

        assertEq(exitReceipt.balanceOf(address(taker)), 0);
        assertEq(usdc.balanceOf(address(taker)), 2_940.6 ether);
        assertEq(exitReceipt.balanceOf(maker), receiptAmount);
        assertEq(usdc.balanceOf(maker), makerUsdcLiquidity - 2_940.6 ether);

        (uint256 receiptVirtualBalance, uint256 usdcVirtualBalance) = aqua.safeBalances(
            maker,
            address(swapVM),
            orderHash,
            address(exitReceipt),
            address(usdc)
        );

        assertEq(receiptVirtualBalance, receiptAmount);
        assertEq(usdcVirtualBalance, makerUsdcLiquidity - 2_940.6 ether);
    }

    function test_AquaExitTerm_PricesEighteenDecimalReceiptAgainstSixDecimalUsdc() public {
        oracle = new MockPriceOracle(3000e8, 8);

        uint256 receiptAmount = 1 ether;
        uint256 makerUsdcLiquidity = 10_000e6;
        uint256 makerReceiptCapacity = 5 ether;

        ISwapVM.Order memory order = _createAquaExitOrder(
            _buildAquaExitArgsWithDecimals(
                100,
                1200,
                300,
                uint40(block.timestamp + 30 days),
                1 hours,
                18,
                6,
                8,
                5 ether,
                0
            )
        );
        _shipAquaExitOrderFor(maker, order, makerReceiptCapacity, makerUsdcLiquidity);

        SwapProgram memory swapProgram = _prepareSwap(receiptAmount, makerUsdcLiquidity, true);

        (uint256 quotedAmountIn, uint256 quotedAmountOut) = quote(swapProgram, order);
        assertEq(quotedAmountIn, receiptAmount);
        assertEq(quotedAmountOut, 2_940_600_000);

        (uint256 amountIn, uint256 amountOut) = swap(swapProgram, order);
        assertEq(amountIn, receiptAmount);
        assertEq(amountOut, 2_940_600_000);

        assertEq(usdc.balanceOf(address(taker)), 2_940_600_000);
        assertEq(usdc.balanceOf(maker), makerUsdcLiquidity - 2_940_600_000);
    }

    function test_AquaExitTerm_LongerMaturityGivesLargerDiscount() public {
        ISwapVM.Order memory shortOrder = _createAquaExitOrder(_buildAquaExitArgs(100, 1200, 2000, uint40(block.timestamp + 30 days), 1 hours));
        ISwapVM.Order memory longOrder = _createAquaExitOrder(_buildAquaExitArgs(100, 1200, 2000, uint40(block.timestamp + 180 days), 1 hours));

        _shipAquaExitOrderFor(maker, shortOrder, 5 ether, 10_000 ether);
        _shipAquaExitOrderFor(maker, longOrder, 5 ether, 10_000 ether);

        SwapProgram memory swapProgram = _prepareSwap(1 ether, 20_000 ether, true);

        (, uint256 shortAmountOut) = quote(swapProgram, shortOrder);
        (, uint256 longAmountOut) = quote(swapProgram, longOrder);

        assertEq(shortAmountOut, 2_940.6 ether);
        assertEq(longAmountOut, 2_792.7 ether);
        assertLt(longAmountOut, shortAmountOut);
    }

    function test_AquaExitTerm_MaturedReceiptUsesBaseDiscountOnly() public {
        uint256 makerUsdcLiquidity = 10_000 ether;
        ISwapVM.Order memory order = _createAquaExitOrder(_buildAquaExitArgs(100, 1200, 300, uint40(block.timestamp + 30 days), 1 hours));
        _shipAquaExitOrderFor(maker, order, 5 ether, makerUsdcLiquidity);

        vm.warp(block.timestamp + 31 days);
        oracle.setUpdatedAt(block.timestamp);

        SwapProgram memory swapProgram = _prepareSwap(1 ether, makerUsdcLiquidity, true);
        (, uint256 amountOut) = quote(swapProgram, order);

        assertEq(amountOut, 2_970 ether);
    }

    function test_AquaExitTerm_InventoryExposureMakesLaterFillsCheaperForMaker() public {
        uint256 makerUsdcLiquidity = 10_000 ether;
        ISwapVM.Order memory order = _createAquaExitOrder(
            _buildAquaExitArgsWithRisk(
                100,
                1_200,
                1_000,
                uint40(block.timestamp + 30 days),
                1 hours,
                2 ether,
                500
            )
        );
        bytes32 orderHash = _shipAquaExitOrderFor(maker, order, 2 ether, makerUsdcLiquidity);

        exitReceipt.mint(address(taker), 2 ether);
        usdc.mint(maker, makerUsdcLiquidity);

        uint256 firstOut = _swapExactIn(order, 1 ether);
        uint256 secondOut = _swapExactIn(order, 1 ether);

        assertEq(firstOut, 2_865.6 ether);
        assertEq(secondOut, 2_790.6 ether);
        assertLt(secondOut, firstOut);
        _assertAquaBalances(maker, orderHash, 2 ether, makerUsdcLiquidity - firstOut - secondOut);
    }

    function test_AquaExitTerm_RevertsOnStaleOracle() public {
        ISwapVM.Order memory order = _createAquaExitOrder(_buildAquaExitArgs(100, 1200, 300, uint40(block.timestamp + 30 days), 1 hours));
        _shipAquaExitOrderFor(maker, order, 5 ether, 10_000 ether);

        vm.warp(block.timestamp + 2 hours);
        SwapProgram memory swapProgram = _prepareSwap(1 ether, 10_000 ether, true);

        vm.expectRevert(abi.encodeWithSelector(AquaExitTerm.AquaExitTermOraclePriceStale.selector, block.timestamp, uint256(1), uint32(1 hours)));
        _quoteDirect(swapProgram, order);
    }

    function test_AquaExitTerm_RevertsWhenDiscountExceedsMakerCap() public {
        ISwapVM.Order memory order = _createAquaExitOrder(_buildAquaExitArgs(100, 1200, 150, uint40(block.timestamp + 30 days), 1 hours));
        _shipAquaExitOrderFor(maker, order, 5 ether, 10_000 ether);

        SwapProgram memory swapProgram = _prepareSwap(1 ether, 10_000 ether, true);

        vm.expectRevert(abi.encodeWithSelector(AquaExitTerm.AquaExitTermDiscountTooHigh.selector, uint256(198), uint32(150)));
        _quoteDirect(swapProgram, order);
    }

    function test_AquaExitTerm_RevertsWhenTakerExceedsMakerReceiptCapacity() public {
        (ISwapVM.Order memory order,) = _shipDefaultAquaExitOrder(0.5 ether, 10_000 ether);
        SwapProgram memory swapProgram = _prepareSwap(1 ether, 10_000 ether, true);

        vm.expectRevert(abi.encodeWithSelector(AquaExitTerm.AquaExitTermExposureLimitExceeded.selector, uint256(1 ether), uint128(0.5 ether)));
        _quoteDirect(swapProgram, order);
    }

    function test_AquaExitTerm_RevertsWhenMakerOutputLiquidityInsufficient() public {
        (ISwapVM.Order memory order,) = _shipDefaultAquaExitOrder(5 ether, 2_000 ether);
        SwapProgram memory swapProgram = _prepareSwap(1 ether, 2_000 ether, true);

        vm.expectRevert(abi.encodeWithSelector(AquaExitTerm.AquaExitTermInsufficientMakerOutputLiquidity.selector, uint256(2_940.6 ether), uint256(2_000 ether)));
        _quoteDirect(swapProgram, order);
    }

    function test_AquaExitTerm_ExactOutComputesRequiredReceiptAmount() public {
        uint256 makerUsdcLiquidity = 10_000 ether;
        uint256 requestedUsdc = 1_000 ether;

        (ISwapVM.Order memory order,) = _shipDefaultAquaExitOrder(5 ether, makerUsdcLiquidity);
        SwapProgram memory swapProgram = _prepareSwap(requestedUsdc, makerUsdcLiquidity, false);

        (uint256 quotedAmountIn, uint256 quotedAmountOut) = quote(swapProgram, order);
        assertEq(quotedAmountOut, requestedUsdc);
        assertEq(quotedAmountIn, 340_066_653_064_000_545);

        exitReceipt.mint(address(taker), quotedAmountIn);

        (uint256 amountIn, uint256 amountOut) = swap(swapProgram, order);
        assertEq(amountIn, quotedAmountIn);
        assertEq(amountOut, requestedUsdc);

        assertEq(exitReceipt.balanceOf(maker), quotedAmountIn);
        assertEq(usdc.balanceOf(address(taker)), requestedUsdc);
    }

    function test_AquaExitTerm_SplitsOneExitAcrossMultipleMakerCurves() public {
        address makerA = vm.addr(0xA11CE);
        address makerB = vm.addr(0xB0B);
        address makerC = vm.addr(0xCAFE);
        uint256 makerUsdcLiquidity = 10_000 ether;

        ISwapVM.Order memory orderA = _createAquaExitOrderFor(
            makerA,
            _buildAquaExitArgs(50, 600, 300, uint40(block.timestamp + 30 days), 1 hours),
            bytes32("maker-a")
        );
        ISwapVM.Order memory orderB = _createAquaExitOrderFor(
            makerB,
            _buildAquaExitArgs(100, 1200, 300, uint40(block.timestamp + 30 days), 1 hours),
            bytes32("maker-b")
        );
        ISwapVM.Order memory orderC = _createAquaExitOrderFor(
            makerC,
            _buildAquaExitArgs(200, 2400, 500, uint40(block.timestamp + 30 days), 1 hours),
            bytes32("maker-c")
        );

        bytes32 orderHashA = _shipAquaExitOrderFor(makerA, orderA, 1 ether, makerUsdcLiquidity);
        bytes32 orderHashB = _shipAquaExitOrderFor(makerB, orderB, 1.5 ether, makerUsdcLiquidity);
        bytes32 orderHashC = _shipAquaExitOrderFor(makerC, orderC, 2 ether, makerUsdcLiquidity);

        usdc.mint(makerA, makerUsdcLiquidity);
        usdc.mint(makerB, makerUsdcLiquidity);
        usdc.mint(makerC, makerUsdcLiquidity);
        exitReceipt.mint(address(taker), 3 ether);

        uint256 outA = _swapExactIn(orderA, 1 ether);
        uint256 outB = _swapExactIn(orderB, 1.5 ether);
        uint256 outC = _swapExactIn(orderC, 0.5 ether);

        assertEq(outA, 2_970.3 ether);
        assertEq(outB, 4_410.9 ether);
        assertEq(outC, 1_440.45 ether);
        assertEq(outA + outB + outC, 8_821.65 ether);

        assertEq(exitReceipt.balanceOf(address(taker)), 0);
        assertEq(usdc.balanceOf(address(taker)), 8_821.65 ether);

        assertEq(exitReceipt.balanceOf(makerA), 1 ether);
        assertEq(exitReceipt.balanceOf(makerB), 1.5 ether);
        assertEq(exitReceipt.balanceOf(makerC), 0.5 ether);

        assertEq(usdc.balanceOf(makerA), makerUsdcLiquidity - outA);
        assertEq(usdc.balanceOf(makerB), makerUsdcLiquidity - outB);
        assertEq(usdc.balanceOf(makerC), makerUsdcLiquidity - outC);

        _assertAquaBalances(makerA, orderHashA, 1 ether, makerUsdcLiquidity - outA);
        _assertAquaBalances(makerB, orderHashB, 1.5 ether, makerUsdcLiquidity - outB);
        _assertAquaBalances(makerC, orderHashC, 0.5 ether, makerUsdcLiquidity - outC);
    }

    function _shipDefaultAquaExitOrder(
        uint256 makerReceiptCapacity,
        uint256 makerUsdcLiquidity
    ) internal returns (ISwapVM.Order memory order, bytes32 orderHash) {
        order = _createAquaExitOrder(
            _buildAquaExitArgsWithRisk(
                100,
                1200,
                300,
                uint40(block.timestamp + 30 days),
                1 hours,
                uint128(makerReceiptCapacity),
                0
            )
        );
        orderHash = _shipAquaExitOrderFor(maker, order, makerReceiptCapacity, makerUsdcLiquidity);
    }

    function _prepareSwap(
        uint256 amount,
        uint256 makerUsdcAmount,
        bool isExactIn
    ) internal returns (SwapProgram memory swapProgram) {
        if (isExactIn) {
            exitReceipt.mint(address(taker), amount);
        }
        usdc.mint(maker, makerUsdcAmount);

        swapProgram = SwapProgram({
            amount: amount,
            taker: taker,
            tokenA: exitReceipt,
            tokenB: usdc,
            zeroForOne: true,
            isExactIn: isExactIn
        });
    }

    function _buildAquaExitArgs(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness
    ) internal view returns (bytes memory) {
        return _buildAquaExitArgsWithDecimals(
            baseDiscountBps,
            annualRateBps,
            maxDiscountBps,
            maturity,
            maxStaleness,
            18,
            18,
            18,
            5 ether,
            0
        );
    }

    function _buildAquaExitArgsWithRisk(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness,
        uint128 maxExposure,
        uint32 inventorySlopeBps
    ) internal view returns (bytes memory) {
        return _buildAquaExitArgsWithDecimals(
            baseDiscountBps,
            annualRateBps,
            maxDiscountBps,
            maturity,
            maxStaleness,
            18,
            18,
            18,
            maxExposure,
            inventorySlopeBps
        );
    }

    function _buildAquaExitArgsWithDecimals(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness,
        uint8 tokenInDecimals,
        uint8 tokenOutDecimals,
        uint8 oracleDecimals,
        uint128 maxExposure,
        uint32 inventorySlopeBps
    ) internal view returns (bytes memory) {
        return AquaExitTermArgsBuilder.build({
            baseDiscountBps: baseDiscountBps,
            annualRateBps: annualRateBps,
            maxDiscountBps: maxDiscountBps,
            maturity: maturity,
            maxStaleness: maxStaleness,
            tokenInDecimals: tokenInDecimals,
            tokenOutDecimals: tokenOutDecimals,
            oracleDecimals: oracleDecimals,
            oracleAddress: address(oracle),
            maxExposure: maxExposure,
            inventorySlopeBps: inventorySlopeBps
        });
    }

    function _quoteDirect(
        SwapProgram memory swapProgram,
        ISwapVM.Order memory order
    ) internal view returns (uint256 amountIn, uint256 amountOut) {
        (address tokenIn, address tokenOut) = getTokenAddresses(swapProgram);
        bytes memory sigAndTakerData = abi.encodePacked(takerData(address(swapProgram.taker), swapProgram.isExactIn));

        (amountIn, amountOut,) = ISwapVM(address(swapVM)).quote(
            order,
            tokenIn,
            tokenOut,
            swapProgram.amount,
            sigAndTakerData
        );
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

    function _shipAquaExitOrderFor(
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

    function _createAquaExitOrder(bytes memory args) internal view returns (ISwapVM.Order memory order) {
        return _createAquaExitOrderFor(maker, args, keccak256(abi.encode(block.timestamp, args)));
    }

    function _createAquaExitOrderFor(
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
}
