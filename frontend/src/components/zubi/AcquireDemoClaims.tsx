import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock3,
  Coins,
  ExternalLink,
  Loader2,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtNum } from "@/lib/zubi-data";
import { useMarkets } from "@/services/markets/useMarkets";
import {
  buildDemoClaims,
  demoClaimSummary,
  explorerAddressUrl,
  explorerTxUrl,
  type DemoClaimAsset,
} from "@/services/portfolio/demoClaims";
import {
  issueDemoClaim,
  previewClaimReceipts,
  readUnderlyingBalance,
} from "@/services/portfolio/issueClaim";
import { useWallet } from "@/services/wallet/context";

type Phase = "idle" | "approving" | "issuing" | "confirming" | "success" | "error";
function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AcquireDemoClaims() {
  const { address, connect, connecting } = useWallet();
  const { wallets } = useWallets();
  const { data: marketBoard, isLoading, isError, refetch } = useMarkets();

  const claims = useMemo(
    () =>
      buildDemoClaims(
        marketBoard?.receiptAssets ?? [],
        marketBoard?.underlyingTokens ?? {},
        marketBoard?.markets ?? [],
      ),
    [marketBoard],
  );

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | null>(null);
  const [issueHash, setIssueHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = claims.find((claim) => claim.symbol === selectedSymbol) ?? null;
  const busy = phase === "approving" || phase === "issuing" || phase === "confirming";

  const selectClaim = (symbol: string) => {
    const asset = claims.find((claim) => claim.symbol === symbol) ?? null;
    setSelectedSymbol(symbol);
    setAmount(asset?.suggestedAmount ?? "");
    setPhase("idle");
    setApprovalHash(null);
    setIssueHash(null);
    setError(null);
  };

  const closeDialog = () => {
    if (busy) return;
    setSelectedSymbol(null);
    setPhase("idle");
    setApprovalHash(null);
    setIssueHash(null);
    setError(null);
  };

  const balanceQuery = useQuery({
    queryKey: ["issue-claim-balance", selected?.symbol, address],
    queryFn: () => readUnderlyingBalance(selected!, address as `0x${string}`),
    enabled: Boolean(selected && address),
    retry: 1,
    refetchInterval: 10_000,
  });

  const previewQuery = useQuery({
    queryKey: ["issue-claim-preview", selected?.symbol, amount],
    queryFn: () => previewClaimReceipts(selected!, amount),
    enabled: Boolean(selected && Number(amount) > 0),
    retry: 1,
  });

  const connectedWallet = address
    ? wallets.find((wallet) => wallet.address.toLowerCase() === address.toLowerCase())
    : null;

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a claim first.");
      if (!address) throw new Error("Connect your wallet first.");
      if (!connectedWallet) throw new Error("Privy did not find your connected wallet.");

      setApprovalHash(null);
      setIssueHash(null);
      setError(null);
      setPhase("approving");
      return issueDemoClaim(connectedWallet, selected, amount, address as `0x${string}`, {
        onApprovalSubmitted: (hash) => {
          setApprovalHash(hash);
          setPhase("confirming");
        },
        onIssueSubmitted: (hash) => {
          setIssueHash(hash);
          setPhase("confirming");
        },
      });
    },
    onSuccess: (result) => {
      setIssueHash(result.issueHash);
      setApprovalHash(result.approvalHash);
      setPhase("success");
      balanceQuery.refetch();
    },
    onError: (issueError) => {
      setError(issueError instanceof Error ? issueError.message : String(issueError));
      setPhase("error");
    },
  });

  const numAmount = Number(amount);
  const amountValid = Number.isFinite(numAmount) && numAmount > 0;
  const balance = balanceQuery.data ? Number(balanceQuery.data.formatted) : null;
  const exceedsBalance = balance !== null && numAmount > balance;
  const canIssue = Boolean(selected && address && amountValid && !exceedsBalance && !busy);

  return (
    <section id="acquire" className="mt-8 scroll-mt-24">
      <div className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-5">
          <Badge variant="outline" className="border-primary/40 text-primary">
            <WalletCards className="size-3.5" />
            Demo assets
          </Badge>
          <h2 className="mt-4 text-2xl font-semibold">{demoClaimSummary.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{demoClaimSummary.body}</p>
        </div>

        <div className="grid gap-6 border-t border-border bg-surface px-5 py-5 lg:grid-cols-[1fr_400px]">
          <div>
            <h3 className="text-sm font-semibold">Choose a claim</h3>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Pick a maturing claim from the list — the issue popup opens with the details, your
              balance and the deposit flow.
            </p>

            <Select
              value={selectedSymbol ?? ""}
              onValueChange={(symbol) => symbol && selectClaim(symbol)}
              disabled={isLoading || isError || claims.length === 0}
            >
              <SelectTrigger className="h-12 sm:max-w-sm">
                <SelectValue
                  placeholder={
                    isLoading
                      ? "Loading live claims…"
                      : isError
                        ? "Claims unavailable — retry"
                        : claims.length === 0
                          ? "No claims indexed yet"
                          : "Select a claim…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {claims.map((asset) => (
                  <SelectItem key={asset.symbol} value={asset.symbol}>
                    {asset.symbol} · deposit {asset.suggestedDeposit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isError ? (
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Retry live claims
              </button>
            ) : claims.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {claims.length} claims indexed from the live subgraph.
              </p>
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-surface-2 px-4 py-3 text-xs">
            <p className="font-semibold text-muted-foreground">How it works</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li>1 · Pick a claim from the dropdown.</li>
              <li>2 · Enter the backing amount (WETH / USDC / LINK).</li>
              <li>3 · Approve & issue — the claim lands in your wallet.</li>
              <li>4 · Sell it early on the sell page or redeem at maturity.</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border bg-surface px-5 py-4">
          <p className="text-xs text-muted-foreground">{demoClaimSummary.production}</p>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected ? (
            phase === "success" ? (
              <SuccessPanel
                asset={selected}
                approvalHash={approvalHash}
                issueHash={issueHash}
                receiptAmount={issueMutation.data?.receiptAmount ?? ""}
                onReset={closeDialog}
              />
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{selected.symbol}</span>
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {selected.tenor}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>
                    Deposit {selected.depositToken} into the live Sepolia receipt contract and the
                    claim is minted straight to your wallet.
                  </DialogDescription>
                </DialogHeader>

                <IssueForm
                  asset={selected}
                  amount={amount}
                  onAmountChange={(value) => {
                    setAmount(value);
                    setError(null);
                    setPhase("idle");
                  }}
                  onMax={() => {
                    if (balanceQuery.data) {
                      setAmount(balanceQuery.data.formatted);
                      setError(null);
                      setPhase("idle");
                    }
                  }}
                  address={address}
                  connecting={connecting}
                  onConnect={connect}
                  balanceFormatted={balanceQuery.data?.formatted ?? null}
                  balanceLoading={balanceQuery.isFetching}
                  balanceError={balanceQuery.isError ? errorMessage(balanceQuery.error) : null}
                  preview={previewQuery.data ?? null}
                  previewError={previewQuery.isError ? errorMessage(previewQuery.error) : null}
                  canIssue={canIssue}
                  busy={busy}
                  busyLabel={
                    phase === "approving"
                      ? "Approving backing token…"
                      : phase === "issuing"
                        ? "Issuing claim…"
                        : approvalHash
                          ? "Waiting for claim receipt…"
                          : "Confirming approval…"
                  }
                  error={error}
                  approvalHash={approvalHash}
                  issueHash={issueHash}
                  onIssue={() => issueMutation.mutate()}
                />
              </>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function IssueForm({
  asset,
  amount,
  onAmountChange,
  onMax,
  address,
  connecting,
  onConnect,
  balanceFormatted,
  balanceLoading,
  balanceError,
  preview,
  previewError,
  canIssue,
  busy,
  busyLabel,
  error,
  approvalHash,
  issueHash,
  onIssue,
}: {
  asset: DemoClaimAsset;
  amount: string;
  onAmountChange: (value: string) => void;
  onMax: () => void;
  address: string | null;
  connecting: boolean;
  onConnect: () => void;
  balanceFormatted: string | null;
  balanceLoading: boolean;
  balanceError: string | null;
  preview: string | null;
  previewError: string | null;
  canIssue: boolean;
  busy: boolean;
  busyLabel: string;
  error: string | null;
  approvalHash: `0x${string}` | null;
  issueHash: `0x${string}` | null;
  onIssue: () => void;
}) {
  const numAmount = Number(amount);
  const amountValid = Number.isFinite(numAmount) && numAmount > 0;
  const exceedsBalance = balanceFormatted !== null && Number(balanceFormatted) < numAmount;

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-xs">
        <span className="text-muted-foreground">
          Backing: <span className="text-foreground">{asset.backingRatio}</span>
        </span>
        <span className="text-muted-foreground">
          Matures: <span className="num text-foreground">{asset.maturity}</span>
        </span>
        <span className="text-muted-foreground">
          Routes:{" "}
          <span className="text-foreground">
            {asset.availableRoutes.length > 0 ? asset.availableRoutes.join(" / ") : "none indexed"}
          </span>
        </span>
        <a
          href={explorerAddressUrl(asset.receiptAddress)}
          target="_blank"
          rel="noreferrer"
          className="num inline-flex items-center gap-1 text-primary hover:underline"
        >
          {shortAddress(asset.receiptAddress)} <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="mt-4 rounded-md border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
        {asset.productUse}
      </div>

      {!address ? (
        <div className="mt-5 rounded-md border border-border bg-surface-2 px-5 py-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <WalletCards className="size-4 text-primary" />
            Connect your wallet to issue
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            The claim is minted straight into your wallet on Sepolia. Connect to check your balance
            and approve the deposit.
          </p>
          <Button onClick={onConnect} disabled={connecting} className="mt-4 w-full font-semibold">
            <WalletCards className="size-4" />
            {connecting ? "Connecting..." : "Connect wallet"}
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label htmlFor="issue-amount" className="text-xs font-medium text-muted-foreground">
                Amount to deposit
              </label>
              <span className="text-xs text-muted-foreground">
                Balance:{" "}
                <button
                  type="button"
                  onClick={onMax}
                  className="num font-medium text-primary hover:underline"
                >
                  {balanceFormatted !== null ? (
                    `${fmtNum(Number(balanceFormatted), 4)} ${asset.underlying}`
                  ) : balanceError ? (
                    <span className="text-destructive/80">unavailable</span>
                  ) : balanceLoading ? (
                    "loading…"
                  ) : (
                    "unknown"
                  )}
                </button>{" "}
                <span className="text-muted-foreground/60">(Max)</span>
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                id="issue-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="num h-12 flex-1 text-lg"
              />
              <span className="grid h-12 place-items-center rounded-md border border-border bg-surface-2 px-3 text-sm font-semibold">
                {asset.underlying}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Suggested:</span>
              <button
                type="button"
                onClick={() => onAmountChange(asset.suggestedAmount)}
                className="num text-[11px] font-medium text-primary hover:underline"
              >
                {asset.suggestedDeposit}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
            <Coins className="size-4 text-primary" />
            <span className="text-xs text-muted-foreground">You receive</span>
            {preview ? (
              <span className="num ml-auto text-sm font-semibold">
                ≈ {fmtNum(Number(preview), 4)} {asset.symbol}
              </span>
            ) : previewError ? (
              <span className="num ml-auto text-sm font-semibold text-destructive/80">
                preview failed
              </span>
            ) : amountValid ? (
              <span className="num ml-auto text-sm font-semibold text-muted-foreground/60">
                previewing…
              </span>
            ) : (
              <span className="num ml-auto text-sm font-semibold text-muted-foreground/60">—</span>
            )}
          </div>

          {exceedsBalance ? (
            <div className="mt-3 flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                You don't have that much {asset.underlying} on Sepolia. Use a smaller amount or top
                up from a Sepolia faucet.
              </p>
            </div>
          ) : null}

          {balanceError ? (
            <div className="mt-3 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <p className="text-xs text-muted-foreground">{balanceError}</p>
            </div>
          ) : null}

          <Button onClick={onIssue} disabled={!canIssue} className="mt-4 w-full font-semibold">
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {busyLabel}
              </>
            ) : (
              <>
                <WalletCards className="size-4" />
                Approve & issue {asset.symbol}
              </>
            )}
          </Button>

          {(approvalHash || issueHash) && !busy && (
            <div className="mt-3 space-y-1.5">
              {approvalHash ? (
                <a
                  href={explorerTxUrl(approvalHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="num flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                >
                  Approval tx: {shortAddress(approvalHash)} <ExternalLink className="size-3" />
                </a>
              ) : null}
              {issueHash ? (
                <a
                  href={explorerTxUrl(issueHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="num flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                >
                  Issue tx: {shortAddress(issueHash)} <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          )}

          {error ? (
            <div className="mt-3 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <p className="text-xs text-muted-foreground">
                {error}
                {error.includes("user rejected") ? " Request was cancelled in your wallet." : ""}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function SuccessPanel({
  asset,
  approvalHash,
  issueHash,
  receiptAmount,
  onReset,
}: {
  asset: DemoClaimAsset;
  approvalHash: `0x${string}` | null;
  issueHash: `0x${string}` | null;
  receiptAmount: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="grid size-12 place-items-center rounded-full border border-success/40 bg-success/10">
        <Check className="size-6 text-success" />
      </div>
      <h3 className="mt-5 text-xl font-semibold">Claim minted to your wallet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Your {asset.underlying} deposit was converted into a maturing {asset.symbol} receipt that
        now sits in your connected wallet.
      </p>

      <dl className="mt-6 grid w-full gap-px overflow-hidden rounded-lg border border-border bg-border text-left sm:grid-cols-2">
        <div className="bg-surface px-4 py-4">
          <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">Minted</dt>
          <dd className="num mt-1.5 text-lg">
            {receiptAmount ? fmtNum(Number(receiptAmount), 4) : "—"} {asset.symbol}
          </dd>
        </div>
        <div className="bg-surface px-4 py-4">
          <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">Matures</dt>
          <dd className="num mt-1.5 text-lg">{asset.maturity}</dd>
        </div>
      </dl>

      <a
        href={issueHash ? explorerTxUrl(issueHash) : "#"}
        target="_blank"
        rel="noreferrer"
        className="num mt-5 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        {issueHash ? shortAddress(issueHash) : "transaction pending"}{" "}
        <ExternalLink className="size-3" />
      </a>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild className="font-semibold">
          <Link to="/sell" search={{ asset: asset.symbol }}>
            Sell it early <ArrowUpRight className="size-4" />
          </Link>
        </Button>
        <Button variant="outline" onClick={onReset}>
          Issue another
        </Button>
      </div>

      {approvalHash ? (
        <a
          href={explorerTxUrl(approvalHash)}
          target="_blank"
          rel="noreferrer"
          className="num mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary"
        >
          Approval tx: {shortAddress(approvalHash)} <ExternalLink className="size-3" />
        </a>
      ) : null}
    </div>
  );
}
