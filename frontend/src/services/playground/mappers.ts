import type { LiveActivity, LiveMarket, MarketBoard } from "@/services/markets/types";
import type { SolverQuote } from "@/services/solver/types";

import { buildPlaygroundScenarios } from "./scenarios";
import type {
  PlaygroundMetric,
  PlaygroundModel,
  PlaygroundProtocolStep,
  PlaygroundRouteRow,
  PlaygroundScenario,
} from "./types";

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compact(value: number, maxFractionDigits = 3) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function pct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${compact(value, 2)}%`;
}

function blockLabel(blockNumber: number | null) {
  return blockNumber ? blockNumber.toLocaleString("en-US") : "--";
}

export function buildPlaygroundMetrics(
  board: MarketBoard | null,
  market: LiveMarket | null,
  quote: SolverQuote | null,
): PlaygroundMetric[] {
  const filled = quote ? numberValue(quote.quotedReceiptIn) : 0;
  const requested = quote ? Math.max(numberValue(quote.requestedReceiptIn), 1e-18) : 0;
  const fillPct = quote ? (filled / requested) * 100 : null;

  return [
    {
      label: "Indexed block",
      value: blockLabel(board?.blockNumber ?? null),
      tone: board?.hasIndexingErrors ? "warn" : "good",
    },
    {
      label: "Active strategies",
      value: String(market?.strategies ?? 0),
      tone: (market?.strategies ?? 0) > 0 ? "good" : "warn",
    },
    {
      label: "Deliverable liquidity",
      value: market?.liquidityLabel ?? "--",
      tone: (market?.liquidity ?? 0) > 0 ? "good" : "warn",
    },
    {
      label: "Best indexed discount",
      value: pct(market?.bestDiscount ?? null),
      tone: "default",
    },
    {
      label: "Route fill",
      value: quote ? `${compact(fillPct ?? 0, 2)}%` : "--",
      tone: quote?.canExecute ? "good" : quote ? "warn" : "default",
    },
    {
      label: "Net quote",
      value: quote && market ? `${compact(numberValue(quote.quotedNetOut), 6)} ${market.quoteSymbol}` : "--",
      tone: quote?.canExecute ? "good" : "default",
    },
  ];
}

export function buildRouteRows(quote: SolverQuote | null): PlaygroundRouteRow[] {
  if (!quote) return [];
  const gross = quote.routePreview.fills.reduce(
    (sum, fill) => sum + numberValue(fill.estimatedGrossOut),
    0,
  );

  const fills = quote.routePreview.fills.map((fill, index) => {
    const grossOut = numberValue(fill.estimatedGrossOut);
    return {
      id: `fill-${fill.orderHash}-${index}`,
      maker: fill.maker,
      orderHash: fill.orderHash,
      fillIn: fill.fillIn,
      grossOut: fill.estimatedGrossOut,
      sharePct: gross > 0 ? (grossOut / gross) * 100 : 0,
      status: "filled" as const,
    };
  });

  const skipped = quote.skippedMakers.map((maker, index) => ({
    id: `skip-${maker.orderHash}-${index}`,
    maker: maker.maker,
    orderHash: maker.orderHash,
    fillIn: "0",
    grossOut: "0",
    sharePct: 0,
    status: "skipped" as const,
    reason:
      maker.reason ??
      "Skipped by route executor because this maker could not contribute deliverable output for the route.",
  }));

  return [...fills, ...skipped];
}

export function buildProtocolSteps(
  board: MarketBoard | null,
  scenario: PlaygroundScenario | null,
  quote: SolverQuote | null,
): PlaygroundProtocolStep[] {
  return [
    {
      title: "Graph discovers the book",
      description: board
        ? `${board.markets.length} markets and ${board.activity.length} recent lifecycle events loaded from the deployed subgraph.`
        : "Load the deployed subgraph market board.",
      state: board ? "verified" : "waiting",
    },
    {
      title: "Scenario selects an executable market",
      description: scenario
        ? `${scenario.market.symbol} -> ${scenario.market.quoteSymbol}, ${scenario.market.daysToMaturity ?? "--"} days to maturity.`
        : "Pick a live maturing asset and payout route.",
      state: scenario ? "verified" : "waiting",
    },
    {
      title: "Solver quotes maker strategies",
      description: quote
        ? `${quote.indexedStrategies} indexed strategies considered; ${quote.routePreview.fills.length} fill legs returned.`
        : "Ask the solver API for a deterministic route preview.",
      state: quote ? "verified" : "waiting",
    },
    {
      title: "Contracts enforce deliverability",
      description: quote?.canExecute
        ? "This route can execute atomically; chain checks still enforce balance, allowance, Aqua virtual balance, and min output."
        : quote
          ? "The route preview is not executable enough for settlement and would be blocked."
          : "Final settlement is always guarded by the route executor.",
      state: quote ? (quote.canExecute ? "live" : "blocked") : "waiting",
    },
  ];
}

export function buildPlaygroundModel(
  board: MarketBoard | null,
  selectedScenarioId: string | null,
  quote: SolverQuote | null,
): PlaygroundModel {
  const scenarios = buildPlaygroundScenarios(board?.markets ?? []);
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0] ?? null;
  const selectedMarket = selectedScenario?.market ?? null;
  const activity: LiveActivity[] = board?.activity.slice(0, 8) ?? [];

  return {
    board,
    scenarios,
    selectedScenario,
    selectedMarket,
    metrics: buildPlaygroundMetrics(board, selectedMarket, quote),
    activity,
    quote,
    routeRows: buildRouteRows(quote),
    protocolSteps: buildProtocolSteps(board, selectedScenario, quote),
  };
}
