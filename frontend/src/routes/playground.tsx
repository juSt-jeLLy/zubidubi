import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  DatabaseZap,
  FlaskConical,
  Loader2,
  Play,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExecutionTimeline } from "@/components/zubi/playground/ExecutionTimeline";
import { PlaygroundMarketState } from "@/components/zubi/playground/PlaygroundMarketState";
import { ProtocolProofPanel } from "@/components/zubi/playground/ProtocolProofPanel";
import { RouteSplitPreview } from "@/components/zubi/playground/RouteSplitPreview";
import { ScenarioPicker } from "@/components/zubi/playground/ScenarioPicker";
import { cn } from "@/lib/utils";
import { useMarkets } from "@/services/markets/useMarkets";
import { buildPlaygroundModel } from "@/services/playground/mappers";
import { usePlaygroundQuote } from "@/services/playground/usePlaygroundQuote";
import type { SolverQuoteError } from "@/services/solver/types";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Playground - ZubiDubi" },
      {
        name: "description",
        content:
          "Live ZubiDubi demo cockpit for Graph-indexed markets, solver quotes, SwapVM route splits and Aqua settlement proofs.",
      },
      { property: "og:title", content: "Playground - ZubiDubi" },
      {
        property: "og:description",
        content:
          "A deployable verification console showing live term-liquidity routes, proof panels and protocol invariants.",
      },
    ],
  }),
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const marketQuery = useMarkets();
  const quoteMutation = usePlaygroundQuote();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [lastQuote, setLastQuote] = useState(quoteMutation.data ?? null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const model = useMemo(
    () => buildPlaygroundModel(marketQuery.data ?? null, selectedScenarioId, lastQuote),
    [lastQuote, marketQuery.data, selectedScenarioId],
  );

  useEffect(() => {
    if (selectedScenarioId || model.scenarios.length === 0) return;
    setSelectedScenarioId(model.scenarios[0]!.id);
  }, [model.scenarios, selectedScenarioId]);

  useEffect(() => {
    setLastQuote(null);
    setQuoteError(null);
    quoteMutation.reset();
  }, [selectedScenarioId]);

  const runQuote = () => {
    if (!model.selectedScenario) return;
    setQuoteError(null);
    quoteMutation.mutate(model.selectedScenario, {
      onSuccess: (quote) => {
        setLastQuote(quote);
        setQuoteError(null);
      },
      onError: (error) => {
        const solverError = error as SolverQuoteError;
        setLastQuote(solverError.quote ?? null);
        setQuoteError(solverError.message);
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div>
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <FlaskConical className="size-3.5" />
            Deployable demo cockpit
          </Badge>
          <h1 className="max-w-4xl text-3xl font-semibold sm:text-4xl">
            Prove the whole term-liquidity route from one page.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            The playground pulls live markets from The Graph, asks the solver API for route previews,
            shows the SwapVM maker split, and explains the Aqua settlement guarantees without running
            local shell commands in production.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Button asChild>
            <Link to="/sell" search={model.selectedMarket ? { asset: model.selectedMarket.id } : {}}>
              Execute selected route <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/make">
              Publish maker strategy <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          icon={<DatabaseZap className="size-4" />}
          label="Graph markets"
          value={String(model.board?.markets.length ?? 0)}
          loading={marketQuery.isLoading}
          tone={marketQuery.isError ? "warn" : "good"}
        />
        <HeroStat
          icon={<WalletCards className="size-4" />}
          label="Recent events"
          value={String(model.board?.activity.length ?? 0)}
          loading={marketQuery.isLoading}
        />
        <HeroStat
          icon={<ShieldCheck className="size-4" />}
          label="Executable route"
          value={lastQuote ? (lastQuote.canExecute ? "yes" : "blocked") : "--"}
          tone={lastQuote ? (lastQuote.canExecute ? "good" : "warn") : "default"}
        />
        <HeroStat
          icon={<Play className="size-4" />}
          label="Quote source"
          value={lastQuote ? lastQuote.source : "solver API"}
          compact
        />
      </div>

      {marketQuery.isError ? (
        <div className="mt-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">
          The Graph market board failed to load. Check `VITE_SUBGRAPH_URL` or the deployed
          Subgraph Studio endpoint.
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <ScenarioPicker
          scenarios={model.scenarios}
          selectedId={model.selectedScenario?.id ?? null}
          onSelect={setSelectedScenarioId}
        />
        <div className="space-y-6">
          <PlaygroundMarketState
            scenario={model.selectedScenario}
            metrics={model.metrics}
            indexingError={model.board?.hasIndexingErrors ?? false}
          />
          <RouteSplitPreview
            scenario={model.selectedScenario}
            quote={lastQuote}
            rows={model.routeRows}
            isQuoting={quoteMutation.isPending}
            error={quoteError}
            onQuote={runQuote}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <ExecutionTimeline steps={model.protocolSteps} />
        <section className="panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest">What Judges Should Notice</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ProofNote
              title="Not a pool"
              text="Makers keep funds in their wallets. Aqua pulls funds only for an atomic fill."
            />
            <ProofNote
              title="Not a flat swap"
              text="SwapVM prices time, oracle backing, inventory, liquidity depth, risk tier and max discount."
            />
            <ProofNote
              title="Not trusting the index"
              text="The Graph discovers candidates; contracts enforce live deliverability before settlement."
            />
            <ProofNote
              title="Revenue path"
              text="The route executor pays the DAO/protocol fee as part of the fill."
            />
          </div>
        </section>
      </div>

      <div className="mt-8">
        <ProtocolProofPanel activity={model.activity} />
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
  loading,
  compact,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
  compact?: boolean;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <div className="panel px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "grid size-8 place-items-center rounded-md border",
            tone === "good" && "border-success/40 bg-success/10 text-success",
            tone === "warn" && "border-warning/40 bg-warning/10 text-warning",
            tone === "default" && "border-border bg-surface-2 text-primary",
          )}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
        </span>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className={cn("num mt-4 truncate font-semibold", compact ? "text-sm" : "text-2xl")}>
        {loading ? "--" : value}
      </p>
    </div>
  );
}

function ProofNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-4 py-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
