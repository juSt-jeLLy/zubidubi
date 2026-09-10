import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type WalletState = {
  address: string | null;
  network: string;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
};

const KEY = "zubidubi.wallet";
const WalletCtx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved) setAddress(saved);
  }, []);

  const connect = useCallback(() => {
    setConnecting(true);
    window.setTimeout(() => {
      const addr = "0x7Ac4b2E19d5F0aB3c81e6D4409fF2a17bC90e3D1";
      window.localStorage.setItem(KEY, addr);
      setAddress(addr);
      setConnecting(false);
    }, 700);
  }, []);

  const disconnect = useCallback(() => {
    window.localStorage.removeItem(KEY);
    setAddress(null);
  }, []);

  const value = useMemo(
    () => ({ address, network: "Sepolia", connecting, connect, disconnect }),
    [address, connecting, connect, disconnect],
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
