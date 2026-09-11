import { useMutation } from "@tanstack/react-query";

import { requestRouteQuote } from "@/services/solver/client";

import type { PlaygroundScenario } from "./types";

export function usePlaygroundQuote() {
  return useMutation({
    mutationFn: async (scenario: PlaygroundScenario) =>
      requestRouteQuote({
        tokenIn: scenario.market.tokenIn,
        tokenOut: scenario.market.tokenOut,
        amountIn: scenario.amount,
        inputDecimals: scenario.market.receiptDecimals,
      }),
  });
}
