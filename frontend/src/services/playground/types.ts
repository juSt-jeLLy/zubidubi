import type { LiveActivity, LiveMarket, MarketBoard } from "@/services/markets/types";
import type { SolverQuote } from "@/services/solver/types";

export type PlaygroundScenarioKind =
  | "fast-exit"
  | "long-tenor"
  | "stable-claim"
  | "cross-asset"
  | "liquidity-stress"
  | "inventory";

export type PlaygroundScenario = {
  id: string;
  kind: PlaygroundScenarioKind;
  title: string;
  market: LiveMarket;
  amount: string;
  objective: string;
  proof: string;
};

export type PlaygroundMetric = {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
};

export type PlaygroundRouteRow = {
  id: string;
  maker: string;
  orderHash: string;
  fillIn: string;
  grossOut: string;
  sharePct: number;
  status: "filled" | "skipped";
};

export type PlaygroundProtocolStep = {
  title: string;
  description: string;
  state: "live" | "verified" | "blocked" | "waiting";
};

export type PlaygroundProofCard = {
  id: string;
  title: string;
  whatItProves: string;
  file: string;
  command: string;
  status: "contract" | "fork" | "graph" | "frontend";
};

export type PlaygroundTestCase = {
  name: string;
  proves: string;
};

export type PlaygroundTestGroup = {
  id: string;
  title: string;
  file: string;
  command: string;
  summary: string;
  flow: string[];
  tests: PlaygroundTestCase[];
};

export type PlaygroundModel = {
  board: MarketBoard | null;
  scenarios: PlaygroundScenario[];
  selectedScenario: PlaygroundScenario | null;
  selectedMarket: LiveMarket | null;
  metrics: PlaygroundMetric[];
  activity: LiveActivity[];
  quote: SolverQuote | null;
  routeRows: PlaygroundRouteRow[];
  protocolSteps: PlaygroundProtocolStep[];
};
