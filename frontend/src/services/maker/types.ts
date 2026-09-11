export type MakerStrategyBuildRequest = {
  maker: string;
  tokenIn: string;
  tokenOut: string;
  quoteLiquidity: string;
  maxExposure: string;
  maxNotionalOut?: string;
  baseDiscountPct: number;
  annualRatePct: number;
  maxDiscountPct: number;
  inventorySlopePct: number;
  liquiditySlopePct: number;
  riskTier: string;
  minDays: number;
  maxDays: number;
  curveFamily: 0 | 1;
  convexity: number;
  deviationPct: number;
};

export type BuiltMakerStrategy = {
  product: string;
  source: string;
  chainId: number;
  core: {
    aqua: string;
    router: string;
    routeExecutor: string;
  };
  orderHash: string | null;
  order: {
    maker: string;
    traits: string;
    data: `0x${string}`;
  };
  encodedOrder: `0x${string}`;
  tokens: `0x${string}`[];
  amounts: string[];
  market: {
    pair: string;
    receiptSymbol: string;
    quoteSymbol: string;
    receiptDecimals: number;
    quoteDecimals: number;
    maturity: number;
    oracle: {
      symbol: string;
      address: string;
      decimals: number;
    };
  };
  limits: {
    quoteLiquidity: string;
    maxExposure: string;
    maxNotionalOut: string;
  };
};

export type ShipMakerStrategyResult = {
  approvalHash: `0x${string}`;
  shipHash: `0x${string}`;
  orderHash: string | null;
};
