export type Market = {
  symbol: string;
  name: string;
  kind: "synthetic" | "real";
  bestDiscount: number;
  daysToMaturity: number;
  liquidity: number;
  strategies: number;
  benchmark?: number;
  price: number;
};

export const MARKETS: Market[] = [
  {
    symbol: "PT-zbETH-30D",
    name: "Sepolia PT · WETH backed · 30D",
    kind: "real",
    bestDiscount: 0.5,
    daysToMaturity: 30,
    liquidity: 25,
    strategies: 2,
    benchmark: 0.61,
    price: 0.995,
  },
  {
    symbol: "PT-zbETH-180D",
    name: "Sepolia PT · WETH backed · 180D",
    kind: "real",
    bestDiscount: 0.8,
    daysToMaturity: 180,
    liquidity: 50,
    strategies: 1,
    benchmark: 1.24,
    price: 0.992,
  },
  {
    symbol: "PT-zbUSD-30D",
    name: "Sepolia PT · USDC backed · 30D",
    kind: "real",
    bestDiscount: 0.2,
    daysToMaturity: 30,
    liquidity: 50,
    strategies: 1,
    benchmark: 0.25,
    price: 0.998,
  },
  {
    symbol: "PT-zbUSD-180D",
    name: "Sepolia PT · USDC backed · 180D",
    kind: "real",
    bestDiscount: 0.55,
    daysToMaturity: 180,
    liquidity: 0.05,
    strategies: 1,
    benchmark: 0.87,
    price: 0.9945,
  },
  {
    symbol: "PT-zbLINK-30D",
    name: "Sepolia PT · LINK backed · 30D",
    kind: "real",
    bestDiscount: 0.7,
    daysToMaturity: 30,
    liquidity: 30,
    strategies: 1,
    benchmark: 0.77,
    price: 0.993,
  },
  {
    symbol: "PT-zbLINK-180D",
    name: "Sepolia PT · LINK backed · 180D",
    kind: "real",
    bestDiscount: 1.1,
    daysToMaturity: 180,
    liquidity: 0.08,
    strategies: 1,
    benchmark: 1.64,
    price: 0.989,
  },
];

export type MakerFill = {
  maker: string;
  ens?: string;
  amount: number;
  discount: number;
  status: "filled" | "skipped-insolvent" | "skipped-exposure" | "skipped-oracle";
  reason?: string;
};

export function quoteFor(market: Market, amount: number): MakerFill[] {
  const seedRows: Omit<MakerFill, "amount">[] = [
    {
      maker: "0x8f21…c4a9",
      ens: "steadyrate.eth",
      discount: market.bestDiscount,
      status: "filled",
    },
    {
      maker: "0x1b90…77de",
      ens: "convexdesk.eth",
      discount: market.bestDiscount + 0.18,
      status: "filled",
    },
    {
      maker: "0x44c1…9012",
      discount: market.bestDiscount + 0.09,
      status: "skipped-insolvent",
      reason: "Maker collateral below required solvency ratio at quote time.",
    },
    {
      maker: "0xaa07…31f5",
      ens: "lrtvault.eth",
      discount: market.bestDiscount + 0.31,
      status: "filled",
    },
    {
      maker: "0x6d3e…b8c2",
      discount: market.bestDiscount + 0.12,
      status: "skipped-exposure",
      reason: "Per-asset exposure cap reached (98.4% of 2.0M used).",
    },
    {
      maker: "0xf012…5a6b",
      ens: "tenor.eth",
      discount: market.bestDiscount + 0.44,
      status: "filled",
    },
    {
      maker: "0x93bd…10aa",
      discount: market.bestDiscount + 0.05,
      status: "skipped-oracle",
      reason: "Primary/secondary oracle deviation 0.74% > 0.50% tolerance.",
    },
  ];

  const weights = [0.34, 0.26, 0, 0.19, 0, 0.21, 0];
  return seedRows.map((r, i) => ({ ...r, amount: amount * (weights[i] ?? 0) }));
}

export type Activity = {
  kind: "fill" | "strategy" | "redeem";
  text: string;
  asset: string;
  value: string;
  ago: string;
};

export const ACTIVITY: Activity[] = [
  {
    kind: "strategy",
    text: "Strategy shipped · Chainlink ETH/USDC ratio",
    asset: "PT-zbETH-30D",
    value: "$25",
    ago: "now",
  },
  {
    kind: "strategy",
    text: "Strategy shipped · Chainlink ETH/WETH ratio",
    asset: "PT-zbETH-30D",
    value: "0.02 WETH",
    ago: "now",
  },
  {
    kind: "strategy",
    text: "Strategy shipped · Chainlink USDC/USDC ratio",
    asset: "PT-zbUSD-30D",
    value: "$50",
    ago: "1m",
  },
  {
    kind: "strategy",
    text: "Strategy shipped · Chainlink LINK/USDC ratio",
    asset: "PT-zbLINK-30D",
    value: "$30",
    ago: "1m",
  },
  {
    kind: "strategy",
    text: "Strategy shipped · 180D inventory curve",
    asset: "PT-zbLINK-180D",
    value: "0.08 WETH",
    ago: "2m",
  },
  {
    kind: "redeem",
    text: "Maturity-gated redemption enabled",
    asset: "PT-zbUSD-180D",
    value: "1:1 USDC",
    ago: "2m",
  },
];

export type Strategy = {
  id: string;
  pair: string;
  base: number;
  maxDiscount: number;
  curve: "linear" | "convex";
  tier: "conservative" | "balanced" | "aggressive";
  exposureUsed: number;
  exposureCap: number;
  feesEarned: number;
};

export const MY_STRATEGIES: Strategy[] = [
  {
    id: "STR-2041",
    pair: "PT-zbETH-30D → USDC",
    base: 0.5,
    maxDiscount: 8,
    curve: "convex",
    tier: "balanced",
    exposureUsed: 0,
    exposureCap: 0.03,
    feesEarned: 0,
  },
  {
    id: "STR-2088",
    pair: "PT-zbUSD-180D → WETH",
    base: 0.55,
    maxDiscount: 9.5,
    curve: "convex",
    tier: "aggressive",
    exposureUsed: 0,
    exposureCap: 75_000,
    feesEarned: 0,
  },
  {
    id: "STR-2113",
    pair: "PT-zbLINK-30D → USDC",
    base: 0.7,
    maxDiscount: 12,
    curve: "convex",
    tier: "conservative",
    exposureUsed: 0,
    exposureCap: 5_000,
    feesEarned: 0,
  },
];

export type Holding = {
  symbol: string;
  amount: number;
  valueUsd: number;
  maturesInDays: number;
  entryDiscount: number;
  underlying: string;
  status: "active" | "matured" | "redeeming";
};

export const HOLDINGS: Holding[] = [
  {
    symbol: "PT-zbETH-30D",
    amount: 0.25,
    valueUsd: 625,
    maturesInDays: 30,
    entryDiscount: 0.5,
    underlying: "WETH",
    status: "active",
  },
  {
    symbol: "PT-zbUSD-30D",
    amount: 750,
    valueUsd: 748.5,
    maturesInDays: 30,
    entryDiscount: 0.2,
    underlying: "USDC",
    status: "active",
  },
  {
    symbol: "PT-zbLINK-180D",
    amount: 120,
    valueUsd: 2_160,
    maturesInDays: 180,
    entryDiscount: 1.1,
    underlying: "LINK",
    status: "active",
  },
  {
    symbol: "PT-zbUSD-180D",
    amount: 250,
    valueUsd: 248.6,
    maturesInDays: 180,
    entryDiscount: 0.55,
    underlying: "USDC",
    status: "redeeming",
  },
];

export type Redemption = {
  id: string;
  asset: string;
  amount: number;
  underlying: string;
  maturity: string;
  state: "ready" | "pending" | "claimed";
};

export const REDEMPTIONS: Redemption[] = [
  {
    id: "RDM-0914",
    asset: "PT-zbETH-30D",
    amount: 0.25,
    underlying: "WETH",
    maturity: "Oct 10, 2026",
    state: "pending",
  },
  {
    id: "RDM-0918",
    asset: "PT-zbUSD-180D",
    amount: 250,
    underlying: "USDC",
    maturity: "Mar 9, 2027",
    state: "pending",
  },
  {
    id: "RDM-0844",
    asset: "PT-zbLINK-180D",
    amount: 120,
    underlying: "LINK",
    maturity: "Mar 9, 2027",
    state: "pending",
  },
];

export type RoutePreview = {
  asset: string;
  amount: number;
  netUsd: number;
  fills: number;
  skipped: number;
  feeUsd: number;
  bestMaker: string;
};

export const ROUTE_PREVIEWS: RoutePreview[] = [
  {
    asset: "PT-zbETH-30D",
    amount: 0.003,
    netUsd: 7.22,
    fills: 2,
    skipped: 0,
    feeUsd: 0.01,
    bestMaker: "steadyrate.eth",
  },
  {
    asset: "PT-zbUSD-30D",
    amount: 25,
    netUsd: 24.94,
    fills: 1,
    skipped: 0,
    feeUsd: 0.02,
    bestMaker: "convexdesk.eth",
  },
  {
    asset: "PT-zbLINK-30D",
    amount: 10,
    netUsd: 177.8,
    fills: 1,
    skipped: 0,
    feeUsd: 0.18,
    bestMaker: "tenor.eth",
  },
];

export type OracleSource = {
  name: string;
  scope: string;
  freshness: string;
  deviationBps: number;
  state: "primary" | "secondary" | "benchmark";
};

export const ORACLE_SOURCES: OracleSource[] = [
  {
    name: "Chainlink ETH/USD",
    scope: "Underlying backing value",
    freshness: "14s",
    deviationBps: 0,
    state: "primary",
  },
  {
    name: "Chainlink USDC/USD",
    scope: "USD receipt backing value",
    freshness: "1 block",
    deviationBps: 0,
    state: "primary",
  },
  {
    name: "Chainlink LINK/USD",
    scope: "LINK receipt backing value",
    freshness: "1 block",
    deviationBps: 0,
    state: "primary",
  },
  {
    name: "Pyth ETH/USD",
    scope: "Dual-oracle guard for ETH markets",
    freshness: "8s",
    deviationBps: 7,
    state: "secondary",
  },
  {
    name: "PT-USD3 (real-asset fork)",
    scope: "Mainnet-fork benchmark rate",
    freshness: "1 block",
    deviationBps: 31,
    state: "benchmark",
  },
  {
    name: "Subgraph Studio",
    scope: "Strategy discovery",
    freshness: "Live",
    deviationBps: 0,
    state: "benchmark",
  },
];

export type PlaygroundRun = {
  label: string;
  command: string;
  result: string;
  state: "ready" | "running" | "verified";
};

export const PLAYGROUND_RUNS: PlaygroundRun[] = [
  {
    label: "Graph solver quote",
    command: "npm run zubidubi:graph-quote",
    result: "Discovers 3 strategies, re-quotes against Sepolia route executor.",
    state: "verified",
  },
  {
    label: "Execute routed exit",
    command: "ZUBIDUBI_EXECUTE=1 npm run zubidubi:graph-quote",
    result: "Mints backed receipt, splits fill, sends DAO fee, settles atomically.",
    state: "ready",
  },
  {
    label: "Fork benchmark",
    command: "npm run zubidubi:pendle-benchmark",
    result: "Routes a real principal token across maker term curves on a live mainnet fork.",
    state: "verified",
  },
  {
    label: "Invariant suite",
    command: "forge test --match-contract ZubiDubi",
    result: "Solvency, exposure, stale oracle, fee conservation, maturity redemption.",
    state: "verified",
  },
];

export type Property = {
  name: string;
  description: string;
  status: "pass" | "pass-fuzz" | "skipped";
  runs: string;
};

export const PROPERTIES: Property[] = [
  {
    name: "solvency_invariant",
    description: "Maker collateral always ≥ sum of outstanding obligations.",
    status: "pass",
    runs: "1,000,000 calls",
  },
  {
    name: "no_overfill",
    description: "A route never fills more than the taker's requested amount.",
    status: "pass",
    runs: "512,000 calls",
  },
  {
    name: "discount_monotonic",
    description: "Discount is non-increasing as time-to-maturity shrinks.",
    status: "pass-fuzz",
    runs: "250,000 runs",
  },
  {
    name: "exposure_cap_respected",
    description: "Per-strategy exposure never exceeds the configured cap.",
    status: "pass",
    runs: "1,000,000 calls",
  },
  {
    name: "oracle_deviation_guard",
    description: "Quotes revert when primary/secondary oracles deviate past tolerance.",
    status: "pass-fuzz",
    runs: "180,000 runs",
  },
  {
    name: "redeem_after_maturity",
    description: "Receipts are redeemable 1:1 once past maturity timestamp.",
    status: "pass",
    runs: "640,000 calls",
  },
  {
    name: "fee_conservation",
    description: "Protocol fee + maker proceeds + taker proceeds = notional.",
    status: "pass",
    runs: "1,000,000 calls",
  },
  {
    name: "reentrancy_route_exec",
    description: "Route execution is non-reentrant across nested maker callbacks.",
    status: "skipped",
    runs: "pending harness",
  },
];

export const fmtUsd = (n: number, digits = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtCompact = (n: number) =>
  `$${n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 })}`;

export const fmtNum = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Discount curve: discount % as a function of days to maturity. */
export function curvePoints(opts: {
  base: number;
  annualRate: number;
  maxDiscount: number;
  convex: boolean;
  convexity: number;
  maxDays: number;
}) {
  const pts: { days: number; discount: number }[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const days = (opts.maxDays / steps) * i;
    const t = days / 365;
    const linear = opts.base + opts.annualRate * t;
    const shaped = opts.convex
      ? opts.base +
        ((opts.annualRate * opts.maxDays) / 365) * Math.pow(days / opts.maxDays, opts.convexity)
      : linear;
    pts.push({ days: Math.round(days), discount: Math.min(shaped, opts.maxDiscount) });
  }
  return pts;
}
