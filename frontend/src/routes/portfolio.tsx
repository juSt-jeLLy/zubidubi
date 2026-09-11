import { createFileRoute } from "@tanstack/react-router";
import { useWallets } from "@privy-io/react-auth";
import { AlertCircle, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoldingsPanel } from "@/components/portfolio/HoldingsPanel";
import { PortfolioStats } from "@/components/portfolio/PortfolioStats";
import { RedemptionsPanel } from "@/components/portfolio/RedemptionsPanel";
import { RouteHistoryPanel } from "@/components/portfolio/RouteHistoryPanel";
import { StrategiesPanel } from "@/components/portfolio/StrategiesPanel";
import { AcquireDemoClaims } from "@/components/zubi/AcquireDemoClaims";
import { SectionBoundary } from "@/components/zubi/SectionBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/services/wallet/context";
import { usePortfolio } from "@/services/portfolio/usePortfolio";
import type { LocalClaimHistory } from "@/services/portfolio/types";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio - ZubiDubi" },
      {
        name: "description",
        content:
          "Track maturing assets, maker exposure, redemption readiness and route history across ZubiDubi markets.",
      },
      { property: "og:title", content: "Portfolio - ZubiDubi" },
      {
        property: "og:description",
        content: "A product surface for holders and makers using Aqua-native term liquidity.",
      },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { address, connect, connecting } = useWallet();
  const { wallets } = useWallets();
  const [claimHistory, setClaimHistory] = useState<LocalClaimHistory[]>([]);
  const portfolio = usePortfolio(address, claimHistory);
  const connectedWallet = useMemo(
    () =>
      address
        ? (wallets.find(
            (wallet) => wallet.address.toLowerCase() === address.toLowerCase(),
          ) ?? null)
        : null,
    [address, wallets],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <WalletCards className="size-3.5" />
            Portfolio
          </Badge>
          <h1 className="text-3xl font-semibold">Term liquidity cockpit</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            One place to watch maturing assets, routeable exits, maker exposure and redemption
            readiness.
          </p>
        </div>
        {!address ? (
          <Button
            onClick={connect}
            disabled={connecting}
            className="w-full font-semibold sm:w-auto"
          >
            <WalletCards className="size-4" />
            {connecting ? "Connecting..." : "Connect wallet"}
          </Button>
        ) : (
          <div className="panel flex items-center gap-3 px-4 py-3">
            <span className="size-2 rounded-full bg-success live-dot" />
            <div>
              <p className="text-xs text-muted-foreground">Connected account</p>
              <p className="num text-sm">
                {address.slice(0, 8)}...{address.slice(-6)}
              </p>
            </div>
          </div>
        )}
      </div>

      {!address ? (
        <DisconnectedPortfolio onConnect={connect} connecting={connecting} />
      ) : portfolio.isLoading ? (
        <PortfolioLoading />
      ) : portfolio.isError ? (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {portfolio.error instanceof Error
              ? portfolio.error.message
              : "Could not load live portfolio data."}
          </AlertDescription>
        </Alert>
      ) : portfolio.data ? (
        <PortfolioStats portfolio={portfolio.data} />
      ) : null}

      <SectionBoundary label="acquire-demo-claims">
        <AcquireDemoClaims />
      </SectionBoundary>

      {portfolio.data ? (
        <Tabs defaultValue="holdings" className="mt-8">
          <TabsList className="h-auto flex-wrap justify-start rounded-md border border-border bg-surface p-1">
            <TabsTrigger value="holdings">Holdings</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
            <TabsTrigger value="history">Route History</TabsTrigger>
          </TabsList>

          <TabsContent value="holdings" className="mt-5">
            <HoldingsPanel holdings={portfolio.data.holdings} />
          </TabsContent>

          <TabsContent value="strategies" className="mt-5">
            <StrategiesPanel strategies={portfolio.data.strategies} />
          </TabsContent>

          <TabsContent value="redemptions" className="mt-5">
            <RedemptionsPanel
              positions={portfolio.data.redemptionQueue}
              wallet={connectedWallet}
              receiver={address as `0x${string}`}
              onClaimed={(claim) => setClaimHistory((claims) => [claim, ...claims])}
              onRefresh={() => void portfolio.refetch()}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-5">
            <RouteHistoryPanel history={portfolio.data.routeHistory} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

function DisconnectedPortfolio({
  onConnect,
  connecting,
}: {
  onConnect: () => void;
  connecting: boolean;
}) {
  return (
    <div className="panel mt-8 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Badge variant="outline" className="border-primary/40 text-primary">
          Live wallet required
        </Badge>
        <h2 className="mt-4 text-xl font-semibold">Connect to load portfolio state</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Holdings come from Sepolia receipt contracts; strategies, routes, fills and fee history
          come from the ZubiDubi subgraph.
        </p>
      </div>
      <Button onClick={onConnect} disabled={connecting} className="font-semibold">
        <WalletCards className="size-4" />
        {connecting ? "Connecting..." : "Connect wallet"}
      </Button>
    </div>
  );
}

function PortfolioLoading() {
  return (
    <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-surface px-5 py-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
