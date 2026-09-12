import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { formatUnits, parseAbi } from "viem";

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
import { QuoteBenchmarkPanel } from "@/components/zubi/QuoteBenchmarkPanel";
import { cn } from "@/lib/utils";
import { useWallet } from "@/services/wallet/context";
import { fmtNum } from "@/lib/zubi-data";
import { useMarkets } from "@/services/markets/useMarkets";
import { buildQuoteBenchmark } from "@/services/solver/benchmarks";
import { requestRouteQuote } from "@/services/solver/client";
import { executeRouteQuote } from "@/services/solver/execute";
import type { BudgetPressureMeta, SolverQuote, SolverQuoteError } from "@/services/solver/types";
import { getClaimPublicClient } from "@/services/portfolio/issueClaim";

const searchSchema = z.object({ asset: z.string().optional() });
const ERC20_BALANCE_ABI = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

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
          "Transparent per-maker fill breakdown with live route previews.",
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
  budgetId?: string;
  budgetRemainingIn?: string;
  budgetRemainingOut?: string;
  budgetPressure?: BudgetPressureMeta | null;
  reason?: string;
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

function BudgetPressureBadge({ pressure }: { pressure?: BudgetPressureMeta | null }) {
  if (!pressure) return null;
  const utilizationPct = pressure.utilizationBps / 100;
  const activePressure = pressure.activePressureBps;
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit gap-1 border-primary/30 bg-primary/10 text-[11px] text-primary",
        activePressure > 0 && "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      Budget {fmtNum(utilizationPct, 1)}% used · +{activePressure} bps pressure
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
  const walletBalanceQuery = useQuery({
    queryKey: ["sell-receipt-balance", address?.toLowerCase() ?? "disconnected", market?.tokenIn],
    enabled: Boolean(address && market?.tokenIn),
    queryFn: async () => {
      const raw = await getClaimPublicClient().readContract({
        address: market!.tokenIn as `0x${string}`,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      return {
        raw,
        formatted: formatUnits(raw, market!.receiptDecimals),
      };
    },
    refetchInterval: 15_000,
    staleTime: 8_000,
  });
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
        budgetId: fill.budgetId,
        budgetRemainingIn: fill.budgetRemainingIn,
        budgetRemainingOut: fill.budgetRemainingOut,
        budgetPressure: fill.budgetPressure,
      })) ?? [];
    const skipped =
      quote?.skippedMakers.map((maker) => ({
        maker: maker.maker,
        orderHash: maker.orderHash,
        fillIn: "0",
        amountOut: "0",
        status: "skipped" as const,
        budgetId: maker.budgetId,
        budgetRemainingIn: maker.budgetRemainingIn,
        budgetRemainingOut: maker.budgetRemainingOut,
        budgetPressure: maker.budgetPressure,
        reason: maker.reason,
      })) ?? [];
    return [...fills, ...skipped];
  }, [quote]);
  const filled = makerRows.filter((row) => row.status === "filled");
  const gross = filled.reduce((sum, fill) => sum + Number(fill.amountOut), 0);
  const net = quote ? Number(quote.quotedNetOut) : 0;
  const fee = Math.max(0, gross - net);
  const benchmark = useMemo(() => buildQuoteBenchmark(quote, market), [quote, market]);
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

  const resetQuoteState = () => {
    setPhase("idle");
    quoteMutation.reset();
    setLiquidityErrorQuote(null);
    setApprovalHash(null);
    setRouteHash(null);
  };

  const applyMaxAmount = () => {
    const maxAmount = liquidityErrorQuote?.quotedReceiptIn ?? walletBalanceQuery.data?.formatted;
    if (!maxAmount) return;
    setAmount(maxAmount);
    resetQuoteState();
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
    <div className="min-h-[calc(100vh-4rem)] border-b border-border">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-14">
        <div className="mx-auto w-full max-w-[620px]">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Live solver
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold">Sell a maturing claim</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Swap PT-style receipts into liquid maker funds. The solver checks live maker balances,
            allowances and Aqua state before execution.
          </p>

          <section className="panel mt-7 overflow-hidden p-4 sm:p-5">
            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  You sell
                </span>
                <span className="num text-xs text-muted-foreground">
                  {market?.daysToMaturity ?? "--"}d to maturity
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px] sm:items-end">
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                    resetQuoteState();
                  }}
                  placeholder="0.00"
                  className="num h-16 border-0 bg-transparent px-0 text-3xl shadow-none focus-visible:ring-0"
                />
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
                  <SelectTrigger className="h-12 bg-surface">
                    <SelectValue placeholder={marketsLoading ? "Loading markets" : "Select market"} />
                  </SelectTrigger>
                  <SelectContent>
                    {markets.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.symbol} / {m.quoteSymbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{market?.underlying ?? "Underlying"} backed</span>
                <span>·</span>
                <span>{market?.liquidityLabel ?? "No indexed liquidity"}</span>
                {address ? (
                  <>
                    <span>·</span>
                    <span>
                      wallet{" "}
                      <span className="num">
                        {walletBalanceQuery.isLoading
                          ? "loading"
                          : walletBalanceQuery.data
                            ? `${formatToken(walletBalanceQuery.data.formatted, market?.symbol ?? "", 6)}`
                            : "--"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={applyMaxAmount}
                      disabled={!walletBalanceQuery.data && !liquidityErrorQuote}
                      className="num rounded border border-border px-1.5 text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:text-muted-foreground"
                    >
                      Max
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="relative flex justify-center py-2">
              <span className="grid size-10 place-items-center rounded-full border border-border bg-background text-primary shadow-[0_0_0_6px_var(--color-surface)]">
                <ArrowDown className="size-5" />
              </span>
            </div>

            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  You receive
                </span>
                <span className="text-xs text-muted-foreground">after DAO fee</span>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="num truncate text-3xl font-semibold">
                    <AnimatedNumber
                      value={net}
                      format={(n) =>
                        new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(n)
                      }
                    />
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {quote ? `${quote.quotedReceiptIn} ${market?.symbol} filled` : "Quote pending"}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-surface px-4 py-2 text-right">
                  <p className="text-xs text-muted-foreground">Receive</p>
                  <p className="text-xl font-semibold">{quoteSymbol || "--"}</p>
                </div>
              </div>
            </div>

            {marketsError ? (
              <AlertMessage tone="error">
                Live markets did not load from the subgraph. The sell quote cannot be generated.
              </AlertMessage>
            ) : null}

            {liquidityErrorQuote ? (
              <AlertMessage tone="warning" title="Not enough maker liquidity">
                Requested {liquidityErrorQuote.requestedReceiptIn} {market?.symbol}, but the live
                route can only fill {liquidityErrorQuote.quotedReceiptIn}. Shortfall:{" "}
                {liquidityErrorQuote.shortfallReceiptIn}.
              </AlertMessage>
            ) : null}

            {phase === "error" ? (
              <AlertMessage tone="error" title="Transaction reverted">
                <span className="num break-all">{error}</span>
              </AlertMessage>
            ) : null}

            <Button
              className="mt-5 h-12 w-full font-semibold"
              onClick={quote ? (!address ? connect : execute) : runQuote}
              disabled={
                amt <= 0 ||
                !market ||
                marketsLoading ||
                phase === "quoting" ||
                phase === "approving" ||
                phase === "confirming" ||
                connecting
              }
            >
              {phase === "quoting" || phase === "approving" || phase === "confirming" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {!quote
                ? phase === "quoting"
                  ? "Finding best route…"
                  : "Get live quote"
                : !address
                  ? connecting
                    ? "Connecting…"
                    : "Connect wallet to sell"
                  : phase === "approving"
                    ? "Approving spend…"
                    : phase === "confirming"
                      ? "Confirming route…"
                      : phase === "error"
                        ? "Retry transaction"
                        : "Approve & sell"}
            </Button>
          </section>

          {(phase === "quoting" || Boolean(quote)) && (
            <section className="panel mt-4 overflow-hidden">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-widest">
                    Route preview
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {phase === "quoting"
                      ? `Polling ${market?.strategies ?? 0} maker strategies…`
                      : `${filled.length} makers fill this route`}
                  </p>
                </div>
                <ChevronDown
                  className={cn("size-4 transition-transform", expanded && "rotate-180")}
                />
              </button>

              {phase === "quoting" ? (
                <div className="border-t border-border p-5">
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-12 animate-pulse rounded-md bg-surface-2" />
                    ))}
                  </div>
                </div>
              ) : expanded ? (
                <div className="border-t border-border p-5">
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

                  <ul className="mt-4 space-y-2">
                    {makerRows.map((f) => {
                      const skipped = f.status !== "filled";
                      const isFlipped = flipped === f.maker;
                      return (
                        <li key={f.maker}>
                          <button
                            onClick={() => skipped && setFlipped(isFlipped ? null : f.maker)}
                            className={cn(
                              "grid w-full gap-3 rounded-md border border-border px-3 py-3 text-left text-sm lg:grid-cols-[130px_1fr_150px_120px] lg:items-center",
                              skipped
                                ? "bg-surface-2/50 opacity-80 hover:opacity-100"
                                : "bg-surface-2",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="num truncate text-foreground">{shortAddress(f.maker)}</p>
                              <p className="num mt-0.5 truncate text-xs text-muted-foreground">
                                {shortAddress(f.orderHash)}
                              </p>
                            </div>
                            <div className="min-w-0 space-y-1">
                              <p className="num text-muted-foreground">
                                {skipped ? "--" : `${f.fillIn} ${market?.symbol}`}
                              </p>
                              <BudgetPressureBadge pressure={f.budgetPressure} />
                              {f.budgetPressure ? (
                                <p className="text-xs text-muted-foreground">
                                  {fmtNum(Number(f.budgetRemainingIn ?? 0), 4)} input left /{" "}
                                  {fmtNum(Number(f.budgetRemainingOut ?? 0), 4)} output left
                                </p>
                              ) : null}
                            </div>
                            <span className="num text-primary">
                              {skipped ? "--" : formatToken(f.amountOut, quoteSymbol, 4)}
                            </span>
                            <span className="shrink-0 justify-self-start lg:justify-self-end">
                              <StatusBadge status={f.status} />
                            </span>
                          </button>
                          {isFlipped && skipped && (
                            <p className="flip-in mt-1 flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                              <ShieldAlert className="size-4 shrink-0 text-warning" />
                              {f.reason ??
                                "This maker was skipped because it could not contribute deliverable output for this route."}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:pt-28">
          <QuoteBenchmarkPanel benchmark={benchmark} />

          <section className="panel p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest">Quote health</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Row l="Fill status" v={quote?.fillStatus ?? "No quote"} strong={quote?.fillStatus === "FULL"} />
              <Row l="Indexed strategies" v={quote ? String(quote.indexedStrategies) : String(market?.strategies ?? 0)} />
              <Row l="Gross proceeds" v={formatToken(gross, quoteSymbol)} />
              <Row l="DAO fee (0.10%)" v={`- ${formatToken(fee, quoteSymbol)}`} />
              <Row l="Net received" v={formatToken(net, quoteSymbol)} strong />
            </div>
            {quote ? (
              <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-muted-foreground">
                Execution re-checks maker wallet balance, allowance, Aqua virtual balances and
                oracle guards onchain.
              </p>
            ) : (
              <p className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                Get a quote to see maker split, DAO fee and route status.
              </p>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest">Settlement path</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <PathRow n="1" text="Approve the maturing claim token." active={Boolean(quote)} />
              <PathRow n="2" text="Route executor fills across maker strategies." active={phase === "confirming" || phase === "success"} />
              <PathRow n="3" text="Aqua pulls maker liquidity atomically." active={phase === "success"} />
            </div>
            {(approvalHash || routeHash) && (
              <div className="mt-4 space-y-2 text-xs">
                {approvalHash ? (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${approvalHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="num flex items-center gap-1 text-primary hover:underline"
                  >
                    Approval {shortAddress(approvalHash)} <ExternalLink className="size-3" />
                  </a>
                ) : null}
                {routeHash ? (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${routeHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="num flex items-center gap-1 text-primary hover:underline"
                  >
                    Route {shortAddress(routeHash)} <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            )}
          </section>
        </aside>
      </div>
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

function AlertMessage({
  tone,
  title,
  children,
}: {
  tone: "warning" | "error";
  title?: string;
  children: ReactNode;
}) {
  const isWarning = tone === "warning";
  return (
    <div
      className={cn(
        "mt-4 flex gap-2 rounded-md border px-3 py-3 text-sm",
        isWarning
          ? "border-warning/40 bg-warning/10"
          : "border-destructive/40 bg-destructive/10",
      )}
    >
      {isWarning ? (
        <ShieldAlert className="size-4 shrink-0 text-warning" />
      ) : (
        <AlertTriangle className="size-4 shrink-0 text-destructive" />
      )}
      <div>
        {title ? (
          <p className={cn("font-medium", isWarning ? "text-warning" : "text-destructive")}>
            {title}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function PathRow({ n, text, active }: { n: string; text: string; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "num grid size-6 shrink-0 place-items-center rounded-md border text-xs",
          active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-surface-2",
        )}
      >
        {n}
      </span>
      <span className={active ? "text-foreground" : ""}>{text}</span>
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
