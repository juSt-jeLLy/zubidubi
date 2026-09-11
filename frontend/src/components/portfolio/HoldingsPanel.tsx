import { ArrowUpRight, CheckCircle2, Clock3, WalletCards } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ReceiptPosition } from "@/services/portfolio/types";

export function HoldingsPanel({ holdings }: { holdings: ReceiptPosition[] }) {
  const visibleHoldings = holdings.filter((holding) => holding.rawBalance > 0n);
  const maturityReadyPct = holdings.length
    ? (holdings.filter((holding) => holding.isMatured).length / holdings.length) * 100
    : 0;
  const routeCoveragePct = holdings.length
    ? (holdings.filter((holding) => holding.sellRoutes.length > 0).length / holdings.length) * 100
    : 0;
  const nextHolding = holdings.find((holding) => holding.rawBalance > 0n) ?? holdings[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest">Live wallet claims</h2>
        </div>
        {visibleHoldings.length ? (
          <div className="divide-y divide-border">
            {visibleHoldings.map((holding) => (
              <div
                key={holding.receiptAddress}
                className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_130px_150px_120px] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{holding.symbol}</span>
                    <StatusBadge holding={holding} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Redeems into {holding.underlying}; routes:{" "}
                    {holding.sellRoutes.length ? holding.sellRoutes.join(" / ") : "no live route"}
                  </p>
                </div>
                <Metric label="Balance" value={holding.formattedBalance} />
                <Metric
                  label="Redeemable"
                  value={`${holding.formattedRedeemable} ${holding.underlying}`}
                />
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <Metric
                    label="Maturity"
                    value={holding.isMatured ? "Ready" : `${holding.daysToMaturity}d`}
                    align="right"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    asChild
                    disabled={!holding.sellRoutes.length}
                  >
                    <Link
                      to="/sell"
                      search={{ asset: holding.symbol }}
                      aria-label={`Sell ${holding.symbol}`}
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<WalletCards className="size-5" />}
            title="No maturing claims in this wallet"
            body="Issue a Sepolia claim below, then it will appear here from direct contract balance reads."
          />
        )}
      </section>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest">Wallet health</h2>
        <div className="mt-5 space-y-5">
          <HealthRow label="Receipt balances indexed" value={visibleHoldings.length ? 100 : 0} />
          <HealthRow label="Maturity-ready assets" value={maturityReadyPct} />
          <HealthRow label="Route coverage" value={routeCoveragePct} />
        </div>
        <div className="mt-6 rounded-md border border-border bg-surface-2 px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            {nextHolding?.isMatured ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <Clock3 className="size-4 text-primary" />
            )}
            Next action
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {nextHolding
              ? nextHolding.isMatured
                ? `${nextHolding.symbol} is mature. Claim ${nextHolding.underlying} from the redemption tab.`
                : `${nextHolding.symbol} matures on ${nextHolding.maturityLabel}. Sell early through live routes or wait for 1:1 redemption.`
              : "Acquire a claim to activate live balance, route, and redemption checks."}
          </p>
        </div>
      </section>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface-2 text-primary">
        {icon}
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function StatusBadge({ holding }: { holding: ReceiptPosition }) {
  const status = holding.claimable ? "claimable" : holding.isMatured ? "matured" : "active";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] uppercase tracking-wider",
        status === "active" && "border-primary/40 text-primary",
        status === "matured" && "border-success/40 text-success",
        status === "claimable" && "border-success/40 bg-success/10 text-success",
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
  const rounded = Math.round(value);
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="num text-primary">{rounded}%</span>
      </div>
      <Progress value={rounded} className="mt-2 bg-surface-2" />
    </div>
  );
}
