// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm/blob/main/LICENSES/SwapVM-1.1.txt

import { TokenMock } from "@1inch/solidity-utils/contracts/mocks/TokenMock.sol";

import { ISwapVM } from "../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../src/libs/MakerTraits.sol";
import { AquaExitTerm, AquaExitTermArgsBuilder } from "../src/instructions/AquaExitTerm.sol";
import { Controls, ControlsArgsBuilder } from "../src/instructions/Controls.sol";
import { ZubiDubiRouteExecutor } from "../src/ZubiDubiRouteExecutor.sol";

import { AquaSwapVMTest } from "./base/AquaSwapVMTest.sol";
import { Program, ProgramBuilder } from "./utils/ProgramBuilder.sol";
import { MockPriceOracle } from "./mocks/MockPriceOracle.sol";

contract ZubiDubiRouteExecutorTest is AquaSwapVMTest {
    using ProgramBuilder for Program;

    TokenMock public exitReceipt;
    TokenMock public usdc;
    MockPriceOracle public oracle;
    ZubiDubiRouteExecutor public routeExecutor;

    address public seller = vm.addr(0x5E11);
    address public recipient = vm.addr(0xBEEF);
    address public feeRecipient = vm.addr(0xFEE);

    function setUp() public override {
        super.setUp();

        exitReceipt = new TokenMock("ZubiDubi Mock Delayed Exit Receipt", "mxETH");
        usdc = new TokenMock("ZubiDubi Mock USDC", "mUSDC");
        oracle = new MockPriceOracle(3000e18, 18);
        routeExecutor = new ZubiDubiRouteExecutor(aqua, swapVM, feeRecipient, 10);
    }

    function test_ZubiDubiRouteExecutor_SkipsInsolventAndSplitsBestFirst() public {
        address unavailableMaker = vm.addr(0xBADC0DE);
        address makerA = vm.addr(0xA11CE);
        address makerB = vm.addr(0xB0B);
        address makerC = vm.addr(0xCAFE);

        ISwapVM.Order memory unavailableOrder = _createExitOrderFor(
            unavailableMaker,
            _buildAquaExitArgsWithExposure(25, 500, 250, uint40(block.timestamp + 30 days), 1 hours, 10 ether),
            bytes32("unavailable-maker")
        );
        ISwapVM.Order memory orderA = _createExitOrderFor(
            makerA,
            _buildAquaExitArgsWithExposure(50, 600, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("maker-a")
        );
        ISwapVM.Order memory orderB = _createExitOrderFor(
            makerB,
            _buildAquaExitArgsWithExposure(100, 1200, 300, uint40(block.timestamp + 30 days), 1 hours, 1.5 ether),
            bytes32("maker-b")
        );
        ISwapVM.Order memory orderC = _createExitOrderFor(
            makerC,
            _buildAquaExitArgsWithExposure(200, 2400, 500, uint40(block.timestamp + 30 days), 1 hours, 2 ether),
            bytes32("maker-c")
        );

        bytes32 unavailableHash = _shipExitOrderFor(unavailableMaker, unavailableOrder, 10 ether, 10_000 ether);
        bytes32 orderHashA = _shipExitOrderFor(makerA, orderA, 1 ether, 10_000 ether);
        bytes32 orderHashB = _shipExitOrderFor(makerB, orderB, 1.5 ether, 10_000 ether);
        bytes32 orderHashC = _shipExitOrderFor(makerC, orderC, 2 ether, 10_000 ether);

        usdc.mint(makerA, 10_000 ether);
        usdc.mint(makerB, 10_000 ether);
        usdc.mint(makerC, 10_000 ether);
        exitReceipt.mint(seller, 3 ether);

        vm.prank(seller);
        exitReceipt.approve(address(routeExecutor), 3 ether);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](4);
        orders[0] = unavailableOrder;
        orders[1] = orderC;
        orders[2] = orderB;
        orders[3] = orderA;

        (uint256 quotedIn, uint256 quotedOut,) = routeExecutor.quoteExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            3 ether
        );

        assertEq(quotedIn, 3 ether);
        assertEq(quotedOut, 8_812.82835 ether);

        vm.prank(seller);
        (uint256 totalIn, uint256 totalOut) = routeExecutor.routeExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            3 ether,
            8_800 ether,
            recipient
        );

        assertEq(totalIn, 3 ether);
        assertEq(totalOut, 8_812.82835 ether);
        assertEq(exitReceipt.balanceOf(seller), 0);
        assertEq(usdc.balanceOf(recipient), 8_812.82835 ether);
        assertEq(usdc.balanceOf(feeRecipient), 8.82165 ether);
        assertEq(usdc.balanceOf(address(routeExecutor)), 0);
        assertEq(exitReceipt.balanceOf(address(routeExecutor)), 0);

        assertEq(exitReceipt.balanceOf(unavailableMaker), 0);
        assertEq(exitReceipt.balanceOf(makerA), 1 ether);
        assertEq(exitReceipt.balanceOf(makerB), 1.5 ether);
        assertEq(exitReceipt.balanceOf(makerC), 0.5 ether);

        _assertAquaBalances(unavailableMaker, unavailableHash, 0, 10_000 ether);
        _assertAquaBalances(makerA, orderHashA, 1 ether, 10_000 ether - 2_970.3 ether);
        _assertAquaBalances(makerB, orderHashB, 1.5 ether, 10_000 ether - 4_410.9 ether);
        _assertAquaBalances(makerC, orderHashC, 0.5 ether, 10_000 ether - 1_440.45 ether);
    }

    function test_ZubiDubiRouteExecutor_RevertsWhenAggregateRouteCannotFill() public {
        address makerA = vm.addr(0xA11CE);
        ISwapVM.Order memory orderA = _createExitOrderFor(
            makerA,
            _buildAquaExitArgsWithExposure(50, 600, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("maker-a")
        );
        _shipExitOrderFor(makerA, orderA, 1 ether, 10_000 ether);

        usdc.mint(makerA, 10_000 ether);
        exitReceipt.mint(seller, 3 ether);

        vm.prank(seller);
        exitReceipt.approve(address(routeExecutor), 3 ether);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](1);
        orders[0] = orderA;

        vm.expectRevert(abi.encodeWithSelector(
            ZubiDubiRouteExecutor.ZubiDubiRouteExecutorInsufficientFill.selector,
            3 ether,
            1 ether
        ));
        vm.prank(seller);
        routeExecutor.routeExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            3 ether,
            0,
            recipient
        );
    }

    function test_ZubiDubiRouteExecutor_DoesNotDoubleCountSameMakerWalletLiquidity() public {
        address sharedMaker = vm.addr(0xA11CE);

        ISwapVM.Order memory orderA = _createExitOrderFor(
            sharedMaker,
            _buildAquaExitArgsWithExposure(50, 600, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("maker-a")
        );
        ISwapVM.Order memory orderB = _createExitOrderFor(
            sharedMaker,
            _buildAquaExitArgsWithExposure(100, 1200, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("maker-b")
        );

        _shipExitOrderFor(sharedMaker, orderA, 1 ether, 10_000 ether);
        _shipExitOrderFor(sharedMaker, orderB, 1 ether, 10_000 ether);

        usdc.mint(sharedMaker, 4_000 ether);
        exitReceipt.mint(seller, 2 ether);

        vm.prank(seller);
        exitReceipt.approve(address(routeExecutor), 2 ether);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](2);
        orders[0] = orderA;
        orders[1] = orderB;

        (uint256 quotedIn, uint256 quotedOut,) = routeExecutor.quoteExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            2 ether
        );

        assertLt(quotedIn, 2 ether);
        assertLe(quotedOut, 4_000 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                ZubiDubiRouteExecutor.ZubiDubiRouteExecutorInsufficientFill.selector, 2 ether, quotedIn
            )
        );
        vm.prank(seller);
        routeExecutor.routeExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            2 ether,
            0,
            recipient
        );
    }

    function _buildAquaExitArgs(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness
    ) internal view returns (bytes memory) {
        return _buildAquaExitArgsWithExposure(
            baseDiscountBps,
            annualRateBps,
            maxDiscountBps,
            maturity,
            maxStaleness,
            5 ether
        );
    }

    function _buildAquaExitArgsWithExposure(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness,
        uint128 maxExposure
    ) internal view returns (bytes memory) {
        return AquaExitTermArgsBuilder.build({
            baseDiscountBps: baseDiscountBps,
            annualRateBps: annualRateBps,
            maxDiscountBps: maxDiscountBps,
            maturity: maturity,
            maxStaleness: maxStaleness,
            tokenInDecimals: 18,
            tokenOutDecimals: 18,
            oracleDecimals: 18,
            oracleAddress: address(oracle),
            maxExposure: maxExposure,
            inventorySlopeBps: 0
        });
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
}
