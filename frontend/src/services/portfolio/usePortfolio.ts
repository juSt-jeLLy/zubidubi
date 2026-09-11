import { useQuery } from "@tanstack/react-query";

import { graphRequest } from "@/services/graph/client";
import { mapMarketBoard } from "@/services/markets/mappers";
import { MARKET_BOARD_QUERY } from "@/services/markets/queries";
import type { MarketBoardResponse } from "@/services/markets/types";
import { readReceiptPositions } from "./receiptContracts";
import { mapLivePortfolio } from "./mappers";
import { PORTFOLIO_QUERY } from "./queries";
import type { LocalClaimHistory, PortfolioGraphResponse } from "./types";

export function usePortfolio(address: string | null, claimHistory: LocalClaimHistory[] = []) {
  return useQuery({
    queryKey: ["portfolio", address?.toLowerCase() ?? "disconnected", claimHistory.length],
    enabled: Boolean(address),
    queryFn: async () => {
      const account = address!.toLowerCase();
      const [graph, marketBoard] = await Promise.all([
        graphRequest<PortfolioGraphResponse>(PORTFOLIO_QUERY, { account }),
        graphRequest<MarketBoardResponse>(MARKET_BOARD_QUERY).then(mapMarketBoard),
      ]);
      const holdings = await readReceiptPositions({
        owner: account as `0x${string}`,
        receiptAssets: graph.receiptAssets,
        underlyingTokens: marketBoard.underlyingTokens,
        markets: marketBoard.markets,
      });

      return mapLivePortfolio({
        graph,
        holdings,
        markets: marketBoard.markets,
        claimHistory,
      });
    },
    refetchInterval: 15_000,
    staleTime: 8_000,
  });
}
