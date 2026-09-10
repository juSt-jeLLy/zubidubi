// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm/blob/main/LICENSES/SwapVM-1.1.txt

import { Test } from "forge-std/Test.sol";

import { TokenMock } from "@1inch/solidity-utils/contracts/mocks/TokenMock.sol";

import { ISwapVM } from "../../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../../src/libs/MakerTraits.sol";
import { AquaExitTerm, AquaExitTermArgsBuilder } from "../../src/instructions/AquaExitTerm.sol";
import { Controls, ControlsArgsBuilder } from "../../src/instructions/Controls.sol";

import { AquaSwapVMTest } from "../base/AquaSwapVMTest.sol";
import { Program, ProgramBuilder } from "../utils/ProgramBuilder.sol";
import { MockPriceOracle } from "../mocks/MockPriceOracle.sol";

/// @notice Invariant handler that warps time forward against a shipped linear and
///         convex AquaExit strategy and records the quoted amountOut at every step.
/// @dev The ordered record tape lets the invariant suite prove, on-chain:
///       1. amountOut never exceeds oracle par (discount is never negative);
///       2. amountOut grows (discount shrinks) monotonically as maturity nears;
///       3. the convex curve always discounts at least as much as the linear one;
///       4. amountOut is always strictly positive (discount is bounded below par).
contract AquaExitCurveInvariantHandler is AquaSwapVMTest {
    using ProgramBuilder for Program;

    TokenMock public exitReceipt;
    TokenMock public usdc;
    MockPriceOracle public oracle;

    struct TickRecord {
        uint256 timestamp;
        uint256 linearOut;
        uint256 convexOut;
    }

    TickRecord[] public records;
    ISwapVM.Order internal linearOrder;
    ISwapVM.Order internal convexOrder;
    bool public shipped;

    uint256 public constant QUOTE_IN = 1 ether;
    uint256 public constant PAR_OUT = 3000 ether; // 1 receipt * oracle 3000 USDC par

    function setUp() public override {
        super.setUp();

        exitReceipt = new TokenMock("Mock Delayed Exit Receipt", "mxETH");
        usdc = new TokenMock("Mock USDC", "mUSDC");
        oracle = new MockPriceOracle(3000e18, 18);
    }

    /// @notice Ships the linear and convex strategies once, then warps time forward
    ///         and appends a matched quote record (public so forge fuzzes it).
    function tick(uint256 secondsToWarp) external {
        _ensureShipped();
        vm.warp(block.timestamp + (secondsToWarp % 400 days) + 1);

        SwapProgram memory swapProgram = _buildSwapProgram();
        (, uint256 linearOut) = quote(swapProgram, linearOrder);
        (, uint256 convexOut) = quote(swapProgram, convexOrder);

        records.push(TickRecord({ timestamp: block.timestamp, linearOut: linearOut, convexOut: convexOut }));
    }

    function _buildSwapProgram() internal view returns (SwapProgram memory swapProgram) {
        swapProgram = SwapProgram({
            amount: QUOTE_IN,
            taker: taker,
            tokenA: exitReceipt,
            tokenB: usdc,
            zeroForOne: true,
            isExactIn: true
        });
    }

    function recordsLength() external view returns (uint256) {
        return records.length;
    }

    function recordAt(uint256 i) external view returns (uint256, uint256, uint256) {
        return (records[i].timestamp, records[i].linearOut, records[i].convexOut);
    }

    function _ensureShipped() internal {
        if (shipped) return;

        linearOrder = _prepareAquaExitOrder(0, 0);
        convexOrder = _prepareAquaExitOrder(1, 500);
        shipStrategy(linearOrder, exitReceipt, usdc, 5 ether, 100_000 ether);
        shipStrategy(convexOrder, exitReceipt, usdc, 5 ether, 100_000 ether);
        shipped = true;
    }

    function _prepareAquaExitOrder(uint8 curveFamily, uint32 convexityBps) internal view returns (ISwapVM.Order memory order) {
        bytes memory args = AquaExitTermArgsBuilder.build(AquaExitTermArgsBuilder.Args({
            baseDiscountBps: 100,
            annualRateBps: 1200,
            maxDiscountBps: 5000,
            maturity: uint40(block.timestamp + 365 days),
            maxStaleness: 0,
            tokenInDecimals: 18,
            tokenOutDecimals: 18,
            oracleDecimals: 18,
            oracleAddress: address(oracle),
            maxExposure: 0,
            inventorySlopeBps: 0,
            maxNotionalOut: 0,
            liquiditySlopeBps: 0,
            riskTierBps: 50,
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

        Program memory p = ProgramBuilder.init(_opcodes());

        bytes memory program = bytes.concat(
            p.build(AquaExitTerm._aquaExitBackingOracleCheck, args),
            p.build(AquaExitTerm._aquaExitExposureCap, args),
            p.build(AquaExitTerm._aquaExitDiscountCurve1D, args),
            p.build(Controls._salt, ControlsArgsBuilder.buildSalt(uint64(0xABCD)))
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
}

contract AquaExitCurveInvariants is Test {
    AquaExitCurveInvariantHandler internal handler;

    function setUp() public {
        handler = new AquaExitCurveInvariantHandler();
        handler.setUp();
        targetContract(address(handler));
    }

    /// @dev The convex curve must never quote a better (higher) amountOut than the
    ///      linear curve for the same params, maturity and oracle: convexity only
    ///      ever widens the discount.
    function invariant_convexDiscountAtLeastLinear() public view {
        uint256 n = handler.recordsLength();
        for (uint256 i = 0; i < n; i++) {
            (uint256 ts, uint256 linearOut, uint256 convexOut) = handler.recordAt(i);
            assertLe(convexOut, linearOut, "convex>linear");
        }
    }

    /// @dev Discount is never negative: amountOut never exceeds the oracle par.
    function invariant_amountOutNeverExceedsPar() public view {
        uint256 n = handler.recordsLength();
        for (uint256 i = 0; i < n; i++) {
            (uint256 ts, uint256 linearOut, uint256 convexOut) = handler.recordAt(i);
            assertLe(linearOut, handler.PAR_OUT(), "linear>par");
            assertLe(convexOut, handler.PAR_OUT(), "convex>par");
        }
    }

    /// @dev As maturity approaches, the discount shrinks, so amountOut never
    ///      decreases along the time tape (for either curve family).
    function invariant_amountOutMonotonicInTime() public view {
        uint256 n = handler.recordsLength();
        for (uint256 i = 1; i < n; i++) {
            (uint256 ts0, uint256 l0, uint256 c0) = handler.recordAt(i - 1);
            (uint256 ts1, uint256 l1, uint256 c1) = handler.recordAt(i);
            assertGe(l1, l0, "linear out dropped");
            assertGe(c1, c0, "convex out dropped");
        }
    }

    /// @dev Discount is always strictly below par: amountOut > 0 at every step.
    function invariant_amountOutAlwaysPositive() public view {
        uint256 n = handler.recordsLength();
        for (uint256 i = 0; i < n; i++) {
            (uint256 ts, uint256 linearOut, uint256 convexOut) = handler.recordAt(i);
            assertGt(linearOut, 0, "linear out zero");
            assertGt(convexOut, 0, "convex out zero");
        }
    }
}