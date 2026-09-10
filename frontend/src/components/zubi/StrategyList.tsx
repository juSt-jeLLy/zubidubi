import { Anchor } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MY_STRATEGIES, fmtCompact, fmtNum, fmtUsd } from "@/lib/zubi-data";

export function StrategyList({ title = "Your open strategies" }: { title?: string }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="mt-4 space-y-3">
        {MY_STRATEGIES.map((s) => {
          const pct = (s.exposureUsed / s.exposureCap) * 100;
          return (
            <div key={s.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="num text-xs text-muted-foreground">{s.id}</span>
                <span className="font-semibold">{s.pair}</span>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {s.curve}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-primary">
                  {s.tier}
                </Badge>
                <Button variant="outline" size="sm" className="ml-auto gap-1.5">
                  <Anchor className="size-3.5" /> Dock
                </Button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Exposure used</span>
                    <span className="num">
                      {fmtCompact(s.exposureUsed)} / {fmtCompact(s.exposureCap)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={pct > 90 ? "h-full bg-warning" : "h-full bg-primary"}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Base</p>
                  <p className="num text-sm">{fmtNum(s.base)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Fees earned</p>
                  <p className="num text-sm text-success">{fmtUsd(s.feesEarned, 2)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
