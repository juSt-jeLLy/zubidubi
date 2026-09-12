import { formatUnits } from "viem";

import type { LiveMarket } from "@/services/markets/types";
import type {
  LivePortfolio,
  LocalClaimHistory,
  MakerStrategyPosition,
  PortfolioGraphFee,
  PortfolioGraphFill,
  PortfolioGraphResponse,
  PortfolioGraphRoute,
  PortfolioRouteHistory,
  ReceiptPosition,
} from "./types";

function asBigInt(value: string | undefined) {
  try {
    return BigInt(value ?? "0");
  } catch {
    return 0n;
  }
}

function asNumber(value: string | undefined) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function tokenAmount(raw: string, decimals: number, symbol: string, maxFractionDigits = 6) {
  const value = Number(formatUnits(asBigInt(raw), decimals));
  return `${value.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits })} ${symbol}`;
}

function timeAgo(timestamp: number) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function shortHash(hash: string) {
  return hash ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : "pending";
}

function pct(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) return null;
  return Math.min(100, Number((numerator * 10_000n) / denominator) / 100);
}

function mapStrategy(strategy: PortfolioGraphResponse["makerStrategies"][number]): MakerStrategyPosition {
  const receipt = strategy.market?.receiptToken ?? strategy.receiptToken;
  const quote = strategy.market?.quoteToken ?? strategy.quoteToken;
  const receiptSymbol = receipt?.symbol ?? "receipt";
  const quoteSymbol = quote?.symbol ?? "quote";
  const receiptDecimals = receipt?.decimals ?? 18;
  const quoteDecimals = quote?.decimals ?? 18;
  const quoteOpen = asBigInt(strategy.quoteVirtualBalance) - asBigInt(strategy.quotePulledAmount);
  const receiptInventory = asBigInt(strategy.receiptVirtualBalance);
  const exposure = asBigInt(strategy.exposureAmount);
  const exposurePct =
    receiptInventory > 0n
      ? Math.min(100, Number((exposure * 10_000n) / receiptInventory) / 100)
      : exposure > 0n
        ? 100
        : 0;
  const budget = strategy.budget;
  const budgetReceiptUsagePct = budget
    ? pct(asBigInt(budget.receiptExposure), asBigInt(budget.maxReceiptExposure))
    : null;
  const budgetQuoteUsagePct = budget
    ? pct(asBigInt(budget.quoteSpent), asBigInt(budget.maxQuoteSpend))
    : null;

  return {
    id: strategy.id,
    pair: `${receiptSymbol} -> ${quoteSymbol}`,
    status: strategy.status,
    receiptSymbol,
    quoteSymbol,
    quoteDecimals,
    receiptDecimals,
    quoteLiquidity: tokenAmount(quoteOpen > 0n ? quoteOpen.toString() : "0", quoteDecimals, quoteSymbol),
    receiptInventory: tokenAmount(strategy.receiptVirtualBalance, receiptDecimals, receiptSymbol),
    exposure: tokenAmount(strategy.exposureAmount, receiptDecimals, receiptSymbol),
    quotePulled: tokenAmount(strategy.quotePulledAmount, quoteDecimals, quoteSymbol),
    exposurePct,
    budgetId: budget?.budgetId ?? null,
    budgetReceiptUsagePct,
    budgetQuoteUsagePct,
    budgetReceiptExposure: budget
      ? `${tokenAmount(budget.receiptExposure, receiptDecimals, receiptSymbol)} / ${tokenAmount(
          budget.maxReceiptExposure,
          receiptDecimals,
          receiptSymbol,
        )}`
      : null,
    budgetQuoteSpent: budget
      ? `${tokenAmount(budget.quoteSpent, quoteDecimals, quoteSymbol)} / ${tokenAmount(
          budget.maxQuoteSpend,
          quoteDecimals,
          quoteSymbol,
        )}`
      : null,
    budgetPressureBps: budget ? asNumber(budget.pressurePenaltyBps) : null,
    budgetAssignmentCount: budget ? asNumber(budget.assignmentCount) : null,
    updatedAgo: timeAgo(asNumber(strategy.updatedAtTimestamp)),
  };
}

function routeKey(route: PortfolioGraphRoute) {
  return route.transactionHash || route.id;
}

function mapRoute(route: PortfolioGraphRoute): PortfolioRouteHistory {
  return {
    id: `route-${route.id}`,
    kind: "route",
    title: `${route.tokenIn.symbol} -> ${route.tokenOut.symbol}`,
    subtitle: `${route.fills} maker fill${route.fills === "1" ? "" : "s"} · tx ${shortHash(route.transactionHash)}`,
    amountIn: tokenAmount(route.amountIn, route.tokenIn.decimals, route.tokenIn.symbol),
    amountOut: tokenAmount(route.netAmountOut, route.tokenOut.decimals, route.tokenOut.symbol),
    fee: tokenAmount(route.feeAmount, route.tokenOut.decimals, route.tokenOut.symbol),
    fills: asNumber(route.fills),
    timestamp: asNumber(route.timestamp),
    blockNumber: asNumber(route.blockNumber),
    txHash: route.transactionHash,
  };
}

function mapFill(fill: PortfolioGraphFill): PortfolioRouteHistory {
  return {
    id: `fill-${fill.id}`,
    kind: "fill",
    title: `${fill.tokenIn.symbol} fill into ${fill.tokenOut.symbol}`,
    subtitle: `Counterparty ${fill.maker.id.slice(0, 6)}...${fill.maker.id.slice(-4)}`,
    amountIn: tokenAmount(fill.amountIn, fill.tokenIn.decimals, fill.tokenIn.symbol),
    amountOut: tokenAmount(fill.amountOut, fill.tokenOut.decimals, fill.tokenOut.symbol),
    fee: "Included in route",
    fills: null,
    timestamp: asNumber(fill.timestamp),
    blockNumber: asNumber(fill.blockNumber),
    txHash: fill.routeTransactionHash,
  };
}

function mapFee(fee: PortfolioGraphFee): PortfolioRouteHistory {
  return {
    id: `fee-${fee.id}`,
    kind: "fee",
    title: `DAO fee · ${fee.token.symbol}`,
    subtitle: fee.market
      ? `${fee.market.receiptToken.symbol} / ${fee.market.quoteToken.symbol}`
      : "Protocol revenue",
    amountIn: "-",
    amountOut: tokenAmount(fee.amount, fee.token.decimals, fee.token.symbol),
    fee: tokenAmount(fee.amount, fee.token.decimals, fee.token.symbol),
    fills: null,
    timestamp: asNumber(fee.timestamp),
    blockNumber: asNumber(fee.blockNumber),
    txHash: fee.transactionHash,
  };
}

function mapClaim(claim: LocalClaimHistory): PortfolioRouteHistory {
  return {
    id: claim.id,
    kind: "claim",
    title: `Redeemed ${claim.symbol}`,
    subtitle: `Claimed into ${claim.underlying} · tx ${shortHash(claim.txHash)}`,
    amountIn: claim.symbol,
    amountOut: `${claim.amount} ${claim.underlying}`,
    fee: "0",
    fills: null,
    timestamp: claim.timestamp,
    blockNumber: null,
    txHash: claim.txHash,
  };
}

export function mapLivePortfolio({
  graph,
  holdings,
  markets,
  claimHistory,
}: {
  graph: PortfolioGraphResponse;
  holdings: ReceiptPosition[];
  markets: LiveMarket[];
  claimHistory: LocalClaimHistory[];
}): LivePortfolio {
  const routeMap = new Map<string, PortfolioGraphRoute>();
  for (const route of [...graph.takerRoutes, ...graph.recipientRoutes]) {
    routeMap.set(routeKey(route), route);
  }

  const activeStrategies = graph.makerStrategies.filter((strategy) => strategy.status === "ACTIVE");
  const routeHistory = [
    ...Array.from(routeMap.values()).map(mapRoute),
    ...graph.takerFills.map(mapFill),
    ...graph.makerFills.map(mapFill),
    ...graph.makerFees.map(mapFee),
    ...claimHistory.map(mapClaim),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 60);

  return {
    blockNumber: graph._meta.block?.number ?? null,
    hasIndexingErrors: graph._meta.hasIndexingErrors,
    holdings,
    strategies: graph.makerStrategies.map(mapStrategy),
    redemptionQueue: holdings.filter((holding) => holding.rawBalance > 0n),
    routeHistory,
    totals: {
      claimCount: holdings.filter((holding) => holding.rawBalance > 0n).length,
      claimableCount: holdings.filter((holding) => holding.claimable).length,
      activeStrategyCount: activeStrategies.length,
      routeCount: routeMap.size,
      feeEvents: graph.makerFees.length,
    },
  };
}
