import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, ShieldAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlaygroundRouteRow, PlaygroundScenario } from "@/services/playground/types";
import type { SolverQuote } from "@/services/solver/types";

type RouteSplitPreviewProps = {
  scenario: PlaygroundScenario | null;
  quote: SolverQuote | null;
  rows: PlaygroundRouteRow[];
  isQuoting: boolean;
  error: string | null;
  onQuote: () => void;
};

function short(value: string) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function fmt(value: string | number, digits = 6) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(parsed);
}

export function RouteSplitPreview({
  scenario,
  quote,
  rows,
  isQuoting,
  error,
  onQuote,
}: RouteSplitPreviewProps) {
  const executable = quote?.canExecute ?? false;
  const fillStatus = quote?.fillStatus ?? "NONE";

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest">Route Split Preview</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Solver preview from live indexed strategies; contract settlement still verifies fresh state.
          </p>
        </div>
        <Button onClick={onQuote} disabled={!scenario || isQuoting} className="min-w-36">
          {isQuoting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isQuoting ? "Quoting" : "Quote route"}
        </Button>
      </div>

      <div className="grid gap-px bg-border md:grid-cols-[1fr_240px]">
        <div className="bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                executable
                  ? "border-success/40 text-success"
                  : quote
                    ? "border-warning/40 text-warning"
                    : "text-muted-foreground",
              )}
            >
              {quote ? fillStatus : "not quoted"}
            </Badge>
            {quote?.benchmark ? (
              <Badge variant="outline" className="text-muted-foreground">
                {quote.benchmark.label}
              </Badge>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <QuoteStat label="Requested" value={quote?.requestedReceiptIn ?? scenario?.amount ?? "--"} />
            <QuoteStat label="Filled input" value={quote?.quotedReceiptIn ?? "--"} />
            <QuoteStat
              label={`Net ${scenario?.market.quoteSymbol ?? "out"}`}
              value={quote ? fmt(quote.quotedNetOut) : "--"}
              strong
            />
          </div>

          {error ? (
            <div className="mt-5 flex gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-medium text-warning">Quote blocked</p>
                <p className="num mt-1 text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-surface p-5">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Next action</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Use this preview to explain the route, then open Sell for wallet approval and execution.
          </p>
          <Button asChild variant="outline" className="mt-5 w-full justify-between">
            <Link
              to="/sell"
              search={scenario ? { asset: scenario.market.id } : {}}
            >
              Execute in Sell <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            Quote a scenario to see maker fill legs, skipped makers, and output share.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className={cn(
                "grid gap-3 px-5 py-4 text-sm lg:grid-cols-[140px_1fr_120px_120px_90px] lg:items-center",
                row.status === "skipped" && "bg-surface-2/50 opacity-80",
              )}
            >
              <Badge
                variant="outline"
                className={cn(
                  "w-fit gap-1",
                  row.status === "filled"
                    ? "border-success/40 text-success"
                    : "border-border-strong text-muted-foreground",
                )}
              >
                {row.status === "filled" ? <Check className="size-3" /> : <X className="size-3" />}
                {row.status}
              </Badge>
              <div className="min-w-0">
                <p className="num truncate">{short(row.maker)}</p>
                <p className="num mt-0.5 truncate text-xs text-muted-foreground">{short(row.orderHash)}</p>
              </div>
              <p className="num text-muted-foreground">{fmt(row.fillIn)}</p>
              <p className="num text-primary">{fmt(row.grossOut)}</p>
              <p className="num text-right">{fmt(row.sharePct, 2)}%</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function QuoteStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-4 py-3">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 truncate text-lg", strong && "font-semibold text-primary")}>{value}</p>
    </div>
  );
}
