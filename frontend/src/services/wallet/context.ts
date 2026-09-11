import { createContext, useContext } from "react";

export type WalletState = {
  address: string | null;
  network: string;
  connecting: boolean;
  authenticated: boolean;
  ready: boolean;
  walletCount: number;
  connect: () => void;
  disconnect: () => Promise<void>;
};

export const WalletCtx = createContext<WalletState | null>(null);

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export const truncate = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
