import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

import { requireClientEnv } from "@/config/env";
import { privyConfig } from "@/services/privy/config";

export function PrivyAppProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider appId={requireClientEnv("privyAppId")} config={privyConfig}>
      {children}
    </PrivyProvider>
  );
}
