// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";

import { AquaSwapVMRouter } from "../src/routers/AquaSwapVMRouter.sol";
import { ISwapVM } from "../src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "../src/libs/MakerTraits.sol";
import { TakerTraitsLib } from "../src/libs/TakerTraits.sol";
import { AquaExitTerm, AquaExitTermArgsBuilder } from "../src/instructions/AquaExitTerm.sol";
import { Controls, ControlsArgsBuilder } from "../src/instructions/Controls.sol";
import { ZubiDubiExitReceipt } from "../src/ZubiDubiExitReceipt.sol";

import { MockTaker } from "./mocks/MockTaker.sol";
import { Program, ProgramBuilder } from "./utils/ProgramBuilder.sol";
import { AquaOpcodesDebug } from "../src/opcodes/AquaOpcodesDebug.sol";

contract ZubiDubiSepoliaForkTest is Test, AquaOpcodesDebug {
    using ProgramBuilder for Program;

    uint256 private constant SEPOLIA_CHAIN_ID = 11_155_111;
    address private constant SEPOLIA_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address private constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address private constant SEPOLIA_CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    Aqua public aqua;
    AquaSwapVMRouter public swapVM;
    ZubiDubiExitReceipt public exitReceipt;
    MockTaker public taker;
    IERC20 public usdc;

    uint256 private constant INVENTORY_DEMO_MAX_EXPOSURE = 0.0008 ether;

    constructor() AquaOpcodesDebug(address(0)) { }

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
        }
        vm.createSelectFork(rpc);
        require(block.chainid == SEPOLIA_CHAIN_ID, "Wrong fork");

        aqua = new Aqua();
        swapVM = new AquaSwapVMRouter(address(aqua), SEPOLIA_WETH, address(this), "ZubiDubiAquaSwapVMRouter", "1.0.0");
        exitReceipt = new ZubiDubiExitReceipt(
            address(this),
            IERC20(SEPOLIA_WETH),
            uint40(block.timestamp + 30 days),
            1e18,
            "ZubiDubi Principal Token (PT) backed by WETH",
            "PT-zbETH"
        );
        taker = new MockTaker(aqua, swapVM, address(this));
        usdc = IERC20(SEPOLIA_USDC);
    }

    function test_ZubiDubiSepoliaFork_UsesRealChainlinkFeedAndRealUsdc() public {
        address unavailableMaker = vm.addr(0xBADC0DE);
        address makerA = vm.addr(0xA11CE);

        ISwapVM.Order memory unavailableOrder = _createExitOrder(
            unavailableMaker,
            _buildRealSepoliaExitArgs(25, 500, 250, uint40(block.timestamp + 30 days), 2 days, 5 ether, 0),
            bytes32("unavailable-sepolia")
        );
        ISwapVM.Order memory orderA = _createExitOrder(
            makerA,
            _buildRealSepoliaExitArgs(100, 1200, 300, uint40(block.timestamp + 30 days), 2 days, 5 ether, 0),
            bytes32("maker-a-sepolia")
        );

        bytes32 unavailableHash = _shipExitOrder(unavailableMaker, unavailableOrder, 1 ether, 100e6);
        bytes32 orderHashA = _shipExitOrder(makerA, orderA, 1 ether, 100e6);

        deal(SEPOLIA_USDC, makerA, 100e6);
        exitReceipt.mint(address(taker), 0.001 ether);

        (bool unavailableCanFill, uint256 unavailableQuote) = _tryQuoteExactIn(unavailableOrder, 0.001 ether);
        assertTrue(unavailableCanFill);
        assertGt(unavailableQuote, 0);
        assertEq(_deliverableUsdc(unavailableOrder), 0);

        (bool makerCanFill, uint256 makerQuote) = _tryQuoteExactIn(orderA, 0.001 ether);
        assertTrue(makerCanFill);
        assertGt(makerQuote, 0);
        assertGe(_deliverableUsdc(orderA), makerQuote);

        (, uint256 amountOut) = taker.swap(
            orderA, address(exitReceipt), SEPOLIA_USDC, 0.001 ether, abi.encodePacked(_takerData(address(taker), true))
        );

        assertEq(amountOut, makerQuote);
        assertEq(exitReceipt.balanceOf(address(taker)), 0);
        assertEq(usdc.balanceOf(address(taker)), amountOut);
        assertEq(exitReceipt.balanceOf(makerA), 0.001 ether);

        (, uint256 unavailableUsdcBalance) =
            aqua.safeBalances(unavailableMaker, address(swapVM), unavailableHash, address(exitReceipt), SEPOLIA_USDC);
        (, uint256 makerUsdcBalance) =
            aqua.safeBalances(makerA, address(swapVM), orderHashA, address(exitReceipt), SEPOLIA_USDC);

        assertEq(unavailableUsdcBalance, 100e6);
        assertEq(makerUsdcBalance, 100e6 - amountOut);

        console2.log("Sepolia fork Chainlink ETH/USD feed:", SEPOLIA_CHAINLINK_ETH_USD);
        console2.log("Sepolia fork USDC:", SEPOLIA_USDC);
        uint256 receiptSold = 0.001 ether;
        console2.log("ZubiDubi receipt sold:", receiptSold);
        console2.log("Real USDC units paid:", amountOut);
    }

    function test_ZubiDubiSepoliaFork_InventoryPricingMovesPriceOnRealOracle() public {
        address makerA = vm.addr(0xA11CE);

        // Small maxExposure + inventory slope: second fill on the same strategy
        // must be priced at a worse discount (less USDC out for the same zbETH)
        // against the real Chainlink ETH/USD feed and real Sepolia USDC.
        ISwapVM.Order memory orderA = _createExitOrder(
            makerA,
            _buildRealSepoliaExitArgs(
                100, 1200, 500, uint40(block.timestamp + 30 days), 2 days, uint128(INVENTORY_DEMO_MAX_EXPOSURE), 150
            ),
            bytes32("inventory-sepolia")
        );

        _shipExitOrder(makerA, orderA, 1 ether, 100e6);
        deal(SEPOLIA_USDC, makerA, 100e6);
        exitReceipt.mint(address(taker), 0.0005 ether);

        // Fresh-strategy quote for 0.0002 zbETH (inventory ~0).
        (bool freshCanFill, uint256 freshQuote) = _tryQuoteExactIn(orderA, 0.0002 ether);
        assertTrue(freshCanFill);
        assertGt(freshQuote, 0);

        // Execute a 0.0005 zbETH fill so the maker now holds receipt inventory.
        exitReceipt.mint(address(taker), 0.0005 ether);
        (, uint256 firstFillOut) = taker.swap(
            orderA, address(exitReceipt), SEPOLIA_USDC, 0.0005 ether, abi.encodePacked(_takerData(address(taker), true))
        );
        assertGt(firstFillOut, 0);
        assertEq(exitReceipt.balanceOf(makerA), 0.0005 ether);

        // Same 0.0002 zbETH quote after inventory: exposure penalty must make it worse.
        (bool inventoryCanFill, uint256 inventoryQuote) = _tryQuoteExactIn(orderA, 0.0002 ether);
        assertTrue(inventoryCanFill);
        assertGt(inventoryQuote, 0);
        assertLt(inventoryQuote, freshQuote);
        uint256 inventoryPenaltyBps = (freshQuote - inventoryQuote) * 10_000 / freshQuote;
        assertGt(inventoryPenaltyBps, 0);

        // And a fill that would push exposure past maxExposure must be rejected
        // on the same real feed (0.0005 held + 0.0004 new > 0.0008 max).
        (bool overCanFill,) = _tryQuoteExactIn(orderA, 0.0004 ether);
        assertFalse(overCanFill);

        console2.log("===== SEPOLIA FORK: REAL ORACLE INVENTORY REPRICING =====");
        console2.log("Real Chainlink ETH/USD feed:", SEPOLIA_CHAINLINK_ETH_USD);
        console2.log("Real Sepolia USDC:", SEPOLIA_USDC);
        console2.log("Maker max exposure:", INVENTORY_DEMO_MAX_EXPOSURE);
        console2.log("Maker receipt inventory after first fill:", exitReceipt.balanceOf(makerA));
        console2.log("Sepolia fork fresh-strategy quote (0.0002 zbETH):", freshQuote);
        console2.log("Sepolia fork inventory-priced quote (0.0002 zbETH):", inventoryQuote);
        console2.log("Inventory penalty bps vs fresh quote:", inventoryPenaltyBps);
        console2.log("Sepolia fork exposure-rejected quote (0.0004 zbETH):", overCanFill ? "can fill" : "rejected");
    }

    function _tryQuoteExactIn(
        ISwapVM.Order memory order,
        uint256 amountIn
    )
        internal
        returns (bool canFill, uint256 amountOut)
    {
        try ISwapVM(address(swapVM)).quote(
            order, address(exitReceipt), SEPOLIA_USDC, amountIn, abi.encodePacked(_takerData(address(taker), true))
        ) returns (uint256, uint256 quotedAmountOut, bytes32) {
            return (true, quotedAmountOut);
        } catch {
            return (false, 0);
        }
    }

    function _deliverableUsdc(ISwapVM.Order memory order) internal view returns (uint256) {
        bytes32 orderHash = swapVM.hash(order);
        (, uint256 aquaBalanceOut) =
            aqua.safeBalances(order.maker, address(swapVM), orderHash, address(exitReceipt), SEPOLIA_USDC);

        uint256 walletBalance = usdc.balanceOf(order.maker);
        uint256 walletAllowance = usdc.allowance(order.maker, address(aqua));

        return _min(aquaBalanceOut, _min(walletBalance, walletAllowance));
    }

    function _shipExitOrder(
        address maker,
        ISwapVM.Order memory order,
        uint256,
        uint256 usdcLiquidity
    )
        internal
        returns (bytes32 orderHash)
    {
        orderHash = swapVM.hash(order);

        vm.prank(maker);
        exitReceipt.approve(address(aqua), type(uint256).max);
        vm.prank(maker);
        usdc.approve(address(aqua), type(uint256).max);

        address[] memory tokens = new address[](2);
        tokens[0] = address(exitReceipt);
        tokens[1] = SEPOLIA_USDC;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0;
        amounts[1] = usdcLiquidity;

        vm.prank(maker);
        bytes32 strategyHash = aqua.ship(address(swapVM), abi.encode(order), tokens, amounts);

        assertEq(strategyHash, orderHash);
    }

    function _buildRealSepoliaExitArgs(
        uint32 baseDiscountBps,
        uint32 annualRateBps,
        uint32 maxDiscountBps,
        uint40 maturity,
        uint32 maxStaleness,
        uint128 maxExposure,
        uint32 inventorySlopeBps
    )
        internal
        pure
        returns (bytes memory)
    {
        return AquaExitTermArgsBuilder.build(
            AquaExitTermArgsBuilder.Args({
                baseDiscountBps: baseDiscountBps,
                annualRateBps: annualRateBps,
                maxDiscountBps: maxDiscountBps,
                maturity: maturity,
                maxStaleness: maxStaleness,
                tokenInDecimals: 18,
                tokenOutDecimals: 6,
                oracleDecimals: 8,
                oracleAddress: SEPOLIA_CHAINLINK_ETH_USD,
                maxExposure: maxExposure,
                inventorySlopeBps: inventorySlopeBps,
                maxNotionalOut: 0,
                liquiditySlopeBps: 0,
                riskTierBps: 0,
                minMaturity: 0,
                maxMaturity: type(uint40).max,
                allowedTokenIn: address(0),
                allowedTokenOut: SEPOLIA_USDC,
                secondaryOracleAddress: address(0),
                maxDeviationBps: 0,
                deviationHaircutBps: 0,
                curveFamily: 0,
                convexityBps: 0
            })
        );
    }

    function _createExitOrder(
        address maker,
        bytes memory args,
        bytes32 saltSeed
    )
        internal
        pure
        returns (ISwapVM.Order memory order)
    {
        Program memory p = ProgramBuilder.init(_opcodes());

        bytes memory program = bytes.concat(
            p.build(AquaExitTerm._aquaExitBackingOracleCheck, args),
            p.build(AquaExitTerm._aquaExitExposureCap, args),
            p.build(AquaExitTerm._aquaExitDiscountCurve1D, args),
            p.build(Controls._salt, ControlsArgsBuilder.buildSalt(uint64(uint256(saltSeed))))
        );

        order = MakerTraitsLib.build(
            MakerTraitsLib.Args({
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
            })
        );
    }

    function _takerData(address takerAddress, bool isExactIn) internal pure returns (bytes memory) {
        return TakerTraitsLib.build(
            TakerTraitsLib.Args({
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
            })
        );
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
