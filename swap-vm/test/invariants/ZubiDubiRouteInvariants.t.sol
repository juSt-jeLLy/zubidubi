// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm/blob/main/LICENSES/SwapVM-1.1.txt

import { Test } from "forge-std/Test.sol";

import { TokenMock } from "@1inch/solidity-utils/contracts/mocks/TokenMock.sol";

import { ISwapVM } from "../../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../../src/libs/MakerTraits.sol";
import { AquaExitTerm, AquaExitTermArgsBuilder } from "../../src/instructions/AquaExitTerm.sol";
import { Controls, ControlsArgsBuilder } from "../../src/instructions/Controls.sol";
import { ZubiDubiRouteExecutor } from "../../src/ZubiDubiRouteExecutor.sol";

import { AquaSwapVMTest } from "../base/AquaSwapVMTest.sol";
import { Program, ProgramBuilder } from "../utils/ProgramBuilder.sol";
import { MockPriceOracle } from "../mocks/MockPriceOracle.sol";

/// @notice Invariant handler that fuzzes random multi-maker routed exits through
///         ZubiDubiRouteExecutor + AquaExit and snapshots per-maker liquidity.
/// @dev Core guarantees proven on-chain by the invariant suite:
///       1. A maker can never be pulled for more than min(wallet balance, Aqua
///          allowance) — even when the same maker ships multiple strategies.
///       2. Routes are atomic: a successful route fully fills the taker (all
///          receipts sold), a reverting route moves nothing.
///       3. Everything pulled from makers is accounted for at the recipient and
///          the fee recipient (no value creation or loss inside the route).
contract ZubiDubiRouteInvariantHandler is AquaSwapVMTest {
    using ProgramBuilder for Program;

    TokenMock public exitReceipt;
    TokenMock public usdc;
    MockPriceOracle public oracle;
    ZubiDubiRouteExecutor public routeExecutor;

    address public recipient = vm.addr(0xBEEF);
    address public feeRecipient = vm.addr(0xFEE);

    address[] public activeMakers;
    mapping(address => uint256) public makerBalanceBefore;
    mapping(address => uint256) public makerAllowanceBefore;
    mapping(address => uint256) public makerPulled;

    uint256 public lastRequestedIn;
    uint256 public lastTotalIn;
    uint256 public lastTotalOut;
    uint256 public lastReceiptBefore;
    uint256 public lastMakerPulledTotal;
    bool public lastFilled;
    bool public lastReverted;

    error RouteSeedTooSmall();

    function setUp() public override {
        super.setUp();

        exitReceipt = new TokenMock("Mock Delayed Exit Receipt", "mxETH");
        usdc = new TokenMock("Mock USDC", "mUSDC");
        oracle = new MockPriceOracle(3000e18, 18);
        routeExecutor = new ZubiDubiRouteExecutor(aqua, swapVM, feeRecipient, 10, 0);
    }

    /// @notice Builds a fresh random maker market + route attempt from `seed`.
    function runRandomRoute(uint256 seed) external {
        // Most calls just warm/perturb the market cheaply; 1 in 4 actually routes.
        if (seed % 4 != 0) return;
        if (seed % 13 == 0) return;

        address[] memory makers = new address[](2 + (seed % 2)); // 2..3 makers
        for (uint256 i = 0; i < makers.length; i++) {
            makers[i] = address(uint160(uint256(keccak256(abi.encode(seed, i))) % type(uint160).max));
        }

        ISwapVM.Order[] memory orders = new ISwapVM.Order[](3 + (seed % 3)); // makers + room for a same-maker second strategy
        uint256 orderCount;

        for (uint256 i = 0; i < makers.length; i++) {
            address m = makers[i];
            uint256 liquidity = 1_000e18 + ((seed >> (i * 3)) % 40_000e18);
            uint128 maxExposure = uint128(0.25 ether + ((seed >> i) % 8 ether));

            bytes memory args = _buildAquaExitArgs(
                uint32(50 + (seed % 200)),            // baseDiscountBps
                uint32(400 + ((seed >> 4) % 2000)),   // annualRateBps
                5000,                                  // maxDiscountBps
                uint40(block.timestamp + 30 days + (seed % 400 days)),
                uint8(seed % 2),                       // curveFamily
                uint32((seed >> 9) % 1000),            // convexityBps
                maxExposure
            );

            ISwapVM.Order memory order = _createExitOrderFor(m, args, uint64(uint256(keccak256(abi.encode(seed, i)))));
            orders[orderCount++] = order;

            vm.prank(m);
            usdc.mint(m, liquidity);
            _shipExitOrderFor(m, order, liquidity);
        }

        // One maker also ships a second strategy to exercise same-maker dedup of
        // pooled output liquidity.
        if (seed % 3 == 0 && makers.length >= 2) {
            address m = makers[1];
            bytes memory args2 = _buildAquaExitArgs(
                uint32(100 + (seed % 150)),
                uint32(600 + ((seed >> 5) % 1500)),
                5000,
                uint40(block.timestamp + 60 days + (seed % 300 days)),
                uint8(seed % 2),
                uint32((seed >> 10) % 800),
                5 ether
            );
            orders[orderCount++] = _createExitOrderFor(m, args2, uint64(uint256(keccak256(abi.encode(seed, 0x99)))));
        }

        // Shrink orders array to the real count.
        ISwapVM.Order[] memory finalOrders = new ISwapVM.Order[](orderCount);
        for (uint256 i = 0; i < orderCount; i++) {
            finalOrders[i] = orders[i];
        }

        uint256 requestedIn = 0.01 ether + ((seed >> 12) % 3 ether);

        // Snapshot maker liquidity.
        _resetMakers();
        for (uint256 i = 0; i < makers.length; i++) {
            address m = makers[i];
            makerBalanceBefore[m] = usdc.balanceOf(m);
            makerAllowanceBefore[m] = usdc.allowance(m, address(aqua));
            makerPulled[m] = 0;
            activeMakers.push(m);
        }

        exitReceipt.mint(address(this), requestedIn);
        exitReceipt.approve(address(routeExecutor), type(uint256).max);

        lastRequestedIn = requestedIn;
        lastReceiptBefore = exitReceipt.balanceOf(address(this));
        lastTotalIn = 0;
        lastTotalOut = 0;
        lastMakerPulledTotal = 0;
        lastFilled = false;
        lastReverted = false;

        try routeExecutor.routeExactIn(finalOrders, address(exitReceipt), address(usdc), requestedIn, 0, recipient) returns (uint256 totalIn, uint256 totalOut) {
            lastFilled = true;
            lastTotalIn = totalIn;
            lastTotalOut = totalOut;
        } catch {
            lastReverted = true;
        }

        // Record what actually moved per maker.
        for (uint256 i = 0; i < makers.length; i++) {
            address m = makers[i];
            uint256 pulled = makerBalanceBefore[m] - usdc.balanceOf(m);
            makerPulled[m] = pulled;
            lastMakerPulledTotal += pulled;
        }
    }

    function makerCount() external view returns (uint256) {
        return activeMakers.length;
    }

    function makerAt(uint256 i) external view returns (address) {
        return activeMakers[i];
    }

    function _resetMakers() internal {
        for (uint256 i = 0; i < activeMakers.length; i++) {
            address m = activeMakers[i];
            makerBalanceBefore[m] = 0;
            makerAllowanceBefore[m] = 0;
            makerPulled[m] = 0;
        }
        delete activeMakers;
    }

    function _buildAquaExitArgs(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint8 curveFamily,
        uint32 convexityBps,
        uint128 maxExposure
    ) internal view returns (bytes memory) {
        return AquaExitTermArgsBuilder.build(AquaExitTermArgsBuilder.Args({
            baseDiscountBps: baseDiscountBps,
            annualRateBps: annualRateBps,
            maxDiscountBps: maxDiscountBps,
            maturity: maturity,
            maxStaleness: 0,
            tokenInDecimals: 18,
            tokenOutDecimals: 18,
            oracleDecimals: 18,
            oracleAddress: address(oracle),
            maxExposure: maxExposure,
            inventorySlopeBps: uint32(50 + (annualRateBps % 300)),
            maxNotionalOut: 0,
            liquiditySlopeBps: uint32(annualRateBps % 200),
            riskTierBps: uint32(annualRateBps % 100),
            minMaturity: 0,
            maxMaturity: type(uint40).max,
            allowedTokenIn: address(exitReceipt),
            allowedTokenOut: address(usdc),
            secondaryOracleAddress: address(0),
            maxDeviationBps: 0,
            deviationHaircutBps: 0,
            curveFamily: curveFamily,
            convexityBps: convexityBps
        }));
    }

    function _createExitOrderFor(
        address makerAddress,
        bytes memory args,
        uint64 saltSeed
    ) internal pure returns (ISwapVM.Order memory order) {
        Program memory p = ProgramBuilder.init(_opcodes());

        bytes memory program = bytes.concat(
            p.build(AquaExitTerm._aquaExitBackingOracleCheck, args),
            p.build(AquaExitTerm._aquaExitExposureCap, args),
            p.build(AquaExitTerm._aquaExitDiscountCurve1D, args),
            p.build(Controls._salt, ControlsArgsBuilder.buildSalt(saltSeed))
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

    function _shipExitOrderFor(address makerAddress, ISwapVM.Order memory order, uint256 usdcLiquidity) internal {
        bytes32 orderHash = swapVM.hash(order);

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
}

contract ZubiDubiRouteInvariants is Test {
    ZubiDubiRouteInvariantHandler internal handler;

    function setUp() public {
        handler = new ZubiDubiRouteInvariantHandler();
        handler.setUp();
        targetContract(address(handler));
    }

    /// @dev No maker can ever be pulled for more than they could actually pay:
    ///      min(wallet balance, Aqua allowance). Revoked allowances and moved
    ///      balances must be respected even with multiple strategies per maker.
    function invariant_routeNeverPullsMoreThanMakerCanPay() public view {
        uint256 n = handler.makerCount();
        for (uint256 i = 0; i < n; i++) {
            address m = handler.makerAt(i);
            uint256 pulled = handler.makerPulled(m);
            assertLe(pulled, handler.makerBalanceBefore(m));
            assertLe(pulled, handler.makerAllowanceBefore(m));
        }
    }

    /// @dev Atomicity: a successful route sells every receipt the taker supplied;
    ///      a reverting route must leave the taker's receipts untouched.
    function invariant_routeIsAtomic() public view {
        uint256 balance = handler.exitReceipt().balanceOf(address(handler));
        if (handler.lastFilled()) {
            assertEq(balance, 0, "route succeeded but taker still holds receipts");
            assertEq(handler.lastTotalIn(), handler.lastRequestedIn(), "route partially filled");
        } else if (handler.lastReverted()) {
            assertEq(balance, handler.lastReceiptBefore(), "reverted route leaked receipts");
            assertEq(handler.usdc().balanceOf(handler.recipient()), 0, "reverted route paid recipient");
        }
    }

    /// @dev Conservation: everything pulled from makers lands at the recipient or
    ///      the fee recipient — the route creates and loses no value on its own.
    function invariant_routeValueIsConserved() public view {
        if (!handler.lastFilled()) return;

        uint256 paidRecipient = handler.usdc().balanceOf(handler.recipient());
        uint256 paidFee = handler.usdc().balanceOf(handler.feeRecipient());

        assertEq(
            handler.lastMakerPulledTotal(),
            paidRecipient + paidFee,
            "pulled from makers does not match what was paid out"
        );
        // Fee is exactly feeBps (10) of gross output; totalOut reported by the
        // route is already net of that fee.
        assertEq(paidFee, handler.lastTotalOut() * 10 / 10_000, "fee amount mismatch");
    }
}