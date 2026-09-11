import { formatUnits } from "viem";

import type {
  GraphMarket,
  GraphReceiptAsset,
  GraphRouteFee,
  GraphRouteFill,
  GraphStrategySnapshot,
  LiveActivity,
  LiveMarket,
  MarketBoard,
  MarketBoardResponse,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ONE_E18 = 1_000_000_000_000_000_000n;

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

function amount(value: string, decimals: number) {
  return Number(formatUnits(asBigInt(value), decimals));
}

function compactNumber(value: number, maxFractionDigits = 3) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function formatTokenAmount(value: string, decimals: number, symbol: string) {
  return `${compactNumber(amount(value, decimals))} ${symbol}`;
}

function shortAddress(address: string) {
  if (!address) return "unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function timeAgo(timestamp: string) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - asNumber(timestamp));

  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function inferUnderlyingSymbol(symbol: string, underlying?: string) {
  const upper = symbol.toUpperCase();
  if (upper.includes("ETH")) return "WETH";
  if (upper.includes("LINK")) return "LINK";
  if (upper.includes("USD")) return "USDC";
  if (underlying) return shortAddress(underlying);
  return "underlying";
}

function daysToMaturity(receipt?: GraphReceiptAsset) {
  if (!receipt) return null;
  return Math.max(0, Math.ceil((asNumber(receipt.maturity) * 1000 - Date.now()) / DAY_MS));
}

function inferDiscountFromFill(
  market: GraphMarket,
  receipt?: GraphReceiptAsset,
  fill?: GraphRouteFill,
) {
  if (!fill) return null;

  const underlying = inferUnderlyingSymbol(market.receiptToken.symbol, receipt?.underlying);
  const quote = market.quoteToken.symbol.toUpperCase();
  const canCompareToPar =
    quote === underlying.toUpperCase() ||
    (quote === "USDC" && underlying.toUpperCase().includes("USD"));

  if (!canCompareToPar) return null;

  const priceE18 = asBigInt(fill.executionPriceE18);
  if (priceE18 <= 0n || priceE18 > ONE_E18 * 2n) return null;

  const price = Number(formatUnits(priceE18, 18));
  return Math.max(0, (1 - price) * 100);
}

function mapMarket(
  market: GraphMarket,
  receiptsByToken: Map<string, GraphReceiptAsset>,
  latestFillByMarket: Map<string, GraphRouteFill>,
): LiveMarket {
  const receipt = receiptsByToken.get(market.receiptToken.id.toLowerCase());
  const underlying = inferUnderlyingSymbol(market.receiptToken.symbol, receipt?.underlying);
  const openQuoteLiquidity = asBigInt(market.totalVirtualQuote) - asBigInt(market.totalQuotePulled);
  const quoteLiquidity = openQuoteLiquidity > 0n ? openQuoteLiquidity : 0n;

  return {
    id: market.id,
    symbol: market.receiptToken.symbol,
    name: `${market.quoteToken.symbol} exit · ${underlying} backed`,
    kind: "real",
    tokenIn: market.receiptToken.id,
    tokenOut: market.quoteToken.id,
    receiptDecimals: market.receiptToken.decimals,
    quoteDecimals: market.quoteToken.decimals,
    underlying,
    quoteSymbol: market.quoteToken.symbol,
    bestDiscount: inferDiscountFromFill(market, receipt, latestFillByMarket.get(market.id)),
    daysToMaturity: daysToMaturity(receipt),
    liquidity: Number(formatUnits(quoteLiquidity, market.quoteToken.decimals)),
    liquidityLabel: formatTokenAmount(
      quoteLiquidity.toString(),
      market.quoteToken.decimals,
      market.quoteToken.symbol,
    ),
    strategies: asNumber(market.activeStrategyCount),
    routeCount: asNumber(market.routeCount),
  };
}

function activityFromFill(fill: GraphRouteFill): LiveActivity {
  return {
    id: `fill-${fill.id}`,
    kind: "fill",
    asset: fill.market.receiptToken.symbol,
    text: `Routed fill · maker ${shortAddress(fill.maker.id)}`,
    value: formatTokenAmount(
      fill.amountOut,
      fill.market.quoteToken.decimals,
      fill.market.quoteToken.symbol,
    ),
    ago: timeAgo(fill.timestamp),
    blockNumber: asNumber(fill.blockNumber),
  };
}

function activityFromSnapshot(snapshot: GraphStrategySnapshot): LiveActivity | null {
  if (!snapshot.market) return null;

  const label =
    snapshot.reason === "SHIPPED"
      ? "Strategy shipped"
      : snapshot.reason === "DOCKED"
        ? "Strategy docked"
        : snapshot.reason === "SWAPPED"
          ? "Strategy filled"
          : snapshot.reason === "PUSHED"
            ? "Maker liquidity pushed"
            : "Maker liquidity pulled";

  return {
    id: `snapshot-${snapshot.id}`,
    kind: snapshot.reason === "DOCKED" ? "redeem" : "strategy",
    asset: snapshot.market.receiptToken.symbol,
    text: `${label} · ${snapshot.market.quoteToken.symbol} liquidity`,
    value: formatTokenAmount(
      snapshot.quoteVirtualBalance,
      snapshot.market.quoteToken.decimals,
      snapshot.market.quoteToken.symbol,
    ),
    ago: timeAgo(snapshot.timestamp),
    blockNumber: asNumber(snapshot.blockNumber),
  };
}

function activityFromFee(fee: GraphRouteFee): LiveActivity {
  return {
    id: `fee-${fee.id}`,
    kind: "redeem",
    asset: fee.market?.receiptToken.symbol ?? "DAO",
    text: `DAO revenue accrued · ${fee.token.symbol}`,
    value: formatTokenAmount(fee.amount, fee.token.decimals, fee.token.symbol),
    ago: timeAgo(fee.timestamp),
    blockNumber: asNumber(fee.blockNumber),
  };
}

export function mapMarketBoard(data: MarketBoardResponse): MarketBoard {
  const receiptsByToken = new Map(
    data.receiptAssets.map((receipt) => [receipt.token.id.toLowerCase(), receipt] as const),
  );
  const latestFillByMarket = new Map<string, GraphRouteFill>();

  for (const fill of data.routeFills) {
    if (!latestFillByMarket.has(fill.market.id)) {
      latestFillByMarket.set(fill.market.id, fill);
    }
  }

  const underlyingTokens: Record<string, { symbol: string; decimals: number }> = {};
  for (const market of data.markets) {
    underlyingTokens[market.quoteToken.id.toLowerCase()] = {
      symbol: market.quoteToken.symbol,
      decimals: market.quoteToken.decimals,
    };
  }

  const activity = [
    ...data.routeFills.map(activityFromFill),
    ...data.strategySnapshots
      .map(activityFromSnapshot)
      .filter((item): item is LiveActivity => Boolean(item)),
    ...data.routeFees.map(activityFromFee),
  ]
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, 30);

  return {
    blockNumber: data._meta.block?.number ?? null,
    hasIndexingErrors: data._meta.hasIndexingErrors,
    protocol: data.protocol,
    markets: data.markets
      .map((market) => mapMarket(market, receiptsByToken, latestFillByMarket))
      .sort((a, b) => b.strategies - a.strategies || a.symbol.localeCompare(b.symbol)),
    activity,
    receiptAssets: data.receiptAssets,
    underlyingTokens,
  };
}
