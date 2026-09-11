import { BarChart3, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuoteBenchmark } from "@/services/solver/benchmarks";

export function QuoteBenchmarkPanel({ benchmark }: { benchmark: QuoteBenchmark }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest">
            <BarChart3 className="size-4 text-primary" />
            Benchmark
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{benchmark.headline}</p>
        </div>
        <Badge variant="outline" className="num border-primary/40 text-primary">
          {benchmark.rateLabel}
        </Badge>
      </div>

      {benchmark.rows.length ? (
        <div className="divide-y divide-border">
          {benchmark.rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span
                className={cn(
                  "num text-right",
                  row.tone === "good" && "text-success",
                  row.tone === "warn" && "text-warning",
                  row.tone === "muted" && "text-foreground",
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2 bg-surface-2 px-5 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <p>{benchmark.explanation}</p>
      </div>
    </section>
  );
}
