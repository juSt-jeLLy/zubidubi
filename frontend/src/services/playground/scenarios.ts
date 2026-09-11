import type { LiveMarket } from "@/services/markets/types";

import type {
  PlaygroundProofCard,
  PlaygroundScenario,
  PlaygroundScenarioKind,
  PlaygroundTestGroup,
} from "./types";

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
    line: 33,
    command: "cd swap-vm && forge test --match-contract AquaExitTermTest -vv",
    status: "contract",
    result: "passed",
    lastRun: "2026-09-12",
  },
  {
    id: "route-solver",
    title: "Multi-maker route settlement",
    whatItProves:
      "The executor skips unavailable makers, splits best-first, prevents double-counting, and reverts on aggregate shortfall.",
    file: "swap-vm/test/ZubiDubiRouteExecutor.t.sol",
    line: 39,
    command: "cd swap-vm && forge test --match-contract ZubiDubiRouteExecutorTest -vv",
    status: "contract",
    result: "passed",
    lastRun: "2026-09-12",
  },
  {
    id: "receipt-lifecycle",
    title: "Maturing claim lifecycle",
    whatItProves:
      "A holder issues a transferable PT-style receipt, can sell it early, and can redeem the backing only after maturity.",
    file: "swap-vm/test/ZubiDubiExitReceipt.t.sol",
    line: 29,
    command: "cd swap-vm && forge test --match-contract ZubiDubiExitReceiptTest -vv",
    status: "contract",
    result: "passed",
    lastRun: "2026-09-12",
  },
  {
    id: "redemption-path",
    title: "Maturity redemption path",
    whatItProves:
      "The claim is not a toy ERC20: after maturity, the holder can burn receipts and redeem the real backing asset.",
    file: "swap-vm/test/ZubiDubiExitReceipt.t.sol",
    line: 80,
    command:
      "cd swap-vm && forge test --match-test test_ZubiDubiExitReceipt_RedeemsUnderlyingOnlyAfterMaturity -vv",
    status: "contract",
    result: "passed",
    lastRun: "2026-09-12",
  },
  {
    id: "sepolia-real-oracle",
    title: "Sepolia real oracle proof",
    whatItProves:
      "The same inventory-aware quote path runs against real Sepolia USDC and a real Chainlink ETH/USD feed.",
    file: "swap-vm/test/ZubiDubiSepoliaFork.t.sol",
    line: 61,
    command: "npm run zubidubi:sepolia-inventory-benchmark",
    status: "fork",
    result: "requires-rpc",
    lastRun: "Run with SEPOLIA_RPC_URL",
  },
  {
    id: "pendle-benchmark",
    title: "Pendle PT benchmark",
    whatItProves:
      "A real mainnet PT market can be compared side by side against ZubiDubi's maker-specific term curve.",
    file: "swap-vm/test/ZubiDubiPendleMainnetFork.t.sol",
    line: 70,
    command: "MAINNET_RPC_URL=<rpc> npm run zubidubi:pendle-benchmark",
    status: "fork",
    result: "requires-rpc",
    lastRun: "Run with MAINNET_RPC_URL",
    stats: [
      {
        label: "Pendle implied PT rate",
        value: "0.965766193005277136",
      },
      {
        label: "ZubiDubi vs Pendle",
        value: "+112 bps",
        tone: "good",
      },
      {
        label: "Benchmark asset",
        value: "PT-USD3-17DEC2026",
      },
    ],
  },
  {
    id: "graph-book",
    title: "Graph-indexed book",
    whatItProves:
      "Strategies, fills, maker exposure, receipt lifecycle, and DAO fees are queryable without scanning chain state live.",
    file: "subgraph/schema.graphql",
    line: 1,
    command: "cd subgraph && graph codegen && graph build",
    status: "graph",
    result: "manual",
    lastRun: "Build command shown",
  },
];

export const PLAYGROUND_TEST_GROUPS: PlaygroundTestGroup[] = [
  {
    id: "curve-tests",
    title: "Term Curve and SwapVM Instruction Tests",
    file: "swap-vm/test/AquaExitTerm.t.sol",
    line: 33,
    command: "cd swap-vm && forge test --match-contract AquaExitTermTest -vv",
    summary:
      "Proves the reusable SwapVM term-liquidity instruction library: oracle backing, exposure caps, maturity curves, convexity, inventory, risk tier, liquidity depth, exact-in, exact-out, and guardrail reverts.",
    flow: [
      "Receipt amount",
      "BACKING_ORACLE_CHECK",
      "EXPOSURE_CAP",
      "DISCOUNT_CURVE_1D",
      "Executable quote",
    ],
    result: "passed",
    lastRun: "2026-09-12 local Foundry run",
    tests: [
      {
        name: "test_AquaExitTerm_ExactInSellsDelayedReceiptForUsdc",
        line: 33,
        result: "passed",
        proves: "A delayed receipt can be priced into USDC through the term curve.",
      },
      {
        name: "test_AquaExitTerm_PricesEighteenDecimalReceiptAgainstSixDecimalUsdc",
        line: 66,
        result: "passed",
        proves: "Decimal normalization is correct across 18-decimal receipts and 6-decimal USDC.",
      },
      {
        name: "test_AquaExitTerm_MultiAssetMarketsUseIndependentOracleAndPolicy",
        line: 103,
        result: "passed",
        proves: "Different assets use independent oracle and maker policy settings.",
      },
      {
        name: "test_AquaExitTerm_LongerMaturityGivesLargerDiscount",
        line: 124,
        result: "passed",
        proves: "Time-to-maturity directly widens the early-exit discount.",
      },
      {
        name: "test_AquaExitTerm_MaturedReceiptUsesBaseDiscountOnly",
        line: 141,
        result: "passed",
        proves: "A matured claim loses the term component and quotes near base spread.",
      },
      {
        name: "test_AquaExitTerm_InventoryExposureMakesLaterFillsCheaperForMaker",
        line: 155,
        result: "passed",
        proves: "Maker inventory reprices future fills as exposure accumulates.",
      },
      {
        name: "test_AquaExitTerm_RiskTierAndLiquidityDepthIncreaseDiscount",
        line: 182,
        result: "passed",
        proves: "Risk tier and liquidity depth penalties are included in the quote.",
      },
      {
        name: "test_AquaExitTerm_AnualizedRiskTier_ScalesWithDuration",
        line: 209,
        result: "passed",
        proves: "Risk premium scales with time instead of behaving like a flat fee.",
      },
      {
        name: "test_AquaExitTerm_ConvexCurve_DiscountSuperlinearInTime",
        line: 231,
        result: "passed",
        proves: "Convex curve family prices long tenor more steeply than a linear curve.",
      },
      {
        name: "test_AquaExitTerm_ConvexCurve_ShortDatedSmallConvexityStillQuotesPremium",
        line: 259,
        result: "passed",
        proves: "Short-dated convexity remains measurable and does not truncate away.",
      },
      {
        name: "test_AquaExitTerm_LegacyArgs_BehaveAsLinear",
        line: 288,
        result: "passed",
        proves: "Legacy strategy bytes remain compatible with linear pricing.",
      },
      {
        name: "test_AquaExitTerm_ExactOutComputesRequiredReceiptAmount",
        line: 400,
        result: "passed",
        proves: "Exact-out quotes compute the required receipt input correctly.",
      },
      {
        name: "test_AquaExitTerm_SplitsOneExitAcrossMultipleMakerCurves",
        line: 421,
        result: "passed",
        proves: "A single seller exit can be split across multiple maker curves.",
      },
    ],
  },
  {
    id: "guardrail-tests",
    title: "Guardrail and Revert Tests",
    file: "swap-vm/test/AquaExitTerm.t.sol",
    line: 314,
    command: "cd swap-vm && forge test --match-contract AquaExitTermTest --match-test Reverts -vv",
    summary:
      "Proves that a quote cannot bypass maker policy, stale oracle protection, exposure caps, token allowlists, maturity windows, discount caps, or output liquidity limits.",
    flow: [
      "Bad route",
      "Policy check",
      "Oracle check",
      "Exposure/liquidity check",
      "Revert before settlement",
    ],
    result: "passed",
    lastRun: "2026-09-12 local Foundry run",
    tests: [
      {
        name: "test_AquaExitTerm_RevertsWhenNotionalExposureExceeded",
        line: 314,
        result: "passed",
        proves: "Maker quote-token notional exposure cannot exceed the configured cap.",
      },
      {
        name: "test_AquaExitTerm_RevertsWhenReceiptAssetNotAllowed",
        line: 327,
        result: "passed",
        proves: "A maker strategy cannot be reused for an unauthorized receipt asset.",
      },
      {
        name: "test_AquaExitTerm_RevertsWhenMaturityOutsideMakerRange",
        line: 348,
        result: "passed",
        proves: "Strategies only quote the maker's allowed maturity window.",
      },
      {
        name: "test_AquaExitTerm_RevertsOnStaleOracle",
        line: 363,
        result: "passed",
        proves: "Stale oracle data blocks the route.",
      },
      {
        name: "test_AquaExitTerm_RevertsWhenDiscountExceedsMakerCap",
        line: 374,
        result: "passed",
        proves: "A maker's maximum discount cannot be exceeded.",
      },
      {
        name: "test_AquaExitTerm_RevertsWhenTakerExceedsMakerReceiptCapacity",
        line: 384,
        result: "passed",
        proves: "Receipt exposure caps are enforced before fill.",
      },
      {
        name: "test_AquaExitTerm_RevertsWhenMakerOutputLiquidityInsufficient",
        line: 392,
        result: "passed",
        proves: "The quote fails if maker output liquidity cannot satisfy the fill.",
      },
      {
        name: "test_AquaExitTerm_DualOracleDeviationOverBound_Reverts",
        line: 670,
        result: "passed",
        proves: "Primary/secondary oracle deviation protection blocks unsafe routes.",
      },
    ],
  },
  {
    id: "multi-maker-routing-tests",
    title: "Multi-Maker Routing Tests",
    file: "swap-vm/test/ZubiDubiRouteExecutor.t.sol",
    line: 39,
    command: "cd swap-vm && forge test --match-contract ZubiDubiRouteExecutorTest -vv",
    summary:
      "Proves the route executor can discover best executable maker paths, skip unavailable makers, avoid double-counting one maker wallet, enforce max fills, and settle non-USDC payout routes.",
    flow: [
      "Seller input",
      "Quote makers",
      "Skip unavailable",
      "Split best-first",
      "Atomic Aqua settlement",
    ],
    result: "passed",
    lastRun: "2026-09-12 local Foundry run",
    tests: [
      {
        name: "test_ZubiDubiRouteExecutor_SkipsInsolventAndSplitsBestFirst",
        line: 39,
        result: "passed",
        proves: "Unavailable makers are skipped and the route fills best executable makers first.",
      },
      {
        name: "test_ZubiDubiRouteExecutor_RevertsWhenAggregateRouteCannotFill",
        line: 124,
        result: "passed",
        proves: "A route that cannot fully fill reverts instead of partially settling.",
      },
      {
        name: "test_ZubiDubiRouteExecutor_DoesNotDoubleCountSameMakerWalletLiquidity",
        line: 158,
        result: "passed",
        proves: "Multiple strategies from the same maker cannot overuse the same wallet liquidity.",
      },
      {
        name: "test_ZubiDubiRouteExecutor_SkipsMakerWithRevokedApproval",
        line: 211,
        result: "passed",
        proves: "Revoked maker allowance is detected and skipped.",
      },
      {
        name: "test_ZubiDubiRouteExecutor_SkipsMakerWhoseWalletBalanceMoved",
        line: 254,
        result: "passed",
        proves: "Moved maker funds are detected through live wallet balance checks.",
      },
      {
        name: "test_ZubiDubiRouteExecutor_EnforcesMaxFillsLimit",
        line: 295,
        result: "passed",
        proves: "The route executor enforces bounded route complexity.",
      },
      {
        name: "test_ZubiDubiRouteExecutor_RoutesSameReceiptIntoNonUsdcPayoutToken",
        line: 330,
        result: "passed",
        proves: "The same receipt market can route into WETH, not only USDC.",
      },
    ],
  },
  {
    id: "receipt-lifecycle-tests",
    title: "Receipt Lifecycle Tests",
    file: "swap-vm/test/ZubiDubiExitReceipt.t.sol",
    line: 29,
    command: "cd swap-vm && forge test --match-contract ZubiDubiExitReceiptTest -vv",
    summary:
      "Proves the Sepolia demo asset behaves like a real transferable maturing claim: issue with backing, trade before maturity, redeem after maturity, and protect users from forced redemption or rounding mistakes.",
    flow: [
      "Deposit backing",
      "Issue PT-style claim",
      "Transfer or sell early",
      "Wait to maturity",
      "Redeem backing",
    ],
    result: "passed",
    lastRun: "2026-09-12 local Foundry run",
    tests: [
      {
        name: "test_ZubiDubiExitReceipt_ExpiryMatchesMaturity",
        line: 29,
        result: "passed",
        proves: "The receipt exposes the expected maturity timestamp.",
      },
      {
        name: "test_ZubiDubiExitReceipt_FreelyTradableBeforeMaturityLikePendlePt",
        line: 34,
        result: "passed",
        proves: "The claim can be transferred before maturity like a PT-style token.",
      },
      {
        name: "test_ZubiDubiExitReceipt_PendleStyleRedeemForUser",
        line: 57,
        result: "passed",
        proves: "A user can redeem the receipt for backing after maturity.",
      },
      {
        name: "test_ZubiDubiExitReceipt_RedeemsUnderlyingOnlyAfterMaturity",
        line: 80,
        result: "passed",
        proves: "Early redemption is blocked until maturity.",
      },
      {
        name: "test_ZubiDubiExitReceipt_IssueRevertsOnMissingAllowance",
        line: 122,
        result: "passed",
        proves: "Issuance requires real backing approval.",
      },
      {
        name: "test_ZubiDubiExitReceipt_RedeemForUserCannotBeForcedByThirdParty",
        line: 158,
        result: "passed",
        proves: "A third party cannot force a user's receipt redemption path.",
      },
      {
        name: "test_ZubiDubiExitReceipt_IssueRoundingRoundTripsForNonUnityRate",
        line: 182,
        result: "passed",
        proves: "Non-unity backing ratios round-trip safely.",
      },
      {
        name: "test_ZubiDubiExitReceipt_IssueDustTruncatesOnNonUnityRate",
        line: 214,
        result: "passed",
        proves: "Dust issuance behavior is explicit and safe.",
      },
    ],
  },
  {
    id: "real-asset-fork-tests",
    title: "Real Asset Fork Tests",
    file: "swap-vm/test/ZubiDubiSepoliaFork.t.sol + ZubiDubiPendleMainnetFork.t.sol",
    line: 61,
    command:
      "npm run zubidubi:sepolia-inventory-benchmark && MAINNET_RPC_URL=<rpc> npm run zubidubi:pendle-benchmark",
    summary:
      "Proves the same logic against real deployed assets, real oracle feeds, and a real Pendle PT market benchmark.",
    flow: [
      "Fork live chain",
      "Load real token/feed",
      "Quote ZubiDubi curve",
      "Compare benchmark",
      "Assert route behavior",
    ],
    result: "requires-rpc",
    lastRun: "Requires SEPOLIA_RPC_URL / MAINNET_RPC_URL",
    tests: [
      {
        name: "test_ZubiDubiSepoliaFork_UsesRealChainlinkFeedAndRealUsdc",
        line: 61,
        result: "requires-rpc",
        proves: "Sepolia quote path uses real USDC and a real Chainlink feed.",
      },
      {
        name: "test_ZubiDubiSepoliaFork_InventoryPricingMovesPriceOnRealOracle",
        line: 116,
        result: "requires-rpc",
        proves: "Inventory-aware pricing moves quote output on the real oracle path.",
      },
      {
        name: "test_ZubiDubiPendleMainnetFork_RoutesRealPtUsd3EarlyExit",
        line: 70,
        result: "requires-rpc",
        proves: "A real mainnet Pendle PT-style asset can be routed through the ZubiDubi curve.",
      },
      {
        name: "test_ZubiDubiPendleMainnetFork_DemoBeatComparesPendleAndInventoryStates",
        line: 159,
        result: "requires-rpc",
        proves: "ZubiDubi quote can be compared side by side with Pendle's implied PT benchmark.",
      },
    ],
  },
  {
    id: "demo-and-indexing-tests",
    title: "Demo and Indexing Proofs",
    file: "swap-vm/test/ZubiDubiDemo.t.sol + subgraph/schema.graphql",
    line: 34,
    command: "cd swap-vm && forge test --match-contract ZubiDubiDemoTest -vv && cd ../subgraph && graph build",
    summary:
      "Proves the demo route over solvent Aqua makers and the Graph schema that turns onchain events into the frontend/solver market book.",
    flow: [
      "Aqua strategy events",
      "Subgraph entities",
      "Solver discovery",
      "Frontend preview",
      "Demo route proof",
    ],
    result: "passed",
    lastRun: "2026-09-12 local Foundry run; Graph build command shown",
    tests: [
      {
        name: "test_ZubiDubiDemo_RoutesExitAcrossSolventAquaMakers",
        line: 34,
        result: "passed",
        proves: "The end-to-end demo route fills across solvent Aqua makers.",
      },
      {
        name: "Market / Strategy / RouteFill / RouteFee entities",
        result: "manual",
        proves: "The Graph exposes the data needed for scalable solver discovery.",
      },
      {
        name: "ReceiptIssue / ReceiptRedeem lifecycle indexing",
        result: "manual",
        proves: "Portfolio and redemption views can reconstruct claim lifecycle history.",
      },
    ],
  },
];
