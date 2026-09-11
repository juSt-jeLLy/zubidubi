import { Link } from "@tanstack/react-router";
import { Activity, BarChart3, FlaskConical, LogOut, Menu, PlusCircle, Wallet2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { truncate, useWallet } from "@/services/wallet/context";

const LINKS = [
  { to: "/markets", label: "Markets", icon: BarChart3 },
  { to: "/sell", label: "Sell", icon: Activity },
  { to: "/make", label: "Make", icon: PlusCircle },
  { to: "/portfolio", label: "Portfolio", icon: Wallet2 },
] as const;

function WalletButton({ full }: { full?: boolean }) {
  const { address, connect, disconnect, connecting, network, ready } = useWallet();

  if (!address) {
    return (
      <Button
        onClick={connect}
        disabled={connecting}
        className={cn("font-semibold", full && "w-full")}
      >
        <Wallet2 className="size-4" />
        {connecting ? "Connecting…" : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", full && "w-full")}>
      <span className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-muted-foreground">
        <span className={cn("size-1.5 rounded-full bg-success", ready && "live-dot")} />
        {network}
      </span>
      <span className="num rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs text-foreground">
        {truncate(address)}
      </span>
      <Button variant="ghost" size="icon" aria-label="Disconnect wallet" onClick={disconnect}>
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid size-9 place-items-center rounded-md border border-primary/30 bg-primary text-primary-foreground shadow-[0_0_24px_rgba(245,203,66,0.15)]">
            <span className="font-display text-sm font-bold">Z</span>
          </span>
          <span>
            <span className="block font-display text-base font-bold leading-none">
              Zubi<span className="text-primary">Dubi</span>
            </span>
            <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
              term liquidity
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              activeProps={{ className: "bg-surface-2 text-foreground" }}
            >
              <l.icon className="size-3.5" />
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 md:flex">
          <Link
            to="/playground"
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground/70 transition-colors hover:text-primary"
            activeProps={{ className: "text-primary" }}
          >
            <FlaskConical className="size-3.5" />
            Playground
          </Link>
          <WalletButton />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {open && (
        <div className="border-t border-border bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                activeProps={{ className: "bg-surface-2 text-foreground" }}
              >
                <span className="inline-flex items-center gap-2">
                  <l.icon className="size-4" />
                  {l.label}
                </span>
              </Link>
            ))}
            <Link
              to="/playground"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground/70"
            >
              <FlaskConical className="size-4" />
              Playground
            </Link>
          </nav>
          <div className="mt-4">
            <WalletButton full />
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>ZubiDubi · self-custodial exit liquidity for maturing DeFi assets.</p>
        <div className="flex items-center gap-5">
          <Link to="/playground" className="hover:text-primary">
            Playground
          </Link>
          <span className="num">v0.4.2-testnet</span>
        </div>
      </div>
    </footer>
  );
}
