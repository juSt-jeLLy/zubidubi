export type GraphToken = {
  id: string;
  symbol: string;
  name?: string;
  decimals: number;
  isReceipt?: boolean;
};

export type GraphMarket = {
  id: string;
  receiptToken: GraphToken;
  quoteToken: GraphToken;
  totalStrategyCount: string;
  activeStrategyCount: string;
  totalVirtualReceipt: string;
  totalVirtualQuote: string;
  totalReceiptExposure: string;
  totalQuotePulled: string;
  swapCount: string;
  routeCount: string;
  cumulativeVolumeIn: string;
  cumulativeVolumeOut: string;
  cumulativeProtocolSideRevenue: string;
  lastUpdatedBlock: string;
  lastUpdatedTimestamp: string;
};

export type GraphReceiptAsset = {
  id: string;
  token: Pick<GraphToken, "id" | "symbol" | "decimals">;
  underlying: string;
  maturity: string;
  assetsPerReceipt: string;
  totalMinted: string;
  totalBurned: string;
  lastUpdatedBlock: string;
  lastUpdatedTimestamp: string;
};

export type GraphRouteFill = {
  id: string;
  routeTransactionHash: string;
  market: Pick<GraphMarket, "id"> & {
    receiptToken: Pick<GraphToken, "symbol" | "decimals">;
    quoteToken: Pick<GraphToken, "symbol" | "decimals">;
  };
  maker: { id: string };
  amountIn: string;
  amountOut: string;
  executionPriceE18: string;
  timestamp: string;
  blockNumber: string;
};

export type GraphStrategySnapshot = {
  id: string;
  reason: "SHIPPED" | "PUSHED" | "PULLED" | "SWAPPED" | "DOCKED";
  status: "ACTIVE" | "DOCKED";
  market:
    | (Pick<GraphMarket, "id"> & {
        receiptToken: Pick<GraphToken, "symbol">;
        quoteToken: Pick<GraphToken, "symbol" | "decimals">;
      })
    | null;
  strategy: { maker: { id: string } };
  receiptVirtualBalance: string;
  quoteVirtualBalance: string;
  exposureAmount: string;
  quotePulledAmount: string;
  transactionHash: string;
  timestamp: string;
  blockNumber: string;
};

export type GraphRouteFee = {
  id: string;
  market:
    | (Pick<GraphMarket, "id"> & {
        receiptToken: Pick<GraphToken, "symbol">;
        quoteToken: Pick<GraphToken, "symbol">;
      })
    | null;
  token: Pick<GraphToken, "symbol" | "decimals">;
  amount: string;
  transactionHash: string;
  timestamp: string;
  blockNumber: string;
};

export type MarketBoardResponse = {
  _meta: {
    hasIndexingErrors: boolean;
    deployment: string;
    block: { number: number };
  };
  protocol: {
    cumulativeStrategyCount: string;
    cumulativeSwapCount: string;
    cumulativeRouteCount: string;
    cumulativeVolumeIn: string;
    cumulativeVolumeOut: string;
    cumulativeProtocolSideRevenue: string;
    lastUpdatedBlock: string;
    lastUpdatedTimestamp: string;
  } | null;
  markets: GraphMarket[];
  receiptAssets: GraphReceiptAsset[];
  routeFills: GraphRouteFill[];
  strategySnapshots: GraphStrategySnapshot[];
  routeFees: GraphRouteFee[];
};

export type LiveMarket = {
  id: string;
  symbol: string;
  name: string;
  kind: "real";
  tokenIn: string;
  tokenOut: string;
  receiptDecimals: number;
  quoteDecimals: number;
  underlying: string;
  quoteSymbol: string;
  bestDiscount: number | null;
  daysToMaturity: number | null;
  liquidity: number;
  liquidityLabel: string;
  strategies: number;
  routeCount: number;
};

export type LiveActivity = {
  id: string;
  kind: "fill" | "strategy" | "redeem";
  text: string;
  asset: string;
  value: string;
  ago: string;
  blockNumber: number;
};

export type MarketBoard = {
  blockNumber: number | null;
  hasIndexingErrors: boolean;
  protocol: MarketBoardResponse["protocol"];
  markets: LiveMarket[];
  activity: LiveActivity[];
  /** Live receipt assets from the subgraph (backing token, maturity, assetsPerReceipt). */
  receiptAssets: GraphReceiptAsset[];
  /** quoteToken address (lowercased) -> symbol/decimals, used to label backing tokens. */
  underlyingTokens: Record<string, { symbol: string; decimals: number }>;
};
