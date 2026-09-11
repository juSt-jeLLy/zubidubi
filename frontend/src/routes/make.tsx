import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Loader2, Rocket } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
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
import { Slider } from "@/components/ui/slider";
import { StrategyList } from "@/components/zubi/StrategyList";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { MARKETS, curvePoints, fmtNum } from "@/lib/zubi-data";

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

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-widest"
      >
        {title}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-4 border-t border-border px-4 py-4">{children}</div>}
    </div>
  );
}

function MakePage() {
  const { address, connect, connecting } = useWallet();

  const [pair, setPair] = useState(MARKETS[0]!.symbol);
  const [base, setBase] = useState(0.4);
  const [annualRate, setAnnualRate] = useState(6);
  const [maxDiscount, setMaxDiscount] = useState(4);
  const [convex, setConvex] = useState(true);
  const [convexity, setConvexity] = useState(1.8);
  const [tier, setTier] = useState("balanced");
  const [minDays, setMinDays] = useState(7);
  const [maxDays, setMaxDays] = useState(240);
  const [cap, setCap] = useState("1500000");
  const [perTaker, setPerTaker] = useState("250000");
  const [primaryOracle, setPrimaryOracle] = useState("Chainlink");
  const [secondaryOracle, setSecondaryOracle] = useState("Redstone");
  const [deviation, setDeviation] = useState(0.5);
  const [phase, setPhase] = useState<"idle" | "shipping" | "shipped">("idle");

  const data = useMemo(
    () => curvePoints({ base, annualRate, maxDiscount, convex, convexity, maxDays }),
    [base, annualRate, maxDiscount, convex, convexity, maxDays],
  );

  const ship = () => {
    setPhase("shipping");
    window.setTimeout(() => setPhase("shipped"), 1800);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Make</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Quote early exits and earn the discount you price.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* Form */}
        <div className="space-y-3">
          <Section title="Pair selection">
            <div>
              <Label className="text-xs text-muted-foreground">Asset in</Label>
              <Select value={pair} onValueChange={setPair}>
                <SelectTrigger className="mt-1.5">
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
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Payout asset</Label>
              <Select defaultValue="USDC">
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USDC", "WETH"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section title="Pricing">
            <SliderRow label="Base discount" value={base} set={setBase} min={0} max={3} step={0.05} suffix="%" />
            <SliderRow label="Annual rate" value={annualRate} set={setAnnualRate} min={0} max={25} step={0.5} suffix="%" />
            <SliderRow label="Max discount" value={maxDiscount} set={setMaxDiscount} min={0.5} max={12} step={0.25} suffix="%" />
          </Section>

          <Section title="Curve shape">
            <div className="grid grid-cols-2 gap-2">
              {(["linear", "convex"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setConvex(c === "convex")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm capitalize transition-colors",
                    (c === "convex") === convex
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-2",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {convex && (
              <SliderRow label="Convexity" value={convexity} set={setConvexity} min={1} max={4} step={0.1} suffix="k" />
            )}
          </Section>

          <Section title="Risk tier" defaultOpen={false}>
            <div className="grid grid-cols-3 gap-2">
              {["conservative", "balanced", "aggressive"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs capitalize transition-colors",
                    tier === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-2",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Maturity window" defaultOpen={false}>
            <SliderRow label="Min days" value={minDays} set={setMinDays} min={1} max={90} step={1} suffix="d" />
            <SliderRow label="Max days" value={maxDays} set={setMaxDays} min={30} max={540} step={5} suffix="d" />
          </Section>

          <Section title="Exposure limits" defaultOpen={false}>
            <div>
              <Label className="text-xs text-muted-foreground">Total exposure cap</Label>
              <Input value={cap} onChange={(e) => setCap(e.target.value)} className="num mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Per-taker cap</Label>
              <Input value={perTaker} onChange={(e) => setPerTaker(e.target.value)} className="num mt-1.5" />
            </div>
          </Section>

          <Section title="Oracle safety" defaultOpen={false}>
            <div>
              <Label className="text-xs text-muted-foreground">Primary oracle</Label>
              <Select value={primaryOracle} onValueChange={setPrimaryOracle}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Chainlink", "Pyth", "Redstone"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Secondary oracle (optional)</Label>
              <Select value={secondaryOracle} onValueChange={setSecondaryOracle}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["None", "Chainlink", "Pyth", "Redstone"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SliderRow
              label="Deviation tolerance"
              value={deviation}
              set={setDeviation}
              min={0.1}
              max={3}
              step={0.1}
              suffix="%"
            />
          </Section>
        </div>

        {/* Curve preview + ship */}
        <div className="space-y-6">
          <div className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Discount curve</h2>
                <p className="text-xs text-muted-foreground">Quoted discount vs. time to maturity</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {convex ? `convex k=${fmtNum(convexity, 1)}` : "linear"}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-primary">
                  cap {fmtNum(maxDiscount)}%
                </Badge>
              </div>
            </div>

            <div className="mt-6 h-[340px] w-full sm:h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="days"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    unit="d"
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                    domain={[0, Math.ceil(maxDiscount * 1.15)]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => `${v} days to maturity`}
                    formatter={(v: number) => [`${fmtNum(v)}%`, "Discount"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="discount"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="var(--primary)"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
              {[
                { l: "At 30d", v: `${fmtNum(data.find((d) => d.days >= 30)?.discount ?? 0)}%` },
                { l: "At 180d", v: `${fmtNum(data.find((d) => d.days >= 180)?.discount ?? maxDiscount)}%` },
                { l: "Window", v: `${minDays}–${maxDays}d` },
                { l: "Tier", v: tier },
              ].map((x) => (
                <div key={x.l} className="bg-surface-2 px-3 py-3">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{x.l}</dt>
                  <dd className="num mt-1 text-sm capitalize">{x.v}</dd>
                </div>
              ))}
            </dl>

            {phase === "shipped" ? (
              <div className="flip-in mt-5 flex items-center gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-4">
                <Check className="size-5 text-success" />
                <div>
                  <p className="text-sm font-semibold text-success">Strategy shipped</p>
                  <p className="num text-xs text-muted-foreground">STR-2149 · tx 0x41ba…9f02</p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => setPhase("idle")}>
                  Ship another
                </Button>
              </div>
            ) : !address ? (
              <Button className="mt-5 w-full font-semibold" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet to ship"}
              </Button>
            ) : (
              <Button className="mt-5 w-full font-semibold" onClick={ship} disabled={phase === "shipping"}>
                {phase === "shipping" ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                {phase === "shipping" ? "Approving & shipping…" : "Approve & ship strategy"}
              </Button>
            )}
          </div>

          {address ? (
            <StrategyList />
          ) : (
            <div className="panel px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Connect your wallet to see your open strategies and exposure.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  set,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="num text-primary">
          {fmtNum(value, step < 1 ? 2 : 0)}
          {suffix === "k" ? "" : suffix}
        </span>
      </div>
      <Slider
        className="mt-2.5"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => set(v[0] ?? min)}
      />
    </div>
  );
}
