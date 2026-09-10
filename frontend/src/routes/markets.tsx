import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, Layers, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/zubi/AnimatedNumber";
import { ACTIVITY, MARKETS, fmtCompact, fmtNum } from "@/lib/zubi-data";

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
        content: "Best maker-quoted discounts, liquidity and active strategy depth for maturing DeFi assets.",
      },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const totalLiquidity = MARKETS.reduce((s, m) => s + m.liquidity, 0);
  const avgDiscount = MARKETS.reduce((s, m) => s + m.bestDiscount, 0) / MARKETS.length;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 3500);
    return () => window.clearInterval(id);
  }, []);
  const jitter = (base: number, pct: number) => base * (1 + Math.sin(tick * 1.7) * pct);

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
              { label: "Open maker liquidity", value: jitter(totalLiquidity, 0.004), fmt: fmtCompact },
              { label: "Active markets", value: MARKETS.length, fmt: (n: number) => String(Math.round(n)) },
              { label: "Avg best discount", value: jitter(avgDiscount, 0.02), fmt: (n: number) => `${fmtNum(n)}%` },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-5 py-5">
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{s.label}</dt>
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
            <p className="mt-1 text-sm text-muted-foreground">Best quoted discount per asset, updated per block.</p>
          </div>
          <span className="num hidden text-xs text-muted-foreground sm:block">block 7,241,908</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETS.map((m) => (
            <Link
              key={m.symbol}
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
                <span className="num text-3xl font-semibold text-primary">{fmtNum(m.bestDiscount)}%</span>
                <span className="text-xs text-muted-foreground">best discount</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
                <div>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" /> Maturity
                  </p>
                  <p className="num mt-1 text-sm text-foreground">{m.daysToMaturity}d</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Layers className="size-3" /> Liquidity
                  </p>
                  <p className="num mt-1 text-sm text-foreground">{fmtCompact(m.liquidity)}</p>
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
            <span className="text-xs text-muted-foreground">last 15 minutes</span>
          </div>
          <div className="h-64 overflow-hidden">
            <div className="marquee-y">
              {[...ACTIVITY, ...ACTIVITY].map((a, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-border/60 px-5 py-3 text-sm">
                  <span
                    className={
                      a.kind === "fill"
                        ? "size-1.5 shrink-0 rounded-full bg-primary"
                        : a.kind === "strategy"
                          ? "size-1.5 shrink-0 rounded-full bg-success"
                          : "size-1.5 shrink-0 rounded-full bg-muted-foreground"
                    }
                  />
                  <span className="num w-24 shrink-0 text-xs text-muted-foreground">{a.asset}</span>
                  <span className="truncate text-muted-foreground">{a.text}</span>
                  <span className="num ml-auto shrink-0 text-foreground">{a.value}</span>
                  <span className="num w-10 shrink-0 text-right text-xs text-muted-foreground">{a.ago}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
