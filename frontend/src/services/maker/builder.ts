import { env } from "@/config/env";

import type { BuiltMakerStrategy, MakerStrategyBuildRequest } from "./types";

export async function requestMakerStrategyBuild(
  request: MakerStrategyBuildRequest,
): Promise<BuiltMakerStrategy> {
  const response = await fetch(`${env.solverApiUrl}/strategies/build`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as BuiltMakerStrategy | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in body && body.error ? body.error : `Strategy build failed with status ${response.status}`,
    );
  }

  return body as BuiltMakerStrategy;
}
