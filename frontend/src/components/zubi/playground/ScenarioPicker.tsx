import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlaygroundScenario } from "@/services/playground/types";

type ScenarioPickerProps = {
  scenarios: PlaygroundScenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ScenarioPicker({ scenarios, selectedId, onSelect }: ScenarioPickerProps) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest">Scenario</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a live market path. The playground will quote it through the solver API.
        </p>
      </div>
      <div className="divide-y divide-border">
        {scenarios.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            No live markets indexed yet. Check the subgraph endpoint and deployed strategy book.
          </div>
        ) : (
          scenarios.map((scenario) => {
            const active = scenario.id === selectedId;
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => onSelect(scenario.id)}
                className={cn(
                  "w-full px-5 py-4 text-left transition-colors hover:bg-surface-2",
                  active && "bg-surface-2",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{scenario.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {scenario.objective}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] uppercase tracking-wider",
                      active && "border-primary/50 text-primary",
                    )}
                  >
                    {scenario.kind.replace("-", " ")}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="num rounded-md border border-border bg-background px-2 py-1">
                    {scenario.amount} {scenario.market.symbol}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {scenario.market.daysToMaturity ?? "--"} days
                  </span>
                  <span className="num ml-auto text-primary">
                    {scenario.market.liquidityLabel}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-border p-4">
        <Button asChild variant="outline" className="w-full justify-between">
          <Link to="/markets">
            Open full market board <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
