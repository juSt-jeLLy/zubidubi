import type { PrivyClientConfig } from "@privy-io/react-auth";

import { DEFAULT_CHAIN, SUPPORTED_CHAINS } from "@/config/chains";

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: "dark",
    accentColor: "#f5cb42",
    landingHeader: "Connect to ZubiDubi",
    loginMessage: "Use Sepolia to quote and fill maturing DeFi exit liquidity.",
    showWalletLoginFirst: true,
    walletChainType: "ethereum-only",
    walletList: ["detected_wallets", "metamask", "coinbase_wallet", "wallet_connect"],
  },
  loginMethods: ["wallet"],
  defaultChain: DEFAULT_CHAIN,
  supportedChains: SUPPORTED_CHAINS,
};
