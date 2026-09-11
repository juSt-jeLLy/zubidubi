import type { ConnectedWallet } from "@privy-io/react-auth";
import { CheckCircle2, Clock3, ExternalLink, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/portfolio/HoldingsPanel";
import { redeemReceiptPosition } from "@/services/portfolio/receiptContracts";
import type { LocalClaimHistory, ReceiptPosition } from "@/services/portfolio/types";

export function RedemptionsPanel({
  positions,
  wallet,
  receiver,
  onClaimed,
  onRefresh,
}: {
  positions: ReceiptPosition[];
  wallet: ConnectedWallet | null;
  receiver: `0x${string}` | null;
  onClaimed: (claim: LocalClaimHistory) => void;
  onRefresh: () => void;
}) {
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => Number(b.claimable) - Number(a.claimable) || a.maturityUnix - b.maturityUnix),
    [positions],
  );

  async function claim(position: ReceiptPosition) {
    if (!wallet || !receiver) return;

    setClaiming(position.receiptAddress);
    setError(null);
    try {
      const result = await redeemReceiptPosition(wallet, position, receiver);
      onClaimed({
        id: `claim-${result.txHash}`,
        symbol: position.symbol,
        amount: result.amount,
        underlying: result.underlying,
        txHash: result.txHash,
        timestamp: Math.floor(Date.now() / 1000),
      });
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not claim matured receipt.");
    } finally {
      setClaiming(null);
    }
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest">Maturity queue</h2>
      </div>
      {error ? (
        <Alert variant="destructive" className="m-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {sortedPositions.length ? (
        <div className="divide-y divide-border">
          {sortedPositions.map((position) => (
            <div
              key={position.receiptAddress}
              className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_150px_150px_150px] md:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{position.symbol}</p>
                  <Badge
                    variant="outline"
                    className={
                      position.claimable
                        ? "border-success/40 text-success"
                        : "border-primary/40 text-primary"
                    }
                  >
                    {position.claimable ? "claim ready" : "locked"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {position.formattedBalance} receipts redeem into {position.formattedRedeemable}{" "}
                  {position.underlying}
                </p>
              </div>
              <StatusTick
                ready={position.rawBalance > 0n}
                label="Wallet balance"
                value={position.formattedBalance}
              />
              <StatusTick
                ready={position.isMatured}
                label="Maturity"
                value={position.isMatured ? "Ready" : `${position.daysToMaturity}d`}
              />
              <Button
                size="sm"
                disabled={!position.claimable || !wallet || claiming === position.receiptAddress}
                onClick={() => claim(position)}
              >
                {claiming === position.receiptAddress ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : position.claimable ? (
                  <ExternalLink className="size-4" />
                ) : (
                  <Clock3 className="size-4" />
                )}
                {position.claimable ? "Claim" : "Track"}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Clock3 className="size-5" />}
          title="No redemption queue yet"
          body="Once your wallet holds a receipt, it will appear here with maturity status and claim action."
        />
      )}
    </section>
  );
}

function StatusTick({ ready, label, value }: { ready: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={
          ready
            ? "flex size-7 items-center justify-center rounded-full bg-success/10 text-success"
            : "flex size-7 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"
        }
      >
        {ready ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
      </span>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="num text-sm">{value}</p>
      </div>
    </div>
  );
}
