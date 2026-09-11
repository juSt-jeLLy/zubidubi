import { ExternalLink, History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/portfolio/HoldingsPanel";
import { explorerTxUrl } from "@/services/portfolio/demoClaims";
import type { PortfolioRouteHistory } from "@/services/portfolio/types";

export function RouteHistoryPanel({ history }: { history: PortfolioRouteHistory[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest">
          Wallet route and claim history
        </h2>
      </div>
      {history.length ? (
        <div className="divide-y divide-border">
          {history.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_160px_160px_130px_90px] lg:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{item.title}</p>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {item.kind}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <Metric label="In" value={item.amountIn} />
              <Metric label="Out" value={item.amountOut} />
              <Metric label="Fee" value={item.fee} />
              <div className="flex items-center justify-end gap-2">
                {item.fills ? (
                  <Badge variant="outline" className="border-success/40 text-success">
                    {item.fills} fills
                  </Badge>
                ) : null}
                {item.txHash ? (
                  <Button size="icon" variant="outline" asChild>
                    <a
                      href={explorerTxUrl(item.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open transaction"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<History className="size-5" />}
          title="No wallet routes indexed yet"
          body="Sell a maturing claim or claim a matured receipt and the transaction history will appear here."
        />
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="num mt-1 text-sm">{value}</p>
    </div>
  );
}
