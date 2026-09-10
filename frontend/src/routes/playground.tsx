import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  DatabaseZap,
  FlaskConical,
  Play,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ORACLE_SOURCES,
  PLAYGROUND_RUNS,
  PROPERTIES,
  ROUTE_PREVIEWS,
  fmtNum,
  fmtUsd,
} from "@/lib/zubi-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Playground - ZubiDubi" },
      {
        name: "description",
        content:
          "Design-only demo console for ZubiDubi solver routes, Graph indexing, oracle checks and protocol invariants.",
      },
      { property: "og:title", content: "Playground - ZubiDubi" },
      {
        property: "og:description",
        content: "A demo console showing the pieces judges can verify during the ZubiDubi walkthrough.",
      },
    ],
  }),
  component: PlaygroundPage,
});

function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <FlaskConical className="size-3.5" />
            Verification console
          </Badge>
          <h1 className="text-3xl font-semibold">Playground</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A compact demo surface for route previews, Graph-indexed strategy discovery, oracle checks and the
            invariant story behind ZubiDubi.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/sell">
              Open sell flow <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild>
            <Link to="/make">
              Publish strategy <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest">Live route lab</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Static design now, ready for solver API data later.
              </p>
            </div>
            <Badge variant="outline" className="border-success/40 text-success">
              <span className="mr-1.5 size-1.5 rounded-full bg-success live-dot" />
              Sepolia route executor
            </Badge>
          </div>

          <div className="grid gap-px bg-border md:grid-cols-3">
            {ROUTE_PREVIEWS.map((r) => (
              <div key={`${r.asset}-${r.amount}`} className="bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{r.asset}</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {r.fills} makers
                  </Badge>
                </div>
                <div className="mt-5">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Net quote</p>
                  <p className="num mt-1 text-2xl font-semibold text-primary">{fmtUsd(r.netUsd, 2)}</p>
                </div>
                <dl className="mt-5 space-y-2 text-xs">
                  <Row label="Input amount" value={fmtNum(r.amount, r.amount < 100 ? 2 : 0)} />
                  <Row label="DAO fee" value={fmtUsd(r.feeUsd, 2)} />
                  <Row label="Skipped makers" value={String(r.skipped)} />
                  <Row label="Best maker" value={r.bestMaker} />
                </dl>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest">Data stack</h2>
          <div className="mt-5 space-y-3">
            {ORACLE_SOURCES.map((o) => (
              <div key={o.name} className="rounded-md border border-border bg-surface-2 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{o.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{o.scope}</p>
                  </div>
                  <SourceBadge state={o.state} />
                </div>
                <div className="mt-3 flex justify-between text-xs">
                  <span className="text-muted-foreground">Freshness</span>
                  <span className="num">{o.freshness}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Deviation</span>
                  <span className="num">{o.deviationBps} bps</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <Tabs defaultValue="runs" className="mt-8">
        <TabsList className="h-auto flex-wrap justify-start rounded-md border border-border bg-surface p-1">
          <TabsTrigger value="runs">Demo Runs</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="graph">Graph Surface</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-5">
          <section className="panel overflow-hidden">
            <div className="divide-y divide-border">
              {PLAYGROUND_RUNS.map((run) => (
                <div key={run.label} className="grid gap-4 px-5 py-4 lg:grid-cols-[220px_1fr_140px] lg:items-center">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-md border border-border bg-surface-2 text-primary">
                      {run.state === "verified" ? <CheckCircle2 className="size-4" /> : <Play className="size-4" />}
                    </span>
                    <div>
                      <p className="font-semibold">{run.label}</p>
                      <p className="text-xs text-muted-foreground">{run.result}</p>
                    </div>
                  </div>
                  <code className="num block overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    {run.command}
                  </code>
                  <Button size="sm" variant={run.state === "ready" ? "default" : "outline"} className="lg:ml-auto">
                    {run.state === "ready" ? "Run demo" : "View proof"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="properties" className="mt-5">
          <div className="grid gap-3 md:grid-cols-2">
            {PROPERTIES.map((p) => (
              <div key={p.name} className="panel p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border",
                      p.status === "skipped"
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : "border-success/40 bg-success/10 text-success",
                    )}
                  >
                    {p.status === "skipped" ? <TriangleAlert className="size-4" /> : <ShieldCheck className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="num text-sm font-semibold">{p.name}</p>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {p.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>
                    <p className="num mt-3 text-xs text-primary">{p.runs}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="graph" className="mt-5">
          <section className="panel p-5">
            <div className="grid gap-6 lg:grid-cols-[330px_1fr]">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest">
                  <DatabaseZap className="size-4 text-primary" />
                  Graph-backed solver
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  The intended app flow is Graph first for discovery, then RPC for final freshness checks before
                  execution. This keeps route previews scalable without trusting stale local state.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <GraphStep icon={<DatabaseZap className="size-4" />} title="Index" text="StrategyShipped, RouteFilled, MakerExposure and FeeAccrued events." />
                <GraphStep icon={<Activity className="size-4" />} title="Rank" text="Filter makers by maturity, exposure, oracle state and deliverable balance." />
                <GraphStep icon={<Terminal className="size-4" />} title="Quote" text="Send selected routes to the local solver API for deterministic quote preview." />
                <GraphStep icon={<CircleDot className="size-4" />} title="Settle" text="Execute one atomic route through Aqua pull/push settlement." />
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num text-right">{value}</dd>
    </div>
  );
}

function SourceBadge({ state }: { state: "primary" | "secondary" | "benchmark" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] uppercase tracking-wider",
        state === "primary" && "border-primary/40 text-primary",
        state === "secondary" && "border-success/40 text-success",
        state === "benchmark" && "text-muted-foreground",
      )}
    >
      {state}
    </Badge>
  );
}

function GraphStep({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-4 py-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
