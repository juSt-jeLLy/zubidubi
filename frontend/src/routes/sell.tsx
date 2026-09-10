import { createFileRoute } from "@tanstack/react-router";
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
import { useMemo, useState } from "react";
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
import { useWallet } from "@/lib/wallet";
import { MARKETS, fmtNum, fmtUsd, quoteFor, type MakerFill } from "@/lib/zubi-data";

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
        content: "Transparent per-maker fill breakdown, benchmarked against the Pendle market rate.",
      },
    ],
  }),
  component: SellPage,
});

type Phase = "idle" | "quoting" | "quoted" | "approving" | "confirming" | "success" | "error";

function StatusBadge({ status }: { status: MakerFill["status"] }) {
  if (status === "filled")
    return (
      <Badge className="gap-1 border-success/40 bg-success/10 text-success" variant="outline">
        <Check className="size-3" /> Filled
      </Badge>
    );
  const label =
    status === "skipped-insolvent"
      ? "Skipped — insolvent"
      : status === "skipped-exposure"
        ? "Skipped — exposure cap"
        : "Skipped — oracle";
  return (
    <Badge className="gap-1 border-border-strong bg-surface-2 text-muted-foreground" variant="outline">
      <X className="size-3" /> {label}
    </Badge>
  );
}

function SellPage() {
  const { asset } = Route.useSearch();
  const { address, connect, connecting } = useWallet();

  const [symbol, setSymbol] = useState(asset ?? MARKETS[0]!.symbol);
  const [amount, setAmount] = useState("50000");
  const [phase, setPhase] = useState<Phase>("idle");
  const [expanded, setExpanded] = useState(true);
  const [flipped, setFlipped] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const market = MARKETS.find((m) => m.symbol === symbol) ?? MARKETS[0]!;
  const amt = Number(amount) || 0;
  const fills = useMemo(() => quoteFor(market, amt), [market, amt]);
  const filled = fills.filter((f) => f.status === "filled");
  const totalFilled = filled.reduce((s, f) => s + f.amount, 0);
  const effDiscount =
    totalFilled > 0 ? filled.reduce((s, f) => s + f.discount * f.amount, 0) / totalFilled : 0;
  const gross = totalFilled * (1 - effDiscount / 100);
  const fee = gross * 0.001;
  const net = gross - fee;

  const runQuote = () => {
    setError(null);
    setPhase("quoting");
    window.setTimeout(() => setPhase("quoted"), 900);
  };

  const execute = () => {
    setPhase("approving");
    window.setTimeout(() => setPhase("confirming"), 900);
    window.setTimeout(() => {
      if (amt > 900_000) {
        setError("execution reverted: ExposureCapExceeded(0x6d3e…b8c2, 2000000)");
        setPhase("error");
      } else {
        setPhase("success");
      }
    }, 2200);
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
            {fmtNum(totalFilled, 0)} {market.symbol} sold across {filled.length} makers.
          </p>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border text-left sm:grid-cols-3">
            {[
              { l: "Net received", v: fmtUsd(net, 2) },
              { l: "Effective discount", v: `${fmtNum(effDiscount)}%` },
              { l: "Protocol fee", v: fmtUsd(fee, 2) },
            ].map((x) => (
              <div key={x.l} className="bg-surface px-4 py-4">
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{x.l}</dt>
                <dd className="num mt-1.5 text-lg">{x.v}</dd>
              </div>
            ))}
          </dl>

          <a
            href="#"
            className="num mt-6 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            0x9c1f4ba7…e0d2 <ExternalLink className="size-3" />
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
            value={symbol}
            onValueChange={(v) => {
              setSymbol(v);
              setPhase("idle");
            }}
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MARKETS.map((m) => (
                <SelectItem key={m.symbol} value={m.symbol}>
                  {m.symbol}
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
            }}
            placeholder="0.00"
            className="num h-12 text-lg"
          />
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
          <ArrowDown className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">You receive (est.)</span>
          <span className="num ml-auto text-lg font-semibold">
            <AnimatedNumber value={net} format={(n) => fmtUsd(n, 2)} />
          </span>
        </div>

        {phase === "idle" && (
          <Button className="mt-4 w-full font-semibold" onClick={runQuote} disabled={amt <= 0}>
            Get quote
          </Button>
        )}
      </section>

      {/* Step 2 */}
      {(phase === "quoting" || phase !== "idle") && (
        <section className="panel mt-4 p-5">
          <StepHeader n={2} title="Quote breakdown" />
          {phase === "quoting" ? (
            <div className="mt-6 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-surface-2" />
              ))}
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Polling {market.strategies} maker strategies…
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
                      title={`${f.ens ?? f.maker} · ${fmtNum((f.amount / totalFilled) * 100, 1)}%`}
                      style={{ width: `${(f.amount / totalFilled) * 100}%` }}
                      className={cn(
                        "h-full border-r border-background transition-all duration-500",
                        i % 3 === 0 ? "bg-primary" : i % 3 === 1 ? "bg-chart-2" : "bg-chart-4",
                      )}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {filled.length} of {fills.length} makers contributed
                  </span>
                  <span className="num">{fmtNum(totalFilled, 0)} {market.symbol} filled</span>
                </div>
              </div>

              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-5 flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
              >
                <span>Contributing makers</span>
                <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
              </button>

              {expanded && (
                <ul className="mt-3 space-y-2">
                  {fills.map((f) => {
                    const skipped = f.status !== "filled";
                    const isFlipped = flipped === f.maker;
                    return (
                      <li key={f.maker}>
                        <button
                          onClick={() => skipped && setFlipped(isFlipped ? null : f.maker)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md border border-border px-3 py-3 text-left text-sm",
                            skipped ? "bg-surface-2/50 opacity-80 hover:opacity-100" : "bg-surface-2",
                          )}
                        >
                          <span className="num w-36 shrink-0 truncate text-foreground">
                            {f.ens ?? f.maker}
                          </span>
                          <span className="num hidden w-28 shrink-0 text-muted-foreground sm:block">
                            {skipped ? "—" : `${fmtNum(f.amount, 0)}`}
                          </span>
                          <span className="num w-16 shrink-0 text-primary">{fmtNum(f.discount)}%</span>
                          <span className="ml-auto shrink-0">
                            <StatusBadge status={f.status} />
                          </span>
                        </button>
                        {isFlipped && f.reason && (
                          <p className="flip-in mt-1 flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                            <ShieldAlert className="size-4 shrink-0 text-warning" />
                            {f.reason}
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
      {phase !== "idle" && phase !== "quoting" && market.kind === "real" && (
        <section className="panel mt-4 p-5">
          <StepHeader n={3} title="Benchmark" />
          <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            <div className="bg-surface-2 px-4 py-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Our quote</p>
              <p className="num mt-1.5 text-2xl font-semibold text-primary">{fmtNum(effDiscount)}%</p>
            </div>
            <div className="bg-surface-2 px-4 py-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Pendle market rate</p>
              <p className="num mt-1.5 text-2xl font-semibold text-muted-foreground">
                {fmtNum(market.benchmark ?? 0)}%
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-success">
            You save {fmtNum(Math.max(0, (market.benchmark ?? 0) - effDiscount))}% vs. the market rate.
          </p>
        </section>
      )}

      {/* Step 4 */}
      {phase !== "idle" && phase !== "quoting" && (
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
            <Row l="Gross proceeds" v={fmtUsd(gross, 2)} />
            <Row l="Protocol fee (0.10%)" v={`− ${fmtUsd(fee, 2)}`} />
            <Row l="Net received" v={fmtUsd(net, 2)} strong />
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
      <span className={cn("num", strong ? "text-base font-semibold text-primary" : "text-foreground")}>{v}</span>
    </div>
  );
}
