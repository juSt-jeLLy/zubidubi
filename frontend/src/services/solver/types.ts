export type SolverFill = {
  maker: string;
  orderHash: string;
  fillIn: string;
  amountOut: string;
  deliverableOut: string;
};

export type SolverSkippedMaker = {
  maker: string;
  orderHash: string;
  deliverableOut?: string;
  reason?: string;
};

export type SolverRouteFill = {
  maker: string;
  orderHash: string;
  fillIn: string;
  estimatedGrossOut: string;
};

export type SolverQuote = {
  product: string;
  thesis: string;
  source: string;
  graphEndpoint: string;
  routeExecutor: string;
  tokenIn: string;
  tokenOut: string;
  indexedStrategies: number;
  canExecute: boolean;
  fillStatus: "FULL" | "PARTIAL" | "NONE";
  requestedReceiptIn: string;
  quotedReceiptIn: string;
  shortfallReceiptIn: string;
  quotedNetOut: string;
  benchmark?: {
    source: "par" | "pendle" | "oracle" | "none";
    label: string;
    rate: string | null;
    deltaBps: number | null;
    note: string;
  };
  routePreview: {
    note: string;
    requestedIn: string;
    filledIn: string;
    unfilledIn: string;
    fills: SolverRouteFill[];
  };
  quoteCandidates: SolverFill[];
  skippedMakers: SolverSkippedMaker[];
  execution: {
    routeExecutor: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    receiptDecimals: number;
    quoteTokenDecimals: number;
    orders: {
      maker: string;
      traits: string;
      data: `0x${string}`;
    }[];
  } | null;
};

export type SolverQuoteError = Error & {
  code?: string;
  quote?: SolverQuote;
};
