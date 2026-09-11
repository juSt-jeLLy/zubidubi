import { BadgeDollarSign, LineChart, ShieldCheck, TicketCheck } from "lucide-react";
import type { ReactNode } from "react";

import type { LivePortfolio } from "@/services/portfolio/types";

export function PortfolioStats({ portfolio }: { portfolio: LivePortfolio }) {
  return (
    <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Wallet claims"
        value={portfolio.totals.claimCount.toLocaleString("en-US")}
        icon={<TicketCheck className="size-4" />}
      />
      <Stat
        label="Claimable now"
        value={portfolio.totals.claimableCount.toLocaleString("en-US")}
        icon={<ShieldCheck className="size-4" />}
      />
      <Stat
        label="Maker strategies"
        value={portfolio.totals.activeStrategyCount.toLocaleString("en-US")}
        icon={<LineChart className="size-4" />}
      />
      <Stat
        label="Route events"
        value={portfolio.totals.routeCount.toLocaleString("en-US")}
        icon={<BadgeDollarSign className="size-4" />}
      />
    </dl>
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
