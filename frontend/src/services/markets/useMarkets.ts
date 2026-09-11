import { useQuery } from "@tanstack/react-query";

import { graphRequest } from "@/services/graph/client";

import { mapMarketBoard } from "./mappers";
import { MARKET_BOARD_QUERY } from "./queries";
import type { MarketBoardResponse } from "./types";

export function useMarkets() {
  return useQuery({
    queryKey: ["market-board"],
    queryFn: async () =>
      mapMarketBoard(await graphRequest<MarketBoardResponse>(MARKET_BOARD_QUERY)),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
