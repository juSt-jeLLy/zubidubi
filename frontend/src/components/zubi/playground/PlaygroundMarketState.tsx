import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlaygroundMetric, PlaygroundScenario } from "@/services/playground/types";

type PlaygroundMarketStateProps = {
  scenario: PlaygroundScenario | null;
  metrics: PlaygroundMetric[];
  indexingError: boolean;
};

export function PlaygroundMarketState({
  scenario,
  metrics,
  indexingError,
}: PlaygroundMarketStateProps) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest">Live Market State</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Graph discovery first, contract checks at quote and settlement time.
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5",
            indexingError ? "border-warning/40 text-warning" : "border-success/40 text-success",
          )}
        >
          {indexingError ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {indexingError ? "Indexing warning" : "Subgraph live"}
        </Badge>
      </div>

      {scenario ? (
        <>
          <div className="grid gap-px bg-border md:grid-cols-3">
            <div className="bg-surface p-5 md:col-span-2">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Selected book</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-3xl font-semibold">{scenario.market.symbol}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scenario.market.underlying}-backed claim exiting into {scenario.market.quoteSymbol}
                  </p>
                </div>
                <div className="num text-right">
                  <p className="text-2xl font-semibold text-primary">
                    {scenario.market.daysToMaturity ?? "--"}D
                  </p>
                  <p className="text-xs text-muted-foreground">to maturity</p>
                </div>
              </div>
              <p className="mt-5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                {scenario.proof}
              </p>
            </div>
            <div className="bg-surface p-5">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Route request</p>
              <p className="num mt-3 text-3xl font-semibold">
                {scenario.amount}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{scenario.market.symbol}</p>
              <p className="mt-5 text-xs text-muted-foreground">
                Quote target: <span className="num text-foreground">{scenario.market.quoteSymbol}</span>
              </p>
            </div>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-surface px-5 py-4">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {metric.label}
                </p>
                <p
                  className={cn(
                    "num mt-1 text-lg font-semibold",
                    metric.tone === "good" && "text-success",
                    metric.tone === "warn" && "text-warning",
                    metric.tone !== "good" && metric.tone !== "warn" && "text-foreground",
                  )}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="px-5 py-10 text-sm text-muted-foreground">
          Waiting for live market data from The Graph.
        </div>
      )}
    </section>
  );
}
