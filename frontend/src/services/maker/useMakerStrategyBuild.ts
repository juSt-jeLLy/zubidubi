import { useMutation } from "@tanstack/react-query";

import { requestMakerStrategyBuild } from "./builder";
import type { MakerStrategyBuildRequest } from "./types";

export function useMakerStrategyBuild() {
  return useMutation({
    mutationFn: (request: MakerStrategyBuildRequest) => requestMakerStrategyBuild(request),
  });
}
