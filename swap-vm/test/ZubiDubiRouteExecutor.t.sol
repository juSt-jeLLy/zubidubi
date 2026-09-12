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
        routeExecutor = new ZubiDubiRouteExecutor(aqua, swapVM, feeRecipient, 10, 0);
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

    function test_ZubiDubiRouteExecutor_SkipsMakerWithRevokedApproval() public {
        address revokedMaker = vm.addr(0xBAD);
        address goodMaker = vm.addr(0x600D);

        ISwapVM.Order memory revokedOrder = _createExitOrderFor(
            revokedMaker,
            _buildAquaExitArgsWithExposure(25, 500, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("revoked-maker")
        );
        ISwapVM.Order memory goodOrder = _createExitOrderFor(
            goodMaker,
            _buildAquaExitArgsWithExposure(50, 600, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("good-maker")
        );

        _shipExitOrderFor(revokedMaker, revokedOrder, 1 ether, 10_000 ether);
        _shipExitOrderFor(goodMaker, goodOrder, 1 ether, 10_000 ether);
        usdc.mint(revokedMaker, 10_000 ether);
        usdc.mint(goodMaker, 10_000 ether);
        exitReceipt.mint(seller, 1 ether);

        vm.prank(revokedMaker);
        usdc.approve(address(aqua), 0);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](2);
        orders[0] = revokedOrder;
        orders[1] = goodOrder;

        (uint256 quotedIn, uint256 quotedOut, ZubiDubiRouteExecutor.Quote[] memory quotes) = routeExecutor.quoteExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            1 ether
        );

        assertEq(quotedIn, 1 ether);
        assertEq(quotedOut, 2_967.3297 ether);
        assertTrue(quotes[0].skipped);
        assertEq(quotes[0].deliverableOut, 0);
        assertFalse(quotes[1].skipped);
        assertEq(quotes[1].fillIn, 1 ether);
    }

    function test_ZubiDubiRouteExecutor_SkipsMakerWhoseWalletBalanceMoved() public {
        address movedMaker = vm.addr(0xD00D);
        address goodMaker = vm.addr(0x600D);

        ISwapVM.Order memory movedOrder = _createExitOrderFor(
            movedMaker,
            _buildAquaExitArgsWithExposure(25, 500, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("moved-maker")
        );
        ISwapVM.Order memory goodOrder = _createExitOrderFor(
            goodMaker,
            _buildAquaExitArgsWithExposure(50, 600, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("good-maker-2")
        );

        _shipExitOrderFor(movedMaker, movedOrder, 1 ether, 10_000 ether);
        _shipExitOrderFor(goodMaker, goodOrder, 1 ether, 10_000 ether);
        usdc.mint(movedMaker, 10_000 ether);
        usdc.mint(goodMaker, 10_000 ether);
        exitReceipt.mint(seller, 1 ether);

        vm.prank(movedMaker);
        usdc.transfer(vm.addr(0xC011EC7), 10_000 ether);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](2);
        orders[0] = movedOrder;
        orders[1] = goodOrder;

        (uint256 quotedIn,, ZubiDubiRouteExecutor.Quote[] memory quotes) = routeExecutor.quoteExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            1 ether
        );

        assertEq(quotedIn, 1 ether);
        assertTrue(quotes[0].skipped);
        assertEq(quotes[0].deliverableOut, 0);
        assertFalse(quotes[1].skipped);
    }

    function test_ZubiDubiRouteExecutor_EnforcesMaxFillsLimit() public {
        ZubiDubiRouteExecutor oneFillExecutor = new ZubiDubiRouteExecutor(aqua, swapVM, feeRecipient, 10, 1);
        address makerA = vm.addr(0xA11CE);
        address makerB = vm.addr(0xB0B);

        ISwapVM.Order memory orderA = _createExitOrderFor(
            makerA,
            _buildAquaExitArgsWithExposure(50, 600, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("maker-a-limit")
        );
        ISwapVM.Order memory orderB = _createExitOrderFor(
            makerB,
            _buildAquaExitArgsWithExposure(100, 1200, 300, uint40(block.timestamp + 30 days), 1 hours, 1 ether),
            bytes32("maker-b-limit")
        );

        _shipExitOrderFor(makerA, orderA, 1 ether, 10_000 ether);
        _shipExitOrderFor(makerB, orderB, 1 ether, 10_000 ether);
        usdc.mint(makerA, 10_000 ether);
        usdc.mint(makerB, 10_000 ether);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](2);
        orders[0] = orderA;
        orders[1] = orderB;

        (uint256 quotedIn,,) = oneFillExecutor.quoteExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            2 ether
        );

        assertEq(quotedIn, 1 ether);
    }

    function test_ZubiDubiRouteExecutor_RoutesSameReceiptIntoNonUsdcPayoutToken() public {
        TokenMock wethPayout = new TokenMock("Wrapped Ether", "WETH");
        MockPriceOracle ethEthOracle = new MockPriceOracle(1e18, 18);
        address makerA = vm.addr(0xA11CE);

        bytes memory args = AquaExitTermArgsBuilder.build(AquaExitTermArgsBuilder.Args({
            baseDiscountBps: 50,
            annualRateBps: 600,
            maxDiscountBps: 300,
            maturity: uint40(block.timestamp + 30 days),
            maxStaleness: 1 hours,
            tokenInDecimals: 18,
            tokenOutDecimals: 18,
            oracleDecimals: 18,
            oracleAddress: address(ethEthOracle),
            maxExposure: 5 ether,
            inventorySlopeBps: 0,
            maxNotionalOut: 0,
            liquiditySlopeBps: 0,
            riskTierBps: 0,
            minMaturity: 0,
            maxMaturity: type(uint40).max,
            allowedTokenIn: address(exitReceipt),
            allowedTokenOut: address(wethPayout),
            secondaryOracleAddress: address(0),
            maxDeviationBps: 0,
            deviationHaircutBps: 0,
            curveFamily: 0,
            convexityBps: 0
        }));
        ISwapVM.Order memory orderA = _createExitOrderFor(makerA, args, bytes32("maker-weth-payout"));
        bytes32 orderHashA = swapVM.hash(orderA);

        vm.prank(makerA);
        exitReceipt.approve(address(aqua), type(uint256).max);
        vm.prank(makerA);
        wethPayout.approve(address(aqua), type(uint256).max);

        address[] memory tokens = new address[](2);
        tokens[0] = address(exitReceipt);
        tokens[1] = address(wethPayout);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0;
        amounts[1] = 2 ether;

        vm.prank(makerA);
        assertEq(aqua.ship(address(swapVM), abi.encode(orderA), tokens, amounts), orderHashA);

        wethPayout.mint(makerA, 2 ether);
        exitReceipt.mint(seller, 1 ether);

        vm.prank(seller);
        exitReceipt.approve(address(routeExecutor), 1 ether);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](1);
        orders[0] = orderA;

        (uint256 quotedIn, uint256 quotedOut,) = routeExecutor.quoteExactIn(
            orders,
            address(exitReceipt),
            address(wethPayout),
            1 ether
        );
        assertEq(quotedIn, 1 ether);
        assertGt(quotedOut, 0);
        assertLt(quotedOut, 1 ether);

        vm.prank(seller);
        (uint256 totalIn, uint256 totalOut) = routeExecutor.routeExactIn(
            orders,
            address(exitReceipt),
            address(wethPayout),
            1 ether,
            quotedOut,
            recipient
        );

        assertEq(totalIn, 1 ether);
        assertEq(totalOut, quotedOut);
        assertEq(wethPayout.balanceOf(recipient), quotedOut);
        assertGt(wethPayout.balanceOf(feeRecipient), 0);
        assertEq(exitReceipt.balanceOf(makerA), 1 ether);
    }

    function test_ZubiDubiRouteExecutor_SharedTermRiskBudgetCapsSiblingStrategies() public {
        address maker = vm.addr(0xB006E7);
        bytes32 budgetId = keccak256("eth-term-book");

        ISwapVM.Order memory cheapOrder = _createExitOrderFor(
            maker,
            _buildAquaExitArgsWithExposure(25, 500, 500, uint40(block.timestamp + 30 days), 1 hours, 5 ether),
            bytes32("budget-cheap")
        );
        ISwapVM.Order memory expensiveOrder = _createExitOrderFor(
            maker,
            _buildAquaExitArgsWithExposure(250, 1500, 600, uint40(block.timestamp + 180 days), 1 hours, 5 ether),
            bytes32("budget-expensive")
        );

        bytes32 cheapHash = _shipExitOrderFor(maker, cheapOrder, 5 ether, 10_000 ether);
        bytes32 expensiveHash = _shipExitOrderFor(maker, expensiveOrder, 5 ether, 10_000 ether);

        vm.startPrank(maker);
        routeExecutor.setTermRiskBudget(budgetId, uint128(1.25 ether), uint128(4_000 ether), 125);
        routeExecutor.assignOrderTermRiskBudget(cheapHash, budgetId, address(exitReceipt), address(usdc));
        routeExecutor.assignOrderTermRiskBudget(expensiveHash, budgetId, address(exitReceipt), address(usdc));
        vm.stopPrank();

        usdc.mint(maker, 10_000 ether);
        exitReceipt.mint(seller, 2 ether);
        vm.prank(seller);
        exitReceipt.approve(address(routeExecutor), 2 ether);

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](2);
        orders[0] = expensiveOrder;
        orders[1] = cheapOrder;

        (uint256 quotedIn,, ZubiDubiRouteExecutor.Quote[] memory quotes) = routeExecutor.quoteExactIn(
            orders,
            address(exitReceipt),
            address(usdc),
            2 ether
        );

        assertEq(quotedIn, 1.25 ether);
        assertEq(quotes[1].budgetId, budgetId);
        assertEq(quotes[1].budgetRemainingIn, 1.25 ether);
        assertEq(quotes[1].fillIn, 1.25 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                ZubiDubiRouteExecutor.ZubiDubiRouteExecutorInsufficientFill.selector,
                2 ether,
                1.25 ether
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

    function test_ZubiDubiRouteExecutor_ExecutionConsumesSharedBudgetForFutureQuotes() public {
        address maker = vm.addr(0xB006E8);
        bytes32 budgetId = keccak256("usd-term-book");

        ISwapVM.Order memory orderA = _createExitOrderFor(
            maker,
            _buildAquaExitArgsWithExposure(50, 600, 500, uint40(block.timestamp + 30 days), 1 hours, 5 ether),
            bytes32("budget-a")
        );
        ISwapVM.Order memory orderB = _createExitOrderFor(
            maker,
            _buildAquaExitArgsWithExposure(100, 1200, 500, uint40(block.timestamp + 90 days), 1 hours, 5 ether),
            bytes32("budget-b")
        );

        bytes32 orderHashA = _shipExitOrderFor(maker, orderA, 5 ether, 10_000 ether);
        bytes32 orderHashB = _shipExitOrderFor(maker, orderB, 5 ether, 10_000 ether);

        vm.startPrank(maker);
        routeExecutor.setTermRiskBudget(budgetId, uint128(1.5 ether), uint128(10_000 ether), 100);
        routeExecutor.assignOrderTermRiskBudget(orderHashA, budgetId, address(exitReceipt), address(usdc));
        routeExecutor.assignOrderTermRiskBudget(orderHashB, budgetId, address(exitReceipt), address(usdc));
        vm.stopPrank();

        usdc.mint(maker, 10_000 ether);
        exitReceipt.mint(seller, 2 ether);
        vm.prank(seller);
        exitReceipt.approve(address(routeExecutor), 2 ether);

        ISwapVM.Order[] memory firstRoute = new ISwapVM.Order[](1);
        firstRoute[0] = orderA;

        vm.prank(seller);
        routeExecutor.routeExactIn(firstRoute, address(exitReceipt), address(usdc), 1 ether, 0, recipient);

        ZubiDubiRouteExecutor.TermRiskBudget memory budget = routeExecutor.termRiskBudgetOf(maker, budgetId);
        assertEq(budget.receiptExposure, 1 ether);
        assertGt(budget.quoteSpent, 0);

        ISwapVM.Order[] memory siblingRoute = new ISwapVM.Order[](1);
        siblingRoute[0] = orderB;

        (uint256 quotedIn,, ZubiDubiRouteExecutor.Quote[] memory quotes) = routeExecutor.quoteExactIn(
            siblingRoute,
            address(exitReceipt),
            address(usdc),
            1 ether
        );

        assertEq(quotedIn, 0.5 ether);
        assertEq(quotes[0].budgetRemainingIn, 0.5 ether);
        assertEq(quotes[0].fillIn, 0.5 ether);
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
            maxExposure: maxExposure,
            inventorySlopeBps: 0,
            maxNotionalOut: 0,
            liquiditySlopeBps: 0,
            riskTierBps: 0,
            minMaturity: 0,
            maxMaturity: type(uint40).max,
            allowedTokenIn: address(exitReceipt),
            allowedTokenOut: address(usdc),
            secondaryOracleAddress: address(0),
            maxDeviationBps: 0,
            deviationHaircutBps: 0,
            curveFamily: 0,
            convexityBps: 0
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
            p.build(AquaExitTerm._aquaExitBackingOracleCheck, args),
            p.build(AquaExitTerm._aquaExitExposureCap, args),
            p.build(AquaExitTerm._aquaExitDiscountCurve1D, args),
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
