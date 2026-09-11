import { Anchor, PlusCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/portfolio/HoldingsPanel";
import type { MakerStrategyPosition } from "@/services/portfolio/types";

export function StrategiesPanel({ strategies }: { strategies: MakerStrategyPosition[] }) {
  const active = strategies.filter((strategy) => strategy.status === "ACTIVE");
  const avgExposure = active.length
    ? active.reduce((sum, strategy) => sum + strategy.exposurePct, 0) / active.length
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Maker strategies
        </h2>
        {strategies.length ? (
          <div className="mt-4 space-y-3">
            {strategies.map((strategy) => (
              <div key={strategy.id} className="panel p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="num text-xs text-muted-foreground">
                    {strategy.id.slice(0, 10)}...
                  </span>
                  <span className="font-semibold">{strategy.pair}</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {strategy.status.toLowerCase()}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider text-primary"
                  >
                    live graph
                  </Badge>
                  <Button variant="outline" size="sm" className="ml-auto gap-1.5" disabled>
                    <Anchor className="size-3.5" /> Dock
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Receipt exposure</span>
                      <span className="num">{strategy.exposure}</span>
                    </div>
                    <Progress value={strategy.exposurePct} className="mt-1.5 bg-surface-2" />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      Quote liquidity
                    </p>
                    <p className="num text-sm">{strategy.quoteLiquidity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      Pulled
                    </p>
                    <p className="num text-sm text-success">{strategy.quotePulled}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel mt-4">
            <EmptyState
              icon={<PlusCircle className="size-5" />}
              title="No maker strategies for this wallet"
              body="Create a strategy from the Make page and it will appear here from the subgraph."
            />
          </div>
        )}
      </section>
      <aside className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest">Exposure summary</h2>
        <Progress value={avgExposure} className="mt-5 bg-surface-2" />
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span className="num">{Math.round(avgExposure)}% average exposure</span>
          <span className="num">{active.length} active</span>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <Row label="Pricing model" value="modular term curve" />
          <Row label="Source" value="Subgraph strategies" />
          <Row label="Risk mode" value="oracle + exposure guarded" />
          <Row label="Capital model" value="wallet-held liquidity" />
        </div>
        <Button asChild className="mt-6 w-full font-semibold">
          <Link to="/make">Create strategy</Link>
        </Button>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="num text-right">{value}</span>
    </div>
  );
}
