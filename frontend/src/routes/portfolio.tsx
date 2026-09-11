import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Clock3,
  Coins,
  LineChart,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AcquireDemoClaims } from "@/components/zubi/AcquireDemoClaims";
import { SectionBoundary } from "@/components/zubi/SectionBoundary";
import { StrategyList } from "@/components/zubi/StrategyList";
import {
  HOLDINGS,
  MY_STRATEGIES,
  REDEMPTIONS,
  ROUTE_PREVIEWS,
  fmtCompact,
  fmtNum,
  fmtUsd,
} from "@/lib/zubi-data";
import { cn } from "@/lib/utils";
import { useWallet } from "@/services/wallet/context";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio - ZubiDubi" },
      {
        name: "description",
        content:
          "Track maturing assets, maker exposure, redemption readiness and route history across ZubiDubi markets.",
      },
      { property: "og:title", content: "Portfolio - ZubiDubi" },
      {
        property: "og:description",
        content: "A product surface for holders and makers using Aqua-native term liquidity.",
      },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { address, connect, connecting } = useWallet();
  const totalHoldings = HOLDINGS.reduce((sum, h) => sum + h.valueUsd, 0);
  const exposure = MY_STRATEGIES.reduce((sum, s) => sum + s.exposureUsed, 0);
  const cap = MY_STRATEGIES.reduce((sum, s) => sum + s.exposureCap, 0);
  const fees = MY_STRATEGIES.reduce((sum, s) => sum + s.feesEarned, 0);
  const exposurePct = cap > 0 ? (exposure / cap) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <WalletCards className="size-3.5" />
            Portfolio
          </Badge>
          <h1 className="text-3xl font-semibold">Term liquidity cockpit</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            One place to watch maturing assets, routeable exits, maker exposure and redemption
            readiness.
          </p>
        </div>
        {!address ? (
          <Button
            onClick={connect}
            disabled={connecting}
            className="w-full font-semibold sm:w-auto"
          >
            <WalletCards className="size-4" />
            {connecting ? "Connecting..." : "Connect wallet"}
          </Button>
        ) : (
          <div className="panel flex items-center gap-3 px-4 py-3">
            <span className="size-2 rounded-full bg-success live-dot" />
            <div>
              <p className="text-xs text-muted-foreground">Connected account</p>
              <p className="num text-sm">
                {address.slice(0, 8)}...{address.slice(-6)}
              </p>
            </div>
          </div>
        )}
      </div>

      <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Exitable value"
          value={fmtUsd(totalHoldings, 0)}
          icon={<Coins className="size-4" />}
        />
        <Stat
          label="Maker exposure"
          value={fmtCompact(exposure)}
          icon={<LineChart className="size-4" />}
        />
        <Stat
          label="Exposure used"
          value={`${fmtNum(exposurePct, 1)}%`}
          icon={<ShieldCheck className="size-4" />}
        />
        <Stat
          label="Fees earned"
          value={fmtUsd(fees, 2)}
          icon={<BadgeDollarSign className="size-4" />}
        />
      </dl>

      <SectionBoundary label="acquire-demo-claims">
        <AcquireDemoClaims />
      </SectionBoundary>

      <Tabs defaultValue="holdings" className="mt-8">
        <TabsList className="h-auto flex-wrap justify-start rounded-md border border-border bg-surface p-1">
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
          <TabsTrigger value="history">Route History</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="panel overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest">
                  Exit-ready positions
                </h2>
              </div>
              <div className="divide-y divide-border">
                {HOLDINGS.map((h) => (
                  <div
                    key={h.symbol}
                    className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_130px_150px_120px] md:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{h.symbol}</span>
                        <StatusBadge status={h.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Redeems into {h.underlying}; entry discount {fmtNum(h.entryDiscount)}%
                      </p>
                    </div>
                    <Metric label="Amount" value={fmtNum(h.amount, h.amount < 100 ? 2 : 0)} />
                    <Metric label="Value" value={fmtUsd(h.valueUsd, 0)} />
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <Metric
                        label="Maturity"
                        value={h.maturesInDays === 0 ? "Ready" : `${h.maturesInDays}d`}
                        align="right"
                      />
                      <Button size="icon" variant="outline" asChild>
                        <Link
                          to="/sell"
                          search={{ asset: h.symbol }}
                          aria-label={`Sell ${h.symbol}`}
                        >
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel p-5">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Wallet health</h2>
              <div className="mt-5 space-y-5">
                <HealthRow label="Allowance coverage" value={94} />
                <HealthRow label="Oracle-safe positions" value={87} />
                <HealthRow label="Maturity diversification" value={71} />
              </div>
              <div className="mt-6 rounded-md border border-border bg-surface-2 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock3 className="size-4 text-primary" />
                  Next action
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  PT-zbETH-30D matures next. Redeem to WETH at maturity or route it through the best
                  maker quote.
                </p>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="strategies" className="mt-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <StrategyList title="Maker strategies" />
            <aside className="panel p-5">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Exposure summary</h2>
              <Progress value={exposurePct} className="mt-5 bg-surface-2" />
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span className="num">{fmtCompact(exposure)} used</span>
                <span className="num">{fmtCompact(cap)} cap</span>
              </div>
              <div className="mt-6 space-y-3 text-sm">
                <Row label="Pricing model" value="modular term curve" />
                <Row label="Revenue" value={`${fmtUsd(fees, 2)} fees`} />
                <Row label="Risk mode" value="dual-oracle guarded" />
                <Row label="Capital model" value="wallet-held liquidity" />
              </div>
              <Button asChild className="mt-6 w-full font-semibold">
                <Link to="/make">Create strategy</Link>
              </Button>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="redemptions" className="mt-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Maturity queue</h2>
            </div>
            <div className="divide-y divide-border">
              {REDEMPTIONS.map((r) => (
                <div
                  key={r.id}
                  className="grid gap-4 px-5 py-4 md:grid-cols-[120px_1fr_140px_120px] md:items-center"
                >
                  <span className="num text-xs text-muted-foreground">{r.id}</span>
                  <div>
                    <p className="font-semibold">{r.asset}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtNum(r.amount, r.amount < 100 ? 2 : 0)} redeemable into {r.underlying}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">{r.maturity}</span>
                  <Button
                    size="sm"
                    variant={r.state === "ready" ? "default" : "outline"}
                    disabled={r.state === "claimed"}
                  >
                    {r.state === "ready" ? "Redeem" : r.state === "pending" ? "Track" : "Claimed"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest">
                Recent solver routes
              </h2>
            </div>
            <div className="divide-y divide-border">
              {ROUTE_PREVIEWS.map((r) => (
                <div
                  key={`${r.asset}-${r.amount}`}
                  className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_150px_130px_130px_160px] lg:items-center"
                >
                  <div>
                    <p className="font-semibold">{r.asset}</p>
                    <p className="text-xs text-muted-foreground">Best maker {r.bestMaker}</p>
                  </div>
                  <Metric label="Sold" value={fmtNum(r.amount, r.amount < 100 ? 2 : 0)} />
                  <Metric label="Net" value={fmtUsd(r.netUsd, 2)} />
                  <Metric label="DAO fee" value={fmtUsd(r.feeUsd, 2)} />
                  <div className="flex items-center gap-2 lg:justify-end">
                    <Badge variant="outline" className="border-success/40 text-success">
                      {r.fills} fills
                    </Badge>
                    <Badge variant="outline" className="text-muted-foreground">
                      {r.skipped} skipped
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="bg-surface px-5 py-5">
      <dt className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="num mt-2 text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "matured" | "redeeming" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] uppercase tracking-wider",
        status === "active" && "border-primary/40 text-primary",
        status === "matured" && "border-success/40 text-success",
        status === "redeeming" && "border-warning/40 text-warning",
      )}
    >
      {status}
    </Badge>
  );
}

function Metric({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="num mt-1 text-sm">{value}</p>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="num text-primary">{value}%</span>
      </div>
      <Progress value={value} className="mt-2 bg-surface-2" />
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
