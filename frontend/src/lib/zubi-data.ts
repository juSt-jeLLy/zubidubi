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
    symbol: "PT-USD3",
    name: "Pendle PT · USD3 · Mar 27",
    kind: "real",
    bestDiscount: 1.84,
    daysToMaturity: 62,
    liquidity: 4_820_000,
    strategies: 14,
    benchmark: 2.31,
    price: 0.9842,
  },
  {
    symbol: "zbETH",
    name: "ZubiDubi LRT receipt · ETH",
    kind: "synthetic",
    bestDiscount: 2.42,
    daysToMaturity: 118,
    liquidity: 2_140_000,
    strategies: 9,
    price: 0.9758,
  },
  {
    symbol: "PT-sUSDe",
    name: "Pendle PT · sUSDe · Feb 26",
    kind: "real",
    bestDiscount: 1.12,
    daysToMaturity: 33,
    liquidity: 6_310_000,
    strategies: 21,
    benchmark: 1.44,
    price: 0.9891,
  },
  {
    symbol: "zbSOL",
    name: "ZubiDubi LRT receipt · SOL",
    kind: "synthetic",
    bestDiscount: 3.06,
    daysToMaturity: 201,
    liquidity: 890_000,
    strategies: 5,
    price: 0.9694,
  },
  {
    symbol: "PT-weETH",
    name: "Pendle PT · weETH · Jun 26",
    kind: "real",
    bestDiscount: 2.71,
    daysToMaturity: 149,
    liquidity: 1_760_000,
    strategies: 11,
    benchmark: 3.02,
    price: 0.9731,
  },
  {
    symbol: "zbUSD",
    name: "ZubiDubi receipt · USD basket",
    kind: "synthetic",
    bestDiscount: 0.94,
    daysToMaturity: 21,
    liquidity: 3_305_000,
    strategies: 8,
    price: 0.9908,
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
    { maker: "0x8f21…c4a9", ens: "steadyrate.eth", discount: market.bestDiscount, status: "filled" },
    { maker: "0x1b90…77de", ens: "convexdesk.eth", discount: market.bestDiscount + 0.18, status: "filled" },
    {
      maker: "0x44c1…9012",
      discount: market.bestDiscount + 0.09,
      status: "skipped-insolvent",
      reason: "Maker collateral below required solvency ratio at quote time.",
    },
    { maker: "0xaa07…31f5", ens: "lrtvault.eth", discount: market.bestDiscount + 0.31, status: "filled" },
    {
      maker: "0x6d3e…b8c2",
      discount: market.bestDiscount + 0.12,
      status: "skipped-exposure",
      reason: "Per-asset exposure cap reached (98.4% of 2.0M used).",
    },
    { maker: "0xf012…5a6b", ens: "tenor.eth", discount: market.bestDiscount + 0.44, status: "filled" },
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
  { kind: "fill", text: "Route filled · 3 makers", asset: "PT-USD3", value: "$182,400", ago: "12s" },
  { kind: "strategy", text: "Strategy shipped · convex k=1.8", asset: "zbETH", value: "$500,000", ago: "48s" },
  { kind: "fill", text: "Route filled · 1 maker", asset: "PT-sUSDe", value: "$21,050", ago: "1m" },
  { kind: "redeem", text: "Receipt redeemed at maturity", asset: "zbUSD", value: "$74,900", ago: "2m" },
  { kind: "fill", text: "Route filled · 5 makers", asset: "PT-weETH", value: "$640,120", ago: "4m" },
  { kind: "strategy", text: "Strategy docked", asset: "zbSOL", value: "$95,000", ago: "6m" },
  { kind: "fill", text: "Route filled · 2 makers", asset: "zbETH", value: "$310,780", ago: "8m" },
  { kind: "strategy", text: "Strategy shipped · linear", asset: "PT-USD3", value: "$1,200,000", ago: "11m" },
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
    pair: "PT-USD3 → USDC",
    base: 0.4,
    maxDiscount: 3.5,
    curve: "convex",
    tier: "balanced",
    exposureUsed: 812_000,
    exposureCap: 1_500_000,
    feesEarned: 9_412.55,
  },
  {
    id: "STR-2088",
    pair: "zbETH → WETH",
    base: 0.8,
    maxDiscount: 5,
    curve: "linear",
    tier: "aggressive",
    exposureUsed: 1_960_000,
    exposureCap: 2_000_000,
    feesEarned: 27_180.9,
  },
  {
    id: "STR-2113",
    pair: "PT-sUSDe → USDC",
    base: 0.25,
    maxDiscount: 2,
    curve: "convex",
    tier: "conservative",
    exposureUsed: 140_000,
    exposureCap: 900_000,
    feesEarned: 1_205.4,
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
    symbol: "PT-USD3",
    amount: 120_000,
    valueUsd: 118_104,
    maturesInDays: 62,
    entryDiscount: 1.84,
    underlying: "USDC",
    status: "active",
  },
  {
    symbol: "zbETH",
    amount: 42.5,
    valueUsd: 141_950,
    maturesInDays: 118,
    entryDiscount: 2.42,
    underlying: "WETH",
    status: "active",
  },
  {
    symbol: "PT-sUSDe",
    amount: 60_000,
    valueUsd: 59_346,
    maturesInDays: 0,
    entryDiscount: 1.12,
    underlying: "USDC",
    status: "matured",
  },
  {
    symbol: "zbUSD",
    amount: 25_000,
    valueUsd: 24_770,
    maturesInDays: 0,
    entryDiscount: 0.94,
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
    asset: "PT-sUSDe",
    amount: 60_000,
    underlying: "USDC",
    maturity: "Ready now",
    state: "ready",
  },
  {
    id: "RDM-0918",
    asset: "zbUSD",
    amount: 25_000,
    underlying: "USDC",
    maturity: "Claiming",
    state: "pending",
  },
  {
    id: "RDM-0844",
    asset: "PT-weETH",
    amount: 12.4,
    underlying: "WETH",
    maturity: "Claimed 2d ago",
    state: "claimed",
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
    asset: "PT-USD3",
    amount: 50_000,
    netUsd: 49_029.2,
    fills: 4,
    skipped: 3,
    feeUsd: 49.08,
    bestMaker: "steadyrate.eth",
  },
  {
    asset: "zbETH",
    amount: 8.25,
    netUsd: 27_152.45,
    fills: 3,
    skipped: 2,
    feeUsd: 27.18,
    bestMaker: "convexdesk.eth",
  },
  {
    asset: "PT-weETH",
    amount: 18,
    netUsd: 58_861.8,
    fills: 5,
    skipped: 1,
    feeUsd: 58.92,
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
  { name: "Chainlink ETH/USD", scope: "Underlying backing value", freshness: "14s", deviationBps: 0, state: "primary" },
  { name: "Pyth ETH/USD", scope: "Dual-oracle guard", freshness: "8s", deviationBps: 7, state: "secondary" },
  { name: "Pendle market", scope: "PT benchmark rate", freshness: "1 block", deviationBps: 31, state: "benchmark" },
  { name: "Subgraph Studio", scope: "Strategy discovery", freshness: "Live", deviationBps: 0, state: "benchmark" },
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
    label: "Pendle benchmark",
    command: "npm run zubidubi:pendle-benchmark",
    result: "Compares ZubiDubi term curve with live Pendle PT fork price.",
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
      ? opts.base + (opts.annualRate * opts.maxDays) / 365 * Math.pow(days / opts.maxDays, opts.convexity)
      : linear;
    pts.push({ days: Math.round(days), discount: Math.min(shaped, opts.maxDiscount) });
  }
  return pts;
}
