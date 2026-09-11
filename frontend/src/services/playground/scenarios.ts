import type { LiveMarket } from "@/services/markets/types";

import type { PlaygroundProofCard, PlaygroundScenario, PlaygroundScenarioKind } from "./types";

function defaultAmount(market: LiveMarket) {
  const symbol = market.symbol.toUpperCase();
  if (symbol.includes("USD")) return "25";
  if (symbol.includes("LINK")) return "1";
  return "0.003";
}

function objectiveFor(kind: PlaygroundScenarioKind, market: LiveMarket) {
  switch (kind) {
    case "fast-exit":
      return "Show a short-dated holder getting liquid tokens immediately instead of waiting for maturity.";
    case "long-tenor":
      return "Show that longer time to maturity receives a deeper term-liquidity discount.";
    case "stable-claim":
      return "Show a par-style stable claim where the early-exit discount is easy to compare against maturity value.";
    case "cross-asset":
      return `Show ${market.symbol} exiting into ${market.quoteSymbol} through the oracle-backed SwapVM path.`;
    case "liquidity-stress":
      return "Show partial maker selection, skipped makers, and contract-side insufficient-liquidity protection.";
    case "inventory":
      return "Show the curve surface that becomes worse as makers accumulate more receipt exposure.";
  }
}

function proofFor(kind: PlaygroundScenarioKind) {
  switch (kind) {
    case "fast-exit":
      return "Aqua pulls maker funds only when the route executor settles the fill.";
    case "long-tenor":
      return "DISCOUNT_CURVE_1D prices time-to-maturity as part of the route.";
    case "stable-claim":
      return "The benchmark panel can compare executable route price to maturity par.";
    case "cross-asset":
      return "BACKING_ORACLE_CHECK validates the real backing value before quote execution.";
    case "liquidity-stress":
      return "The executor checks wallet balance, allowance, and Aqua virtual balance before filling.";
    case "inventory":
      return "EXPOSURE_CAP and inventory slope make future fills worse as exposure rises.";
  }
}

function scenarioTitle(kind: PlaygroundScenarioKind, market: LiveMarket) {
  switch (kind) {
    case "fast-exit":
      return `${market.symbol} early exit`;
    case "long-tenor":
      return `${market.symbol} long-tenor quote`;
    case "stable-claim":
      return `${market.symbol} stable claim`;
    case "cross-asset":
      return `${market.symbol} into ${market.quoteSymbol}`;
    case "liquidity-stress":
      return `${market.symbol} liquidity check`;
    case "inventory":
      return `${market.symbol} inventory curve`;
  }
}

function scenarioKind(market: LiveMarket, index: number): PlaygroundScenarioKind {
  const symbol = market.symbol.toUpperCase();
  if (symbol.includes("180D")) return "long-tenor";
  if (symbol.includes("USD")) return "stable-claim";
  if (market.underlying.toUpperCase() !== market.quoteSymbol.toUpperCase()) return "cross-asset";
  if (market.liquidity <= 0 || market.strategies <= 1) return "liquidity-stress";
  return index === 0 ? "fast-exit" : "inventory";
}

export function buildPlaygroundScenarios(markets: LiveMarket[]): PlaygroundScenario[] {
  return markets.map((market, index) => {
    const kind = scenarioKind(market, index);
    return {
      id: `${kind}-${market.id}`,
      kind,
      title: scenarioTitle(kind, market),
      market,
      amount: defaultAmount(market),
      objective: objectiveFor(kind, market),
      proof: proofFor(kind),
    };
  });
}

export const PLAYGROUND_PROOFS: PlaygroundProofCard[] = [
  {
    id: "term-curve",
    title: "Maturity and inventory curve",
    whatItProves:
      "Longer maturities, convexity, risk tier, liquidity depth, and maker exposure all affect the executable quote.",
    file: "swap-vm/test/AquaExitTerm.t.sol",
    command: "cd swap-vm && forge test --match-contract AquaExitTermTest -vv",
    status: "contract",
  },
  {
    id: "route-solver",
    title: "Multi-maker route settlement",
    whatItProves:
      "The executor skips unavailable makers, splits best-first, prevents double-counting, and reverts on aggregate shortfall.",
    file: "swap-vm/test/ZubiDubiRouteExecutor.t.sol",
    command: "cd swap-vm && forge test --match-contract ZubiDubiRouteExecutorTest -vv",
    status: "contract",
  },
  {
    id: "receipt-lifecycle",
    title: "Maturing claim lifecycle",
    whatItProves:
      "A holder issues a transferable PT-style receipt, can sell it early, and can redeem the backing only after maturity.",
    file: "swap-vm/test/ZubiDubiExitReceipt.t.sol",
    command: "cd swap-vm && forge test --match-contract ZubiDubiExitReceiptTest -vv",
    status: "contract",
  },
  {
    id: "sepolia-real-oracle",
    title: "Sepolia real oracle proof",
    whatItProves:
      "The same inventory-aware quote path runs against real Sepolia USDC and a real Chainlink ETH/USD feed.",
    file: "swap-vm/test/ZubiDubiSepoliaFork.t.sol",
    command: "npm run zubidubi:sepolia-inventory-benchmark",
    status: "fork",
  },
  {
    id: "pendle-benchmark",
    title: "Pendle PT benchmark",
    whatItProves:
      "A real mainnet PT market can be compared side by side against ZubiDubi's maker-specific term curve.",
    file: "swap-vm/test/ZubiDubiPendleMainnetFork.t.sol",
    command: "MAINNET_RPC_URL=<rpc> npm run zubidubi:pendle-benchmark",
    status: "fork",
  },
  {
    id: "graph-book",
    title: "Graph-indexed book",
    whatItProves:
      "Strategies, fills, maker exposure, receipt lifecycle, and DAO fees are queryable without scanning chain state live.",
    file: "subgraph/schema.graphql",
    command: "cd subgraph && graph codegen && graph build",
    status: "graph",
  },
];
