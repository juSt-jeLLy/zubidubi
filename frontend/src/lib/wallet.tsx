import { useConnectWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_CHAIN_LABEL } from "@/config/chains";
import { WalletCtx } from "@/services/wallet/context";

const LOCAL_DISCONNECT_KEY = "zubidubi.wallet.locallyDisconnected";

export function WalletProvider({ children }: { children: ReactNode }) {
  const { authenticated, ready, user } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { connectWallet } = useConnectWallet();
  const [openingWalletModal, setOpeningWalletModal] = useState(false);
  const [locallyDisconnected, setLocallyDisconnected] = useState(
    () =>
      typeof window !== "undefined" && window.localStorage.getItem(LOCAL_DISCONNECT_KEY) === "true",
  );

  const connect = useCallback(() => {
    setOpeningWalletModal(true);
    setLocallyDisconnected(false);
    window.localStorage.removeItem(LOCAL_DISCONNECT_KEY);
    connectWallet({ walletChainType: "ethereum-only" });
    window.setTimeout(() => setOpeningWalletModal(false), 700);
  }, [connectWallet]);

  const disconnect = useCallback(async () => {
    setLocallyDisconnected(true);
    window.localStorage.setItem(LOCAL_DISCONNECT_KEY, "true");
  }, []);

  const address = useMemo(() => {
    if (locallyDisconnected) return null;
    const connectedWallet = wallets.find((wallet) => wallet.address);
    return connectedWallet?.address ?? user?.wallet?.address ?? null;
  }, [locallyDisconnected, user?.wallet?.address, wallets]);

  const value = useMemo(
    () => ({
      address,
      authenticated,
      connect,
      connecting: openingWalletModal || !ready || !walletsReady,
      disconnect,
      network: DEFAULT_CHAIN_LABEL,
      ready: ready && walletsReady,
      walletCount: wallets.length,
    }),
    [
      address,
      authenticated,
      connect,
      disconnect,
      openingWalletModal,
      ready,
      wallets.length,
      walletsReady,
    ],
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}
