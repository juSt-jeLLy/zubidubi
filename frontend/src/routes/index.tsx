import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeDollarSign,
  CircleDollarSign,
  Clock3,
  DatabaseZap,
  GitBranch,
  Layers3,
  ShieldCheck,
  Split,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MARKETS, fmtCompact } from "@/lib/zubi-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZubiDubi - Self-custodial term liquidity" },
      {
        name: "description",
        content:
          "ZubiDubi gives PT tokens and delayed-redemption DeFi assets instant exit liquidity through Aqua maker strategies and modular SwapVM risk curves.",
      },
      { property: "og:title", content: "ZubiDubi - Self-custodial term liquidity" },
      {
        property: "og:description",
        content:
          "A term-liquidity network where makers quote programmable risk curves and sellers get instant USDC without locked pools.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const totalLiquidity = MARKETS.reduce((s, m) => s + m.liquidity, 0);
  const realMarkets = MARKETS.filter((m) => m.kind === "real").length;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
          <div>
            <Badge variant="outline" className="mb-6 border-primary/40 text-primary">
              <span className="mr-1.5 size-1.5 rounded-full bg-primary live-dot" />
              Aqua + modular SwapVM
            </Badge>
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] sm:text-6xl">
              ZubiDubi
            </h1>
            <p className="mt-5 max-w-2xl text-xl font-medium text-foreground">
              Self-custodial term liquidity for Pendle-like maturing DeFi assets.
            </p>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Makers keep liquidity in their wallets, publish risk-aware discount curves, and let sellers exit PT
              tokens or delayed-redemption receipts into USDC before maturity.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild className="font-semibold">
                <Link to="/markets">
                  Explore markets <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="font-semibold">
                <Link to="/sell">
                  Sell a position
                </Link>
              </Button>
              <Button asChild variant="outline" className="font-semibold">
                <a href="/portfolio#acquire">
                  Get demo assets
                </a>
              </Button>
              <Button asChild variant="ghost" className="font-semibold text-muted-foreground">
                <Link to="/make">
                  Make a strategy
                </Link>
              </Button>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Live thesis</h2>
            </div>
            <div className="grid gap-px bg-border">
              <Proof label="Wallet-held liquidity" value={fmtCompact(totalLiquidity)} icon={<Layers3 className="size-4" />} />
              <Proof label="Maturing asset markets" value={`${MARKETS.length} listed`} icon={<Clock3 className="size-4" />} />
              <Proof label="Real PT-style assets" value={`${realMarkets} benchmarked`} icon={<CircleDollarSign className="size-4" />} />
              <Proof label="DAO revenue path" value="10 bps fee" icon={<BadgeDollarSign className="size-4" />} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <ProblemCard
            title="The problem"
            icon={<Clock3 className="size-5" />}
            text="PT tokens, LRT receipts and withdrawal claims mature later, but users often need liquid assets now."
          />
          <ProblemCard
            title="The market"
            icon={<Split className="size-5" />}
            text="Liquidity is fragmented across assets, maturities and risk profiles, so sellers get thin or opaque quotes."
          />
          <ProblemCard
            title="The ZubiDubi fix"
            icon={<ShieldCheck className="size-5" />}
            text="Aqua lets makers quote many exits from wallet-held funds, while SwapVM prices duration, oracle risk and exposure."
          />
        </div>
      </section>

      <section className="border-y border-border bg-surface/50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[360px_1fr]">
          <div>
            <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
              Demo economics
            </Badge>
            <h2 className="text-2xl font-semibold">The discount happens at early exit.</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Sepolia receipts are par-backed so the demo has a real redemption anchor. In production,
              the seller usually arrives with a Pendle PT, withdrawal receipt, vault claim or bridge
              claim that already matures later.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            <Step
              n="A"
              title="Issue or acquire"
              text="Demo users deposit real Sepolia WETH, USDC or LINK; production users bring an existing maturing DeFi claim."
            />
            <Step
              n="B"
              title="Sell before maturity"
              text="ZubiDubi routes the claim to makers who pay liquid USDC/WETH now at a priced term discount."
            />
            <Step
              n="C"
              title="Redeem later"
              text="The maker holds the claim and earns the discount if redemption completes at par after maturity."
            />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">How the trade clears</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                The app is not a normal AMM screen. It is a routeable early-exit market over executable maker curves.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/playground">
                Open playground <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
            <Step n="01" title="Discover" text="Indexed maker strategies expose assets, maturities, quote liquidity and risk limits." />
            <Step n="02" title="Quote" text="SwapVM computes a term discount from maturity, oracle backing value, exposure and risk tier." />
            <Step n="03" title="Split" text="The solver ranks executable fills, skips unsafe makers and splits the seller amount atomically." />
            <Step n="04" title="Settle" text="Aqua pulls maker funds only at execution, transfers receipts to makers, and routes fees." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div>
            <h2 className="text-2xl font-semibold">Why it is more than a swap</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              A normal pool has no opinion about maturity. ZubiDubi quotes against time-to-redemption,
              maker inventory, backing oracles and exposure caps, then proves the route through onchain settlement.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Signal icon={<GitBranch className="size-4" />} title="Modular instructions" text="Backing check, discount curve and exposure cap are reusable SwapVM pieces." />
            <Signal icon={<DatabaseZap className="size-4" />} title="Indexed route surface" text="Strategy discovery is built around indexed market state before final quote checks." />
            <Signal icon={<ShieldCheck className="size-4" />} title="Solvency protection" text="Unavailable balances, revoked approvals and stale oracle paths are skipped before execution." />
            <Signal icon={<BadgeDollarSign className="size-4" />} title="Revenue-bearing" text="The fee path is visible in quote, route, portfolio and demo surfaces." />
          </div>
        </div>
      </section>
    </div>
  );
}

function Proof({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-surface px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md border border-border bg-surface-2 text-primary">
          {icon}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="num text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ProblemCard({ title, text, icon }: { title: string; text: string; icon: ReactNode }) {
  return (
    <div className="panel p-5">
      <span className="grid size-10 place-items-center rounded-md border border-border bg-surface-2 text-primary">
        {icon}
      </span>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="bg-surface px-5 py-6">
      <p className="num text-xs text-primary">{n}</p>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Signal({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
