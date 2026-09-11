import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnimatedNumber } from "@/components/zubi/AnimatedNumber";
import { cn } from "@/lib/utils";
import { useWallet } from "@/services/wallet/context";
import { fmtNum } from "@/lib/zubi-data";
import { useMarkets } from "@/services/markets/useMarkets";
import { requestRouteQuote } from "@/services/solver/client";
import { executeRouteQuote } from "@/services/solver/execute";
import type { SolverQuote, SolverQuoteError } from "@/services/solver/types";

const searchSchema = z.object({ asset: z.string().optional() });

export const Route = createFileRoute("/sell")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sell — ZubiDubi early exit liquidity" },
      {
        name: "description",
        content:
          "Get a routed quote across competing makers for your maturing PT or LRT receipt, with a full per-maker fill breakdown.",
      },
      { property: "og:title", content: "Sell your maturing position — ZubiDubi" },
      {
        property: "og:description",
        content:
          "Transparent per-maker fill breakdown, benchmarked against the Pendle market rate.",
      },
    ],
  }),
  component: SellPage,
});

type Phase = "idle" | "quoting" | "quoted" | "approving" | "confirming" | "success" | "error";

type MakerRow = {
  maker: string;
  orderHash: string;
  fillIn: string;
  amountOut: string;
  status: "filled" | "skipped";
};

function StatusBadge({ status }: { status: MakerRow["status"] }) {
  if (status === "filled")
    return (
      <Badge className="gap-1 border-success/40 bg-success/10 text-success" variant="outline">
        <Check className="size-3" /> Filled
      </Badge>
    );
  return (
    <Badge
      className="gap-1 border-border-strong bg-surface-2 text-muted-foreground"
      variant="outline"
    >
      <X className="size-3" /> Skipped
    </Badge>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatToken(value: string | number, symbol: string, decimals = 6) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return `-- ${symbol}`;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(parsed)} ${symbol}`;
}

function SellPage() {
  const { asset } = Route.useSearch();
  const { address, connect, connecting } = useWallet();
  const { wallets } = useWallets();
  const { data: marketBoard, isLoading: marketsLoading, isError: marketsError } = useMarkets();
  const markets = useMemo(() => marketBoard?.markets ?? [], [marketBoard?.markets]);

  const [marketId, setMarketId] = useState<string>("");
  const [amount, setAmount] = useState("0.003");
  const [phase, setPhase] = useState<Phase>("idle");
  const [expanded, setExpanded] = useState(true);
  const [flipped, setFlipped] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liquidityErrorQuote, setLiquidityErrorQuote] = useState<SolverQuote | null>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [routeHash, setRouteHash] = useState<string | null>(null);

  useEffect(() => {
    if (marketId || markets.length === 0) return;
    const initial = asset
      ? markets.find((market) => market.id === asset || market.symbol === asset)
      : null;
    setMarketId((initial ?? markets[0])!.id);
  }, [asset, marketId, markets]);

  const market = markets.find((item) => item.id === marketId) ?? markets[0] ?? null;
  const quoteMutation = useMutation({
    mutationFn: async () => {
      if (!market) throw new Error("Select a live market first.");
      return requestRouteQuote({
        tokenIn: market.tokenIn,
        tokenOut: market.tokenOut,
        amountIn: amount || "0",
        inputDecimals: market.receiptDecimals,
      });
    },
    onSuccess: () => {
      setLiquidityErrorQuote(null);
      setError(null);
      setPhase("quoted");
    },
    onError: (quoteError: SolverQuoteError) => {
      setLiquidityErrorQuote(quoteError.quote ?? null);
      setError(quoteError.message);
      setPhase(quoteError.code === "insufficient_liquidity" ? "idle" : "error");
    },
  });
  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!quote) throw new Error("Get an executable quote first.");
      if (!quote.execution)
        throw new Error("This quote cannot be executed because it is not fully filled.");
      if (!address) throw new Error("Connect your wallet first.");
      const wallet = wallets.find((item) => item.address.toLowerCase() === address.toLowerCase());
      if (!wallet) throw new Error("Connected wallet was not found by Privy.");

      setPhase("approving");
      const result = await executeRouteQuote(wallet, quote, address as `0x${string}`, {
        onApprovalSubmitted: (hash) => {
          setApprovalHash(hash);
          setPhase("confirming");
        },
        onRouteSubmitted: (hash) => {
          setRouteHash(hash);
          setPhase("confirming");
        },
      });
      return result;
    },
    onSuccess: (result) => {
      setRouteHash(result.routeHash);
      setError(null);
      setPhase("success");
    },
    onError: (executeError) => {
      setError(executeError instanceof Error ? executeError.message : String(executeError));
      setPhase("error");
    },
  });

  const amt = Number(amount) || 0;
  const quote = quoteMutation.data ?? null;
  const quoteSymbol = market?.quoteSymbol ?? "";
  const makerRows = useMemo<MakerRow[]>(() => {
    const fills =
      quote?.routePreview.fills.map((fill) => ({
        maker: fill.maker,
        orderHash: fill.orderHash,
        fillIn: fill.fillIn,
        amountOut: fill.estimatedGrossOut,
        status: "filled" as const,
      })) ?? [];
    const skipped =
      quote?.skippedMakers.map((maker) => ({
        maker: maker.maker,
        orderHash: maker.orderHash,
        fillIn: "0",
        amountOut: "0",
        status: "skipped" as const,
      })) ?? [];
    return [...fills, ...skipped];
  }, [quote]);
  const filled = makerRows.filter((row) => row.status === "filled");
  const gross = filled.reduce((sum, fill) => sum + Number(fill.amountOut), 0);
  const net = quote ? Number(quote.quotedNetOut) : 0;
  const fee = Math.max(0, gross - net);
  const fillPercent = quote
    ? (Number(quote.quotedReceiptIn) / Math.max(Number(quote.requestedReceiptIn), 1e-18)) * 100
    : 0;

  const runQuote = () => {
    setError(null);
    setLiquidityErrorQuote(null);
    setApprovalHash(null);
    setRouteHash(null);
    setPhase("quoting");
    quoteMutation.mutate();
  };

  const execute = () => {
    executeMutation.mutate();
  };

  if (phase === "success") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <div className="panel flip-in p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full border border-success/40 bg-success/10">
            <Check className="size-6 text-success" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Exit settled</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quote?.quotedReceiptIn} {market?.symbol} sold across {filled.length} makers.
          </p>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border text-left sm:grid-cols-3">
            {[
              { l: "Net received", v: formatToken(net, quoteSymbol) },
              { l: "Filled", v: `${fmtNum(fillPercent, 2)}%` },
              { l: "Protocol fee", v: formatToken(fee, quoteSymbol) },
            ].map((x) => (
              <div key={x.l} className="bg-surface px-4 py-4">
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {x.l}
                </dt>
                <dd className="num mt-1.5 text-lg">{x.v}</dd>
              </div>
            ))}
          </dl>

          <a
            href={routeHash ? `https://sepolia.etherscan.io/tx/${routeHash}` : "#"}
            target="_blank"
            rel="noreferrer"
            className="num mt-6 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            {routeHash ? shortAddress(routeHash) : "transaction pending"}{" "}
            <ExternalLink className="size-3" />
          </a>

          <div className="mt-8 flex justify-center gap-3">
            <Button variant="outline" onClick={() => setPhase("idle")}>
              Sell another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Sell</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Route your maturing position across live maker strategies.
      </p>

      {/* Step 1 */}
      <section className="panel mt-8 p-5">
        <StepHeader n={1} title="Asset & amount" />
        <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
          <Select
            value={marketId}
            onValueChange={(v) => {
              setMarketId(v);
              setPhase("idle");
              quoteMutation.reset();
              setLiquidityErrorQuote(null);
              setApprovalHash(null);
              setRouteHash(null);
            }}
            disabled={marketsLoading || markets.length === 0}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder={marketsLoading ? "Loading markets" : "Select market"} />
            </SelectTrigger>
            <SelectContent>
              {markets.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.symbol} {"->"} {m.quoteSymbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^0-9.]/g, ""));
              setPhase("idle");
              quoteMutation.reset();
              setLiquidityErrorQuote(null);
              setApprovalHash(null);
              setRouteHash(null);
            }}
            placeholder="0.00"
            className="num h-12 text-lg"
          />
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
          <ArrowDown className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">You receive (est.)</span>
          <span className="num ml-auto text-lg font-semibold">
            <AnimatedNumber value={net} format={(n) => formatToken(n, quoteSymbol)} />
          </span>
        </div>

        {marketsError ? (
          <div className="mt-4 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">
              Live markets did not load from the subgraph. The sell quote cannot be generated.
            </p>
          </div>
        ) : null}

        {liquidityErrorQuote ? (
          <div className="mt-4 flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-3 text-sm">
            <ShieldAlert className="size-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-warning">Not enough maker liquidity</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Requested {liquidityErrorQuote.requestedReceiptIn} {market?.symbol}, but the live
                route can only fill {liquidityErrorQuote.quotedReceiptIn}. Shortfall:{" "}
                {liquidityErrorQuote.shortfallReceiptIn}.
              </p>
            </div>
          </div>
        ) : null}

        {phase === "idle" && (
          <Button
            className="mt-4 w-full font-semibold"
            onClick={runQuote}
            disabled={amt <= 0 || !market || marketsLoading}
          >
            Get quote
          </Button>
        )}
      </section>

      {/* Step 2 */}
      {(phase === "quoting" || Boolean(quote)) && (
        <section className="panel mt-4 p-5">
          <StepHeader n={2} title="Quote breakdown" />
          {phase === "quoting" ? (
            <div className="mt-6 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-surface-2" />
              ))}
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Polling {market?.strategies ?? 0} maker strategies…
              </p>
            </div>
          ) : (
            <>
              {/* stacked bar */}
              <div className="mt-4">
                <div className="flex h-4 w-full overflow-hidden rounded-md border border-border bg-surface-2">
                  {filled.map((f, i) => (
                    <div
                      key={f.maker}
                      title={`${shortAddress(f.maker)} · ${fmtNum((Number(f.fillIn) / Number(quote?.quotedReceiptIn ?? 1)) * 100, 1)}%`}
                      style={{
                        width: `${(Number(f.fillIn) / Math.max(Number(quote?.quotedReceiptIn ?? 0), 1e-18)) * 100}%`,
                      }}
                      className={cn(
                        "h-full border-r border-background transition-all duration-500",
                        i % 3 === 0 ? "bg-primary" : i % 3 === 1 ? "bg-chart-2" : "bg-chart-4",
                      )}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {filled.length} of {makerRows.length} makers contributed
                  </span>
                  <span className="num">
                    {quote?.quotedReceiptIn} {market?.symbol} filled
                  </span>
                </div>
              </div>

              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-5 flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
              >
                <span>Contributing makers</span>
                <ChevronDown
                  className={cn("size-4 transition-transform", expanded && "rotate-180")}
                />
              </button>

              {expanded && (
                <ul className="mt-3 space-y-2">
                  {makerRows.map((f) => {
                    const skipped = f.status !== "filled";
                    const isFlipped = flipped === f.maker;
                    return (
                      <li key={f.maker}>
                        <button
                          onClick={() => skipped && setFlipped(isFlipped ? null : f.maker)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md border border-border px-3 py-3 text-left text-sm",
                            skipped
                              ? "bg-surface-2/50 opacity-80 hover:opacity-100"
                              : "bg-surface-2",
                          )}
                        >
                          <span className="num w-36 shrink-0 truncate text-foreground">
                            {shortAddress(f.maker)}
                          </span>
                          <span className="num hidden w-28 shrink-0 text-muted-foreground sm:block">
                            {skipped ? "--" : `${f.fillIn} ${market?.symbol}`}
                          </span>
                          <span className="num w-28 shrink-0 text-primary">
                            {skipped ? "--" : formatToken(f.amountOut, quoteSymbol, 4)}
                          </span>
                          <span className="ml-auto shrink-0">
                            <StatusBadge status={f.status} />
                          </span>
                        </button>
                        {isFlipped && skipped && (
                          <p className="flip-in mt-1 flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                            <ShieldAlert className="size-4 shrink-0 text-warning" />
                            This maker was skipped by the solver because the current strategy could
                            not contribute deliverable output for this route.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {/* Step 3 */}
      {quote && (
        <section className="panel mt-4 p-5">
          <StepHeader n={3} title="Solver decision" />
          <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            <div className="bg-surface-2 px-4 py-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Fill status
              </p>
              <p className="num mt-1.5 text-2xl font-semibold text-primary">{quote.fillStatus}</p>
            </div>
            <div className="bg-surface-2 px-4 py-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Indexed strategies
              </p>
              <p className="num mt-1.5 text-2xl font-semibold text-muted-foreground">
                {quote.indexedStrategies}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-success">
            Full route available. Execution will still re-check maker wallet balance, allowance,
            Aqua virtual balances, and oracle guards onchain.
          </p>
        </section>
      )}

      {/* Step 4 */}
      {quote && (
        <section className="panel mt-4 p-5">
          <StepHeader n={4} title="Approve & confirm" />
          {phase === "error" && (
            <div className="mt-4 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Transaction reverted</p>
                <p className="num mt-1 break-all text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          )}
          <div className="mt-4 space-y-2 text-sm">
            <Row l="Gross proceeds" v={formatToken(gross, quoteSymbol)} />
            <Row l="Protocol fee (0.10%)" v={`- ${formatToken(fee, quoteSymbol)}`} />
            <Row l="Net received" v={formatToken(net, quoteSymbol)} strong />
            {approvalHash ? <Row l="Approval tx" v={shortAddress(approvalHash)} /> : null}
            {routeHash ? <Row l="Route tx" v={shortAddress(routeHash)} /> : null}
          </div>

          {!address ? (
            <Button className="mt-5 w-full font-semibold" onClick={connect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect wallet to continue"}
            </Button>
          ) : (
            <Button
              className="mt-5 w-full font-semibold"
              onClick={execute}
              disabled={phase === "approving" || phase === "confirming"}
            >
              {phase === "approving" && <Loader2 className="size-4 animate-spin" />}
              {phase === "confirming" && <Loader2 className="size-4 animate-spin" />}
              {phase === "approving"
                ? "Approving spend…"
                : phase === "confirming"
                  ? "Confirming route…"
                  : phase === "error"
                    ? "Retry"
                    : "Approve & sell"}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="num grid size-6 place-items-center rounded-md border border-border bg-surface-2 text-xs text-primary">
        {n}
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-widest">{title}</h2>
    </div>
  );
}

function Row({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{l}</span>
      <span
        className={cn("num", strong ? "text-base font-semibold text-primary" : "text-foreground")}
      >
        {v}
      </span>
    </div>
  );
}
