import { env } from "@/config/env";

import type { SolverQuote, SolverQuoteError } from "./types";

type QuoteRequest = {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  inputDecimals: number;
};

type QuoteErrorBody = {
  error?: string;
  message?: string;
  quote?: SolverQuote;
};

export async function requestRouteQuote(request: QuoteRequest): Promise<SolverQuote> {
  const response = await fetch(`${env.solverApiUrl}/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as SolverQuote | QuoteErrorBody;

  if (!response.ok) {
    const errorBody = body as QuoteErrorBody;
    const error = new Error(
      errorBody.message ?? `Solver quote failed with status ${response.status}`,
    ) as SolverQuoteError;
    error.code = errorBody.error;
    error.quote = errorBody.quote;
    throw error;
  }

  return body as SolverQuote;
}
