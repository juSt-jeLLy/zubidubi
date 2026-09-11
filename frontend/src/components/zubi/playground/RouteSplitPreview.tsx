import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, ShieldAlert, X } from "lucide-react";
import { useState } from "react";

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

function isSolverUnavailable(error: string | null) {
  if (!error) return false;
  const lower = error.toLowerCase();
  return lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("solver");
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
  const [expandedSkip, setExpandedSkip] = useState<string | null>(null);
  const solverUnavailable = isSolverUnavailable(error);

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
                <p className="font-medium text-warning">
                  {solverUnavailable ? "Solver API unavailable" : "Quote blocked"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {solverUnavailable
                    ? "Start the solver API locally or point VITE_SOLVER_API_URL at a hosted solver endpoint. The page is still reading live Graph data."
                    : "The route preview was rejected by the solver or contract quote path."}
                </p>
                <p className="num mt-1 break-all text-xs text-muted-foreground">{error}</p>
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
          rows.map((row) => {
            const skipped = row.status === "skipped";
            const expanded = expandedSkip === row.id;
            return (
              <div
                key={row.id}
                className={cn(
                  "px-5 py-4 text-sm",
                  skipped && "bg-surface-2/50 opacity-90",
                )}
              >
                <button
                  type="button"
                  onClick={() => skipped && setExpandedSkip(expanded ? null : row.id)}
                  className="grid w-full gap-3 text-left lg:grid-cols-[160px_1fr_120px_120px_90px] lg:items-center"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit gap-1",
                      row.status === "filled"
                        ? "border-success/40 text-success"
                        : "border-warning/40 bg-warning/10 text-warning",
                    )}
                  >
                    {row.status === "filled" ? <Check className="size-3" /> : <X className="size-3" />}
                    {row.status === "filled" ? "filled" : "skipped · deliverability"}
                  </Badge>
                  <div className="min-w-0">
                    <p className="num truncate">{short(row.maker)}</p>
                    <p className="num mt-0.5 truncate text-xs text-muted-foreground">
                      {short(row.orderHash)}
                    </p>
                  </div>
                  <p className="num text-muted-foreground">{skipped ? "--" : fmt(row.fillIn)}</p>
                  <p className="num text-primary">{skipped ? "--" : fmt(row.grossOut)}</p>
                  <p className="num text-right">{skipped ? "0%" : `${fmt(row.sharePct, 2)}%`}</p>
                </button>

                {skipped ? (
                  <div
                    className={cn(
                      "mt-3 flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground",
                      !expanded && "line-clamp-2",
                    )}
                  >
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>
                      {row.reason ??
                        "Skipped by route executor because this maker could not contribute deliverable output for this route."}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })
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
