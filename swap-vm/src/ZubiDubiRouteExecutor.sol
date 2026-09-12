// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";

import { ITakerCallbacks } from "./interfaces/ITakerCallbacks.sol";
import { ISwapVM } from "./interfaces/ISwapVM.sol";
import { SwapVM } from "./SwapVM.sol";
import { TakerTraitsLib } from "./libs/TakerTraits.sol";

contract ZubiDubiRouteExecutor is ITakerCallbacks {
    using SafeERC20 for IERC20;

    struct Fill {
        ISwapVM.Order order;
        uint256 amountIn;
        uint256 amountOut;
        bytes32 orderHash;
    }

    struct Quote {
        bytes32 orderHash;
        address maker;
        uint256 fillIn;
        uint256 amountOut;
        uint256 deliverableOut;
        bytes32 budgetId;
        uint256 budgetRemainingIn;
        uint256 budgetRemainingOut;
        bool skipped;
    }

    struct TermRiskBudget {
        uint128 maxReceiptExposure;
        uint128 maxQuoteSpend;
        uint128 receiptExposure;
        uint128 quoteSpent;
        uint32 pressurePenaltyBps;
        bool exists;
    }

    struct TermRiskBudgetMembership {
        address maker;
        bytes32 budgetId;
        address receiptToken;
        address quoteToken;
        bool active;
    }

    Aqua public immutable AQUA;
    SwapVM public immutable SWAPVM;
    address public immutable feeRecipient;
    uint16 public immutable feeBps;
    uint16 public immutable maxFills;

    error ZubiDubiRouteExecutorOnlySwapVM();
    error ZubiDubiRouteExecutorNoRecipient();
    error ZubiDubiRouteExecutorFeeTooHigh(uint16 feeBps);
    error ZubiDubiRouteExecutorInsufficientFill(uint256 requested, uint256 filled);
    error ZubiDubiRouteExecutorInsufficientOutput(uint256 minAmountOut, uint256 amountOut);
    error ZubiDubiRouteExecutorBudgetMissing(address maker, bytes32 budgetId);
    error ZubiDubiRouteExecutorBudgetLimitExceeded(bytes32 budgetId, uint256 receiptExposure, uint256 quoteSpent);
    error ZubiDubiRouteExecutorBudgetOverflow();

    event ZubiDubiRouteFilled(
        address indexed taker,
        address indexed recipient,
        address indexed tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fills
    );

    event ZubiDubiRouteFeePaid(address indexed feeRecipient, address indexed tokenOut, uint256 amount);
    event ZubiDubiMakerSkipped(bytes32 indexed orderHash, address indexed maker);
    event ZubiDubiTermRiskBudgetSet(
        address indexed maker,
        bytes32 indexed budgetId,
        uint128 maxReceiptExposure,
        uint128 maxQuoteSpend,
        uint32 pressurePenaltyBps
    );
    event ZubiDubiOrderBudgetAssigned(
        bytes32 indexed orderHash,
        address indexed maker,
        bytes32 indexed budgetId,
        address receiptToken,
        address quoteToken
    );
    event ZubiDubiTermRiskBudgetUsed(
        address indexed maker,
        bytes32 indexed budgetId,
        bytes32 indexed orderHash,
        uint256 fillIn,
        uint256 amountOut,
        uint256 receiptExposure,
        uint256 quoteSpent
    );

    mapping(bytes32 => TermRiskBudget) public termRiskBudgets;
    mapping(bytes32 => TermRiskBudgetMembership) public termRiskBudgetMemberships;

    modifier onlySwapVM() {
        if (msg.sender != address(SWAPVM)) revert ZubiDubiRouteExecutorOnlySwapVM();
        _;
    }

    constructor(Aqua aqua, SwapVM swapVM, address feeRecipient_, uint16 feeBps_, uint16 maxFills_) {
        if (feeBps_ > 1_000) revert ZubiDubiRouteExecutorFeeTooHigh(feeBps_);
        AQUA = aqua;
        SWAPVM = swapVM;
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
        maxFills = maxFills_;
    }

    function setTermRiskBudget(
        bytes32 budgetId,
        uint128 maxReceiptExposure,
        uint128 maxQuoteSpend,
        uint32 pressurePenaltyBps
    ) external {
        bytes32 key = _budgetKey(msg.sender, budgetId);
        TermRiskBudget storage budget = termRiskBudgets[key];
        budget.maxReceiptExposure = maxReceiptExposure;
        budget.maxQuoteSpend = maxQuoteSpend;
        budget.pressurePenaltyBps = pressurePenaltyBps;
        budget.exists = true;

        emit ZubiDubiTermRiskBudgetSet(
            msg.sender,
            budgetId,
            maxReceiptExposure,
            maxQuoteSpend,
            pressurePenaltyBps
        );
    }

    function assignOrderTermRiskBudget(
        bytes32 orderHash,
        bytes32 budgetId,
        address receiptToken,
        address quoteToken
    ) external {
        bytes32 key = _budgetKey(msg.sender, budgetId);
        if (!termRiskBudgets[key].exists) {
            revert ZubiDubiRouteExecutorBudgetMissing(msg.sender, budgetId);
        }

        termRiskBudgetMemberships[orderHash] = TermRiskBudgetMembership({
            maker: msg.sender,
            budgetId: budgetId,
            receiptToken: receiptToken,
            quoteToken: quoteToken,
            active: true
        });

        emit ZubiDubiOrderBudgetAssigned(orderHash, msg.sender, budgetId, receiptToken, quoteToken);
    }

    function termRiskBudgetOf(
        address maker,
        bytes32 budgetId
    ) external view returns (TermRiskBudget memory) {
        return termRiskBudgets[_budgetKey(maker, budgetId)];
    }

    function quoteExactIn(
        ISwapVM.Order[] calldata orders,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 totalIn, uint256 totalOut, Quote[] memory quotes) {
        Fill[] memory fills;
        (fills, quotes, totalIn, totalOut) = _buildRoute(orders, tokenIn, tokenOut, amountIn);
        totalOut -= _feeAmount(totalOut);
    }

    function routeExactIn(
        ISwapVM.Order[] calldata orders,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 totalIn, uint256 totalOut) {
        if (recipient == address(0)) revert ZubiDubiRouteExecutorNoRecipient();

        Fill[] memory fills;
        Quote[] memory quotes;
        uint256 quotedOut;
        (fills, quotes, totalIn, quotedOut) = _buildRoute(orders, tokenIn, tokenOut, amountIn);

        if (totalIn != amountIn) revert ZubiDubiRouteExecutorInsufficientFill(amountIn, totalIn);
        uint256 quotedNetOut = quotedOut - _feeAmount(quotedOut);
        if (quotedNetOut < minAmountOut) revert ZubiDubiRouteExecutorInsufficientOutput(minAmountOut, quotedNetOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        bytes memory takerData = _takerData();
        uint256 executedFills;
        for (uint256 i = 0; i < fills.length; i++) {
            if (fills[i].amountIn == 0) continue;

            (, uint256 executedOut,) = SWAPVM.swap(
                fills[i].order,
                tokenIn,
                tokenOut,
                fills[i].amountIn,
                takerData
            );
            totalOut += executedOut;
            _recordBudgetFill(fills[i].order, fills[i].orderHash, tokenIn, tokenOut, fills[i].amountIn, executedOut);
            executedFills++;
        }

        for (uint256 i = 0; i < quotes.length; i++) {
            if (quotes[i].skipped) emit ZubiDubiMakerSkipped(quotes[i].orderHash, quotes[i].maker);
        }

        uint256 fee = _feeAmount(totalOut);
        uint256 netOut = totalOut - fee;
        if (fee > 0) {
            IERC20(tokenOut).safeTransfer(feeRecipient, fee);
            emit ZubiDubiRouteFeePaid(feeRecipient, tokenOut, fee);
        }

        IERC20(tokenOut).safeTransfer(recipient, netOut);
        emit ZubiDubiRouteFilled(msg.sender, recipient, tokenIn, tokenOut, amountIn, netOut, executedFills);
        totalOut = netOut;
    }

    function preTransferInCallback(
        address maker,
        address,
        address tokenIn,
        address,
        uint256 amountIn,
        uint256,
        bytes32 orderHash,
        bytes calldata
    ) external onlySwapVM {
        IERC20(tokenIn).forceApprove(address(AQUA), amountIn);
        AQUA.push(maker, address(SWAPVM), orderHash, tokenIn, amountIn);
    }

    function preTransferOutCallback(
        address,
        address,
        address,
        address,
        uint256,
        uint256,
        bytes32,
        bytes calldata
    ) external onlySwapVM { }

    function _buildRoute(
        ISwapVM.Order[] calldata orders,
        address tokenIn,
        address tokenOut,
        uint256 requestedIn
    ) private view returns (Fill[] memory fills, Quote[] memory quotes, uint256 totalIn, uint256 quotedOut) {
        fills = new Fill[](orders.length);
        quotes = new Quote[](orders.length);
        bool[] memory used = new bool[](orders.length);

        uint256 remaining = requestedIn;
        uint256 fillCount;

        while (remaining > 0 && (maxFills == 0 || fillCount < maxFills)) {
            uint256 bestIndex = type(uint256).max;
            Fill memory bestFill;
            Quote memory bestQuote;

            for (uint256 i = 0; i < orders.length; i++) {
                if (used[i]) continue;

                (Fill memory candidateFill, Quote memory candidateQuote) = _quoteCandidate(
                    orders[i],
                    tokenIn,
                    tokenOut,
                    remaining,
                    _reservedOut(fills, fillCount, orders[i].maker),
                    _reservedBudgetIn(fills, fillCount, orders[i], tokenIn, tokenOut),
                    _reservedBudgetOut(fills, fillCount, orders[i], tokenIn, tokenOut)
                );

                quotes[i] = candidateQuote;
                if (candidateQuote.skipped || candidateFill.amountIn == 0) {
                    used[i] = true;
                    continue;
                }

                if (
                    bestIndex == type(uint256).max ||
                    candidateFill.amountOut * bestFill.amountIn > bestFill.amountOut * candidateFill.amountIn
                ) {
                    bestIndex = i;
                    bestFill = candidateFill;
                    bestQuote = candidateQuote;
                }
            }

            if (bestIndex == type(uint256).max) break;

            used[bestIndex] = true;
            fills[fillCount++] = bestFill;
            quotes[bestIndex] = bestQuote;
            remaining -= bestFill.amountIn;
            totalIn += bestFill.amountIn;
            quotedOut += bestFill.amountOut;
        }
    }

    function _quoteCandidate(
        ISwapVM.Order calldata order,
        address tokenIn,
        address tokenOut,
        uint256 remaining,
        uint256 reservedOut,
        uint256 reservedBudgetIn,
        uint256 reservedBudgetOut
    ) private view returns (Fill memory fill, Quote memory quote) {
        bytes32 orderHash = SWAPVM.hash(order);
        quote.orderHash = orderHash;
        quote.maker = order.maker;
        TermRiskBudgetMembership memory membership = _activeMembership(order, orderHash, tokenIn, tokenOut);

        (, uint256 virtualOut) = AQUA.safeBalances(
            order.maker,
            address(SWAPVM),
            orderHash,
            tokenIn,
            tokenOut
        );

        uint256 grossDeliverableOut = _min(
            virtualOut,
            _min(
                IERC20(tokenOut).balanceOf(order.maker),
                IERC20(tokenOut).allowance(order.maker, address(AQUA))
            )
        );
        quote.deliverableOut = grossDeliverableOut > reservedOut ? grossDeliverableOut - reservedOut : 0;

        uint256 maxIn = remaining;
        if (membership.active) {
            (uint256 budgetRemainingIn, uint256 budgetRemainingOut) = _remainingBudget(
                order.maker,
                membership.budgetId,
                reservedBudgetIn,
                reservedBudgetOut
            );

            quote.budgetId = membership.budgetId;
            quote.budgetRemainingIn = budgetRemainingIn;
            quote.budgetRemainingOut = budgetRemainingOut;

            if (maxIn > budgetRemainingIn) maxIn = budgetRemainingIn;
            if (quote.deliverableOut > budgetRemainingOut) quote.deliverableOut = budgetRemainingOut;
        }

        if (maxIn == 0 || quote.deliverableOut == 0) {
            quote.skipped = true;
            return (fill, quote);
        }

        (bool ok, uint256 out) = _tryQuote(order, tokenIn, tokenOut, maxIn);
        if (!ok) {
            maxIn = _maxFillForDeliverable(order, tokenIn, tokenOut, maxIn, quote.deliverableOut);
            if (maxIn == 0) {
                quote.skipped = true;
                return (fill, quote);
            }
            (ok, out) = _tryQuote(order, tokenIn, tokenOut, maxIn);
            if (!ok) {
                quote.skipped = true;
                return (fill, quote);
            }
        }

        if (out > quote.deliverableOut) {
            maxIn = _maxFillForDeliverable(order, tokenIn, tokenOut, maxIn, quote.deliverableOut);
            if (maxIn == 0) {
                quote.skipped = true;
                return (fill, quote);
            }
            (ok, out) = _tryQuote(order, tokenIn, tokenOut, maxIn);
            if (!ok || out > quote.deliverableOut) {
                quote.skipped = true;
                return (fill, quote);
            }
        }

        fill = Fill({
            order: order,
            amountIn: maxIn,
            amountOut: out,
            orderHash: orderHash
        });

        quote.fillIn = maxIn;
        quote.amountOut = out;
    }

    function _maxFillForDeliverable(
        ISwapVM.Order calldata order,
        address tokenIn,
        address tokenOut,
        uint256 high,
        uint256 deliverableOut
    ) private view returns (uint256 best) {
        uint256 low = 1;
        while (low <= high) {
            uint256 mid = (low + high) / 2;
            (bool ok, uint256 out) = _tryQuote(order, tokenIn, tokenOut, mid);
            if (ok && out <= deliverableOut) {
                best = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
    }

    function _tryQuote(
        ISwapVM.Order calldata order,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) private view returns (bool ok, uint256 amountOut) {
        try ISwapVM(address(SWAPVM)).quote(order, tokenIn, tokenOut, amountIn, _takerData()) returns (
            uint256,
            uint256 quotedOut,
            bytes32
        ) {
            return (true, quotedOut);
        } catch {
            return (false, 0);
        }
    }

    function _takerData() private view returns (bytes memory) {
        return TakerTraitsLib.build(TakerTraitsLib.Args({
            taker: address(this),
            isExactIn: true,
            shouldUnwrapWeth: false,
            hasPreTransferInCallback: true,
            hasPreTransferOutCallback: false,
            isStrictThresholdAmount: false,
            isFirstTransferFromTaker: false,
            useTransferFromAndAquaPush: false,
            threshold: "",
            to: address(this),
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

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function _feeAmount(uint256 amountOut) private view returns (uint256) {
        if (feeRecipient == address(0) || feeBps == 0) return 0;
        return amountOut * feeBps / 10_000;
    }

    function _reservedOut(
        Fill[] memory fills,
        uint256 fillCount,
        address maker
    ) private pure returns (uint256 reserved) {
        for (uint256 i = 0; i < fillCount; i++) {
            if (fills[i].order.maker == maker) {
                reserved += fills[i].amountOut;
            }
        }
    }

    function _reservedBudgetIn(
        Fill[] memory fills,
        uint256 fillCount,
        ISwapVM.Order calldata order,
        address tokenIn,
        address tokenOut
    ) private view returns (uint256 reserved) {
        bytes32 orderHash = SWAPVM.hash(order);
        TermRiskBudgetMembership memory membership = _activeMembership(order, orderHash, tokenIn, tokenOut);
        if (!membership.active) return 0;

        for (uint256 i = 0; i < fillCount; i++) {
            bytes32 filledHash = fills[i].orderHash;
            TermRiskBudgetMembership memory filledMembership = termRiskBudgetMemberships[filledHash];
            if (
                filledMembership.active &&
                filledMembership.maker == order.maker &&
                filledMembership.budgetId == membership.budgetId &&
                filledMembership.receiptToken == tokenIn &&
                filledMembership.quoteToken == tokenOut
            ) {
                reserved += fills[i].amountIn;
            }
        }
    }

    function _reservedBudgetOut(
        Fill[] memory fills,
        uint256 fillCount,
        ISwapVM.Order calldata order,
        address tokenIn,
        address tokenOut
    ) private view returns (uint256 reserved) {
        bytes32 orderHash = SWAPVM.hash(order);
        TermRiskBudgetMembership memory membership = _activeMembership(order, orderHash, tokenIn, tokenOut);
        if (!membership.active) return 0;

        for (uint256 i = 0; i < fillCount; i++) {
            bytes32 filledHash = fills[i].orderHash;
            TermRiskBudgetMembership memory filledMembership = termRiskBudgetMemberships[filledHash];
            if (
                filledMembership.active &&
                filledMembership.maker == order.maker &&
                filledMembership.budgetId == membership.budgetId &&
                filledMembership.receiptToken == tokenIn &&
                filledMembership.quoteToken == tokenOut
            ) {
                reserved += fills[i].amountOut;
            }
        }
    }

    function _activeMembership(
        ISwapVM.Order calldata order,
        bytes32 orderHash,
        address tokenIn,
        address tokenOut
    ) private view returns (TermRiskBudgetMembership memory membership) {
        membership = termRiskBudgetMemberships[orderHash];
        if (
            !membership.active ||
            membership.maker != order.maker ||
            membership.receiptToken != tokenIn ||
            membership.quoteToken != tokenOut ||
            !termRiskBudgets[_budgetKey(order.maker, membership.budgetId)].exists
        ) {
            membership.active = false;
        }
    }

    function _remainingBudget(
        address maker,
        bytes32 budgetId,
        uint256 reservedIn,
        uint256 reservedOut
    ) private view returns (uint256 remainingIn, uint256 remainingOut) {
        TermRiskBudget memory budget = termRiskBudgets[_budgetKey(maker, budgetId)];

        if (budget.maxReceiptExposure == 0) {
            remainingIn = type(uint256).max;
        } else if (uint256(budget.receiptExposure) + reservedIn < budget.maxReceiptExposure) {
            remainingIn = uint256(budget.maxReceiptExposure) - uint256(budget.receiptExposure) - reservedIn;
        }

        if (budget.maxQuoteSpend == 0) {
            remainingOut = type(uint256).max;
        } else if (uint256(budget.quoteSpent) + reservedOut < budget.maxQuoteSpend) {
            remainingOut = uint256(budget.maxQuoteSpend) - uint256(budget.quoteSpent) - reservedOut;
        }
    }

    function _recordBudgetFill(
        ISwapVM.Order memory order,
        bytes32 orderHash,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) private {
        TermRiskBudgetMembership memory membership = termRiskBudgetMemberships[orderHash];
        if (
            !membership.active ||
            membership.maker != order.maker ||
            membership.receiptToken != tokenIn ||
            membership.quoteToken != tokenOut
        ) {
            return;
        }

        bytes32 key = _budgetKey(order.maker, membership.budgetId);
        TermRiskBudget storage budget = termRiskBudgets[key];
        if (!budget.exists) return;

        if (amountIn > type(uint128).max || amountOut > type(uint128).max) {
            revert ZubiDubiRouteExecutorBudgetOverflow();
        }

        uint256 receiptExposure = uint256(budget.receiptExposure) + amountIn;
        uint256 quoteSpent = uint256(budget.quoteSpent) + amountOut;

        if (
            (budget.maxReceiptExposure != 0 && receiptExposure > budget.maxReceiptExposure) ||
            (budget.maxQuoteSpend != 0 && quoteSpent > budget.maxQuoteSpend)
        ) {
            revert ZubiDubiRouteExecutorBudgetLimitExceeded(membership.budgetId, receiptExposure, quoteSpent);
        }

        if (receiptExposure > type(uint128).max || quoteSpent > type(uint128).max) {
            revert ZubiDubiRouteExecutorBudgetOverflow();
        }

        budget.receiptExposure = uint128(receiptExposure);
        budget.quoteSpent = uint128(quoteSpent);

        emit ZubiDubiTermRiskBudgetUsed(
            order.maker,
            membership.budgetId,
            orderHash,
            amountIn,
            amountOut,
            receiptExposure,
            quoteSpent
        );
    }

    function _budgetKey(address maker, bytes32 budgetId) private pure returns (bytes32) {
        return keccak256(abi.encode(maker, budgetId));
    }
}
