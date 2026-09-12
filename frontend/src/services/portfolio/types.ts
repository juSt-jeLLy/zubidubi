import type {
  GraphMarket,
  GraphReceiptAsset,
  GraphTermRiskBudget,
  GraphToken,
} from "@/services/markets/types";

export type PortfolioGraphStrategy = {
  id: string;
  orderHash: string;
  status: "ACTIVE" | "DOCKED";
  market:
    | (Pick<GraphMarket, "id"> & {
        receiptToken: Pick<GraphToken, "id" | "symbol" | "decimals">;
        quoteToken: Pick<GraphToken, "id" | "symbol" | "decimals">;
      })
    | null;
  receiptToken: Pick<GraphToken, "id" | "symbol" | "decimals"> | null;
  quoteToken: Pick<GraphToken, "id" | "symbol" | "decimals"> | null;
  receiptVirtualBalance: string;
  quoteVirtualBalance: string;
  exposureAmount: string;
  quotePulledAmount: string;
  budget: Pick<
    GraphTermRiskBudget,
    | "id"
    | "budgetId"
    | "maxReceiptExposure"
    | "maxQuoteSpend"
    | "receiptExposure"
    | "quoteSpent"
    | "pressurePenaltyBps"
    | "assignmentCount"
    | "fillCount"
  > | null;
  createdAtBlock: string;
  createdAtTimestamp: string;
  updatedAtBlock: string;
  updatedAtTimestamp: string;
};

export type PortfolioGraphRoute = {
  id: string;
  market:
    | (Pick<GraphMarket, "id"> & {
        receiptToken: Pick<GraphToken, "id" | "symbol" | "decimals">;
        quoteToken: Pick<GraphToken, "id" | "symbol" | "decimals">;
      })
    | null;
  taker: { id: string };
  recipient: { id: string };
  tokenIn: Pick<GraphToken, "id" | "symbol" | "decimals">;
  tokenOut: Pick<GraphToken, "id" | "symbol" | "decimals">;
  amountIn: string;
  netAmountOut: string;
  fills: string;
  feeAmount: string;
  blockNumber: string;
  timestamp: string;
  transactionHash: string;
};

export type PortfolioGraphFill = {
  id: string;
  routeTransactionHash: string;
  strategy: { id: string } | null;
  market:
    | (Pick<GraphMarket, "id"> & {
        receiptToken: Pick<GraphToken, "id" | "symbol" | "decimals">;
        quoteToken: Pick<GraphToken, "id" | "symbol" | "decimals">;
      })
    | null;
  maker: { id: string };
  taker: { id: string };
  tokenIn: Pick<GraphToken, "id" | "symbol" | "decimals">;
  tokenOut: Pick<GraphToken, "id" | "symbol" | "decimals">;
  amountIn: string;
  amountOut: string;
  executionPriceE18: string;
  blockNumber: string;
  timestamp: string;
};

export type PortfolioGraphFee = {
  id: string;
  market:
    | (Pick<GraphMarket, "id"> & {
        receiptToken: Pick<GraphToken, "id" | "symbol">;
        quoteToken: Pick<GraphToken, "id" | "symbol">;
      })
    | null;
  token: Pick<GraphToken, "id" | "symbol" | "decimals">;
  amount: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
};

export type PortfolioGraphResponse = {
  _meta: {
    hasIndexingErrors: boolean;
    block: { number: number };
  };
  receiptAssets: GraphReceiptAsset[];
  markets: GraphMarket[];
  makerStrategies: PortfolioGraphStrategy[];
  takerRoutes: PortfolioGraphRoute[];
  recipientRoutes: PortfolioGraphRoute[];
  takerFills: PortfolioGraphFill[];
  makerFills: PortfolioGraphFill[];
  makerFees: PortfolioGraphFee[];
};

export type ReceiptPosition = {
  id: string;
  symbol: string;
  receiptAddress: `0x${string}`;
  receiptDecimals: number;
  underlying: string;
  underlyingAddress: `0x${string}`;
  underlyingDecimals: number;
  maturityUnix: number;
  maturityLabel: string;
  daysToMaturity: number;
  isMatured: boolean;
  rawBalance: bigint;
  formattedBalance: string;
  numericBalance: number;
  rawRedeemable: bigint;
  formattedRedeemable: string;
  claimable: boolean;
  sellRoutes: string[];
};

export type MakerStrategyPosition = {
  id: string;
  pair: string;
  status: "ACTIVE" | "DOCKED";
  receiptSymbol: string;
  quoteSymbol: string;
  quoteDecimals: number;
  receiptDecimals: number;
  quoteLiquidity: string;
  receiptInventory: string;
  exposure: string;
  quotePulled: string;
  exposurePct: number;
  budgetId: string | null;
  budgetReceiptUsagePct: number | null;
  budgetQuoteUsagePct: number | null;
  budgetReceiptExposure: string | null;
  budgetQuoteSpent: string | null;
  budgetPressureBps: number | null;
  budgetAssignmentCount: number | null;
  updatedAgo: string;
};

export type PortfolioRouteHistory = {
  id: string;
  kind: "route" | "fill" | "fee" | "claim";
  title: string;
  subtitle: string;
  amountIn: string;
  amountOut: string;
  fee: string;
  fills: number | null;
  timestamp: number;
  blockNumber: number | null;
  txHash: string;
};

export type LocalClaimHistory = {
  id: string;
  symbol: string;
  amount: string;
  underlying: string;
  txHash: string;
  timestamp: number;
};

export type LivePortfolio = {
  blockNumber: number | null;
  hasIndexingErrors: boolean;
  holdings: ReceiptPosition[];
  strategies: MakerStrategyPosition[];
  redemptionQueue: ReceiptPosition[];
  routeHistory: PortfolioRouteHistory[];
  totals: {
    claimCount: number;
    claimableCount: number;
    activeStrategyCount: number;
    routeCount: number;
    feeEvents: number;
  };
};
