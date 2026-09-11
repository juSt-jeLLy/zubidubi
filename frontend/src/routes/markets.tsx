import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, Layers, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/zubi/AnimatedNumber";
import { fmtNum } from "@/lib/zubi-data";
import { useMarkets } from "@/services/markets/useMarkets";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets - ZubiDubi" },
      {
        name: "description",
        content:
          "Browse active ZubiDubi term-liquidity markets for PT tokens and delayed-redemption receipts.",
      },
      { property: "og:title", content: "Markets - ZubiDubi" },
      {
        property: "og:description",
        content:
          "Best maker-quoted discounts, liquidity and active strategy depth for maturing DeFi assets.",
      },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const { data, error, isError, isLoading, isFetching } = useMarkets();
  const markets = data?.markets ?? [];
  const activity = data?.activity ?? [];
  const activeStrategies = markets.reduce((sum, market) => sum + market.strategies, 0);
  const inferredDiscounts = markets
    .map((market) => market.bestDiscount)
    .filter((discount): discount is number => discount !== null);
  const avgDiscount =
    inferredDiscounts.length > 0
      ? inferredDiscounts.reduce((sum, discount) => sum + discount, 0) / inferredDiscounts.length
      : 0;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
          <Badge variant="outline" className="mb-5 border-primary/40 text-primary">
            <span className="mr-1.5 size-1.5 rounded-full bg-primary live-dot" />
            Live term book
          </Badge>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] sm:text-5xl">
                Markets for assets that mature, redeem, and converge to par.
              </h1>
              <p className="mt-5 max-w-2xl text-base text-muted-foreground">
                Browse PT-style and delayed-redemption assets with maker-quoted term discounts,
                strategy depth, maturity windows and recent routed fills.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/sell"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Sell an asset <ArrowUpRight className="size-4" />
              </Link>
              <Link
                to="/make"
                className="inline-flex items-center gap-2 rounded-md border border-border-strong px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-surface"
              >
                Provide liquidity
              </Link>
            </div>
          </div>

          <dl className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            {[
              {
                label: "Open strategies",
                value: activeStrategies,
                fmt: (n: number) => String(Math.round(n)),
              },
              {
                label: "Active markets",
                value: markets.length,
                fmt: (n: number) => String(Math.round(n)),
              },
              {
                label: inferredDiscounts.length > 0 ? "Avg live discount" : "Indexed routes",
                value:
                  inferredDiscounts.length > 0
                    ? avgDiscount
                    : Number(data?.protocol?.cumulativeRouteCount ?? 0),
                fmt: (n: number) =>
                  inferredDiscounts.length > 0 ? `${fmtNum(n)}%` : String(Math.round(n)),
              },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-5 py-5">
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="num mt-2 text-3xl font-semibold text-foreground">
                  <AnimatedNumber value={s.value} format={s.fmt} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Market board</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Indexed markets, maker liquidity and routed fills from the live ZubiDubi subgraph.
            </p>
          </div>
          <span className="num hidden text-xs text-muted-foreground sm:block">
            {data?.blockNumber
              ? `subgraph block ${data.blockNumber}`
              : isFetching
                ? "refreshing"
                : "live subgraph"}
          </span>
        </div>

        {isError ? (
          <div className="panel border-destructive/40 p-5 text-sm text-muted-foreground">
            Market data did not load from the subgraph:{" "}
            {error instanceof Error ? error.message : "unknown error"}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="panel h-56 animate-pulse bg-surface" />
              ))
            : null}

          {!isLoading && markets.length === 0 && !isError ? (
            <div className="panel p-5 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              No active indexed markets yet. Once a strategy is shipped, it will appear here
              automatically.
            </div>
          ) : null}

          {markets.map((m) => (
            <Link
              key={m.id}
              to="/sell"
              search={{ asset: m.symbol }}
              className="group panel p-5 transition-colors hover:border-primary/60"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-semibold">{m.symbol}</span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {m.kind}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{m.name}</p>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="num text-3xl font-semibold text-primary">
                  {m.bestDiscount === null ? "--" : `${fmtNum(m.bestDiscount)}%`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.bestDiscount === null ? "awaiting fill signal" : "live discount"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
                <div>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" /> Maturity
                  </p>
                  <p className="num mt-1 text-sm text-foreground">
                    {m.daysToMaturity === null ? "--" : `${m.daysToMaturity}d`}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Layers className="size-3" /> Liquidity
                  </p>
                  <p className="num mt-1 text-sm text-foreground">{m.liquidityLabel}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Zap className="size-3" /> Strategies
                  </p>
                  <p className="num mt-1 text-sm text-foreground">{m.strategies}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <span className="size-1.5 rounded-full bg-success live-dot" />
              Recent activity
            </h3>
            <span className="text-xs text-muted-foreground">
              {isFetching ? "refreshing" : "indexed live"}
            </span>
          </div>
          <div className="h-64 overflow-hidden">
            {activity.length === 0 ? (
              <div className="flex h-full items-center justify-center px-5 text-center text-sm text-muted-foreground">
                No indexed fills or strategy events yet. Activity will stream in from the subgraph
                after the next route or strategy update.
              </div>
            ) : (
              <div className="marquee-y">
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 border-b border-border/60 px-5 py-3 text-sm"
                  >
                    <span
                      className={
                        a.kind === "fill"
                          ? "size-1.5 shrink-0 rounded-full bg-primary"
                          : a.kind === "strategy"
                            ? "size-1.5 shrink-0 rounded-full bg-success"
                            : "size-1.5 shrink-0 rounded-full bg-muted-foreground"
                      }
                    />
                    <span className="num w-24 shrink-0 text-xs text-muted-foreground">
                      {a.asset}
                    </span>
                    <span className="truncate text-muted-foreground">{a.text}</span>
                    <span className="num ml-auto shrink-0 text-foreground">{a.value}</span>
                    <span className="num w-10 shrink-0 text-right text-xs text-muted-foreground">
                      {a.ago}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
