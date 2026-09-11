import { Anchor, Loader2, PlusCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MakerStrategyPosition } from "@/services/portfolio/types";

export function LiveMakerStrategies({
  strategies,
  loading,
}: {
  strategies: MakerStrategyPosition[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="panel px-5 py-10 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-3 size-5 animate-spin text-primary" />
        Loading live maker strategies from The Graph…
      </div>
    );
  }

  if (!strategies.length) {
    return (
      <div className="panel px-5 py-10 text-center">
        <PlusCircle className="mx-auto mb-3 size-5 text-primary" />
        <p className="text-sm font-semibold">No maker strategies yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Ship a strategy and it will appear here after the subgraph indexes the Aqua event.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest">Live strategies</h2>
          <p className="mt-1 text-xs text-muted-foreground">Indexed maker inventory and fills.</p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-primary">
          The Graph
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        {strategies.slice(0, 5).map((strategy) => (
          <div key={strategy.id} className="rounded-md border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{strategy.pair}</span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {strategy.status.toLowerCase()}
              </Badge>
              <Button variant="outline" size="sm" className="ml-auto gap-1.5" disabled>
                <Anchor className="size-3.5" /> Dock
              </Button>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Exposure</span>
                <span className="num">{strategy.exposure}</span>
              </div>
              <Progress value={strategy.exposurePct} className="mt-1.5 bg-background" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <Metric label="Quote liquidity" value={strategy.quoteLiquidity} />
              <Metric label="Pulled" value={strategy.quotePulled} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="num mt-1 text-sm">{value}</p>
    </div>
  );
}
