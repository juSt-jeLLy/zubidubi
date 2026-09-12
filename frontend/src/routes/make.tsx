import { useWallets } from "@privy-io/react-auth";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, Rocket, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";

import { LiveMakerStrategies } from "@/components/maker/LiveMakerStrategies";
import { MakeSection } from "@/components/maker/MakeSection";
import { SliderRow } from "@/components/maker/SliderRow";
import { CurveEditor } from "@/components/zubi/make/CurveEditor";
import {
  initialMakeFormState,
  makeFormReducer,
  type MakeFormState,
} from "@/components/zubi/make/makeFormReducer";
import type { MakerCurveParams } from "@/components/zubi/make/curveMath";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMakerStrategyBuild } from "@/services/maker/useMakerStrategyBuild";
import { shipMakerStrategy } from "@/services/maker/ship";
import { explorerTxUrl } from "@/services/portfolio/demoClaims";
import { usePortfolio } from "@/services/portfolio/usePortfolio";
import { useMarkets } from "@/services/markets/useMarkets";
import type { LiveMarket } from "@/services/markets/types";
import { useWallet } from "@/services/wallet/context";

export const Route = createFileRoute("/make")({
  head: () => ({
    meta: [
      { title: "Make — Ship a maker strategy on ZubiDubi" },
      {
        name: "description",
        content:
          "Configure pricing curves, risk tiers, maturity windows, exposure limits and oracle safety, then ship a maker strategy on-chain.",
      },
      { property: "og:title", content: "Ship a maker strategy — ZubiDubi" },
      {
        property: "og:description",
        content: "Live discount-curve preview that reacts as you tune pricing, convexity and risk.",
      },
    ],
  }),
  component: MakePage,
});

type ShipPhase = "idle" | "building" | "approving" | "shipping" | "budgeting" | "shipped" | "error";
type NumberFormKey = Extract<
  keyof MakeFormState,
  | "baseDiscountPct"
  | "annualRatePct"
  | "maxDiscountPct"
  | "convexity"
  | "minDays"
  | "maxDays"
  | "inventorySlopePct"
  | "liquiditySlopePct"
  | "maxExposure"
  | "quoteLiquidity"
  | "deviationPct"
  | "budgetMaxExposure"
  | "budgetMaxSpend"
  | "budgetPressurePenaltyPct"
>;

function MakePage() {
  const { address, connect, connecting } = useWallet();
  const { wallets } = useWallets();
  const marketsQuery = useMarkets();
  const portfolioQuery = usePortfolio(address);
  const buildStrategy = useMakerStrategyBuild();

  const markets = marketsQuery.data?.markets ?? [];
  const [marketId, setMarketId] = useState("");
  const [form, dispatch] = useReducer(makeFormReducer, initialMakeFormState);
  const [phase, setPhase] = useState<ShipPhase>("idle");
  const [error, setError] = useState("");
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | null>(null);
  const [shipHash, setShipHash] = useState<`0x${string}` | null>(null);
  const [orderHash, setOrderHash] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId && markets[0]) setMarketId(markets[0].id);
  }, [marketId, markets]);

  const market = useMemo(
    () => markets.find((item) => item.id === marketId) ?? markets[0] ?? null,
    [marketId, markets],
  );

  useEffect(() => {
    if (!market) return;
    dispatch({
      type: "reset-market",
      quoteLiquidity: defaultQuoteLiquidity(market),
      maxExposure: defaultExposure(market),
      maxDays: market.daysToMaturity
        ? Math.max(45, Math.min(540, market.daysToMaturity + 30))
        : undefined,
    });
  }, [market?.id]);

  const setNumber =
    (key: NumberFormKey) =>
    (value: number) =>
      dispatch({ type: "set-number", key, value });

  const setNumericField =
    (key: NumberFormKey) =>
    (value: string) =>
      dispatch({ type: "set-number", key, value: Number(value || 0) });

  const setCurveValue = (key: keyof MakerCurveParams, value: number) => {
    if (key === "curveFamily") {
      dispatch({ type: "set-curve-family", value: value === 1 ? 1 : 0 });
      return;
    }
    dispatch({ type: "set-number", key: key as NumberFormKey, value });
  };

  async function ship() {
    try {
      setError("");
      setApprovalHash(null);
      setShipHash(null);
      setOrderHash(null);

      if (!address) {
        connect();
        return;
      }
      if (!market) throw new Error("No live market is available from the subgraph yet.");

      const wallet = wallets.find((item) => item.address.toLowerCase() === address.toLowerCase());
      if (!wallet) throw new Error("Connected wallet was not found by Privy.");

      setPhase("building");
      const strategy = await buildStrategy.mutateAsync({
        maker: address,
        tokenIn: market.tokenIn,
        tokenOut: market.tokenOut,
        quoteLiquidity: String(form.quoteLiquidity),
        maxExposure: String(form.maxExposure),
        maxNotionalOut: form.maxNotionalOut || undefined,
        baseDiscountPct: form.baseDiscountPct,
        annualRatePct: form.annualRatePct,
        maxDiscountPct: form.maxDiscountPct,
        inventorySlopePct: form.inventorySlopePct,
        liquiditySlopePct: form.liquiditySlopePct,
        riskTier: form.riskTier,
        minDays: form.minDays,
        maxDays: form.maxDays,
        curveFamily: form.curveFamily,
        convexity: form.convexity,
        deviationPct: form.deviationPct,
        budgetLabel: form.budgetLabel,
        budgetMaxExposure: String(form.budgetMaxExposure),
        budgetMaxSpend: String(form.budgetMaxSpend),
        budgetPressurePenaltyPct: form.budgetPressurePenaltyPct,
      });
      setOrderHash(strategy.orderHash);

      const result = await shipMakerStrategy(wallet, strategy, {
        onApprovalSubmitted: (hash) => {
          setPhase("approving");
          setApprovalHash(hash);
        },
        onShipSubmitted: (hash) => {
          setPhase("shipping");
          setShipHash(hash);
        },
        onBudgetSubmitted: () => {
          setPhase("budgeting");
        },
      });
      setOrderHash(result.orderHash);
      setPhase("shipped");
      void portfolioQuery.refetch();
      void marketsQuery.refetch();
    } catch (cause) {
      setPhase("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const busy = ["building", "approving", "shipping", "budgeting"].includes(phase);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Make</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ship an Aqua maker strategy that quotes early exits from live receipt markets.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        <div className="space-y-3">
          <MakeSection title="Market">
            <div>
              <Label className="text-xs text-muted-foreground">Receipt / payout</Label>
              <Select value={market?.id ?? ""} onValueChange={setMarketId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue
                    placeholder={marketsQuery.isLoading ? "Loading live markets…" : "Select market"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.symbol} / {item.quoteSymbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {market && (
              <div className="rounded-md border border-border bg-surface-2 p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Live maker book</span>
                  <span className="num">{market.liquidityLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Maturity</span>
                  <span className="num">
                    {market.daysToMaturity == null ? "unknown" : `${market.daysToMaturity}d`}
                  </span>
                </div>
              </div>
            )}
          </MakeSection>

          <MakeSection title="Pricing">
            <SliderRow label="Base discount" value={form.baseDiscountPct} set={setNumber("baseDiscountPct")} min={0} max={3} step={0.05} suffix="%" />
            <SliderRow label="Annual rate" value={form.annualRatePct} set={setNumber("annualRatePct")} min={0} max={25} step={0.5} suffix="%" />
            <SliderRow label="Max discount" value={form.maxDiscountPct} set={setNumber("maxDiscountPct")} min={0.5} max={12} step={0.25} suffix="%" />
          </MakeSection>

          <MakeSection title="Curve shape">
            <div className="grid grid-cols-2 gap-2">
              {(["linear", "convex"] as const).map((shape) => (
                <button
                  key={shape}
                  onClick={() => dispatch({ type: "set-curve-family", value: shape === "convex" ? 1 : 0 })}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm capitalize transition-colors",
                    (shape === "convex") === (form.curveFamily === 1)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-2",
                  )}
                >
                  {shape}
                </button>
              ))}
            </div>
            {form.curveFamily === 1 && (
              <SliderRow label="Convexity" value={form.convexity} set={setNumber("convexity")} min={1} max={4} step={0.1} suffix="k" />
            )}
          </MakeSection>

          <MakeSection title="Inventory risk">
            <div className="grid grid-cols-3 gap-2">
              {["conservative", "balanced", "aggressive"].map((nextTier) => (
                <button
                  key={nextTier}
                  onClick={() => dispatch({ type: "set-risk", value: nextTier as MakeFormState["riskTier"] })}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs capitalize transition-colors",
                    form.riskTier === nextTier
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-2",
                  )}
                >
                  {nextTier}
                </button>
              ))}
            </div>
            <SliderRow label="Inventory slope" value={form.inventorySlopePct} set={setNumber("inventorySlopePct")} min={0} max={6} step={0.1} suffix="%" />
            <SliderRow label="Liquidity slope" value={form.liquiditySlopePct} set={setNumber("liquiditySlopePct")} min={0} max={4} step={0.1} suffix="%" />
          </MakeSection>

          <MakeSection title="Maturity window" defaultOpen={false}>
            <SliderRow label="Min days" value={form.minDays} set={setNumber("minDays")} min={1} max={90} step={1} suffix="d" />
            <SliderRow label="Max days" value={form.maxDays} set={setNumber("maxDays")} min={30} max={540} step={5} suffix="d" />
          </MakeSection>

          <MakeSection title="Capital limits" defaultOpen={false}>
            <Field label={`Quote liquidity${market ? ` (${market.quoteSymbol})` : ""}`} value={String(form.quoteLiquidity)} set={setNumericField("quoteLiquidity")} />
            <Field label={`Max receipt exposure${market ? ` (${market.symbol})` : ""}`} value={String(form.maxExposure)} set={setNumericField("maxExposure")} />
            <Field label="Max notional out (optional)" value={form.maxNotionalOut} set={(value) => dispatch({ type: "set-text", key: "maxNotionalOut", value })} placeholder="Unbounded" />
          </MakeSection>

          <MakeSection title="Portfolio risk budget" defaultOpen={false}>
            <div className="rounded-md border border-border bg-surface-2 p-3 text-xs">
              <div className="font-semibold">Shared maker term-risk book</div>
              <p className="mt-2 text-muted-foreground">
                Strategies with the same budget label consume one global receipt exposure and quote-token spend limit. Sibling strategies lose capacity after any one fills.
              </p>
            </div>
            <Field label="Budget label" value={form.budgetLabel} set={(value) => dispatch({ type: "set-text", key: "budgetLabel", value })} />
            <Field label={`Global receipt exposure${market ? ` (${market.symbol})` : ""}`} value={String(form.budgetMaxExposure)} set={setNumericField("budgetMaxExposure")} />
            <Field label={`Global quote spend${market ? ` (${market.quoteSymbol})` : ""}`} value={String(form.budgetMaxSpend)} set={setNumericField("budgetMaxSpend")} />
            <SliderRow label="Budget pressure spread" value={form.budgetPressurePenaltyPct} set={setNumber("budgetPressurePenaltyPct")} min={0} max={5} step={0.1} suffix="%" />
          </MakeSection>

          <MakeSection title="Oracle safety" defaultOpen={false}>
            <div className="rounded-md border border-border bg-surface-2 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-4 text-primary" />
                Real Sepolia ratio oracle
              </div>
              <p className="mt-2 text-muted-foreground">
                The backend selects the deployed Chainlink-backed ratio adapter for the chosen
                receipt and payout pair.
              </p>
            </div>
            <SliderRow label="Secondary deviation tolerance" value={form.deviationPct} set={setNumber("deviationPct")} min={0} max={3} step={0.1} suffix="%" />
          </MakeSection>
        </div>

        <div className="space-y-6">
          <div className="panel p-5">
            <CurveEditor params={form} onChange={setCurveValue} />

            <ShipStatus phase={phase} approvalHash={approvalHash} shipHash={shipHash} orderHash={orderHash} error={error} />

            {!address ? (
              <Button className="mt-5 w-full font-semibold" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet to ship"}
              </Button>
            ) : (
              <Button className="mt-5 w-full font-semibold" onClick={ship} disabled={busy || !market}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                {shipButtonLabel(phase)}
              </Button>
            )}
          </div>

          {address ? (
            <LiveMakerStrategies
              strategies={portfolioQuery.data?.strategies ?? []}
              loading={portfolioQuery.isLoading}
            />
          ) : (
            <div className="panel px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Connect your wallet to see your indexed maker strategies and exposure.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  set,
  placeholder,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(event) => set(event.target.value)}
        placeholder={placeholder}
        className="num mt-1.5"
      />
    </div>
  );
}

function ShipStatus({
  phase,
  approvalHash,
  shipHash,
  orderHash,
  error,
}: {
  phase: ShipPhase;
  approvalHash: `0x${string}` | null;
  shipHash: `0x${string}` | null;
  orderHash: string | null;
  error: string;
}) {
  if (phase === "idle") return null;
  if (phase === "error") {
    return (
      <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (phase === "shipped") {
    return (
      <div className="flip-in mt-5 rounded-md border border-success/40 bg-success/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <Check className="size-5 text-success" />
          <div>
            <p className="text-sm font-semibold text-success">Strategy shipped</p>
            {orderHash && <p className="num text-xs text-muted-foreground">order {shortHash(orderHash)}</p>}
          </div>
        </div>
        {shipHash && (
          <a className="mt-3 block text-xs text-primary" href={explorerTxUrl(shipHash)} target="_blank" rel="noreferrer">
            View ship transaction
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-md border border-border bg-surface-2 px-4 py-3 text-xs text-muted-foreground">
      <p className="font-semibold text-foreground">{shipButtonLabel(phase)}</p>
      {approvalHash && <p className="num mt-1">approval {shortHash(approvalHash)}</p>}
      {shipHash && <p className="num mt-1">ship {shortHash(shipHash)}</p>}
      {orderHash && <p className="num mt-1">order {shortHash(orderHash)}</p>}
    </div>
  );
}

function shipButtonLabel(phase: ShipPhase) {
  if (phase === "building") return "Building strategy…";
  if (phase === "approving") return "Approving quote liquidity…";
  if (phase === "shipping") return "Shipping strategy…";
  if (phase === "budgeting") return "Registering shared risk budget…";
  if (phase === "shipped") return "Ship another strategy";
  return "Approve & ship strategy";
}

function defaultQuoteLiquidity(market: LiveMarket) {
  if (market.quoteSymbol.toUpperCase() === "WETH") return 0.01;
  return 25;
}

function defaultExposure(market: LiveMarket) {
  const symbol = market.symbol.toUpperCase();
  if (symbol.includes("USD")) return 100;
  if (symbol.includes("LINK")) return 25;
  return 0.03;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}
