import { formatUnits } from "viem";

import type { GraphReceiptAsset, LiveMarket } from "@/services/markets/types";

export type DemoClaimAsset = {
  symbol: string;
  underlying: string;
  depositToken: string;
  underlyingAddress: `0x${string}`;
  underlyingDecimals: number;
  maturity: string;
  maturityUnix: number;
  tenor: string;
  receiptAddress: `0x${string}`;
  receiptDecimals: number;
  backingRatio: string;
  availableRoutes: string[];
  suggestedDeposit: string;
  suggestedAmount: string;
  productUse: string;
};

export type UnderlyingTokenInfo = { symbol: string; decimals: number };

export const SEPOLIA_ETHERSCAN = "https://sepolia.etherscan.io";

export const explorerTxUrl = (hash: string) => `${SEPOLIA_ETHERSCAN}/tx/${hash}`;

export const explorerAddressUrl = (address: string) => `${SEPOLIA_ETHERSCAN}/address/${address}`;

/** Formats a maturity unix timestamp in UTC so SSR and every timezone agree. */
export function formatMaturityUtc(maturityUnix: number): string {
  if (!maturityUnix) return "TBD";
  return new Date(maturityUnix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Infer the backing symbol from a receipt symbol when the graph has no token info. */
function inferUnderlyingSymbol(receiptSymbol: string): string {
  const upper = receiptSymbol.toUpperCase();
  if (upper.includes("ETH")) return "WETH";
  if (upper.includes("LINK")) return "LINK";
  if (upper.includes("USD")) return "USDC";
  return "TOKEN";
}

/**
 * UX copy per backing token. This is *not* per-receipt asset data — it only
 * attaches suggested demo sizes and explanatory copy to whatever the graph indexes.
 */
const UNDERLYING_ENRICHMENT: Record<
  string,
  {
    depositToken: string;
    suggestedDeposit: string;
    suggestedAmount: string;
    use: string;
  }
> = {
  WETH: {
    depositToken: "Sepolia WETH",
    suggestedDeposit: "0.003 WETH",
    suggestedAmount: "0.003",
    use: "Fastest demo path: issue a WETH-backed claim, then sell it early into USDC or WETH maker liquidity.",
  },
  USDC: {
    depositToken: "Sepolia USDC",
    suggestedDeposit: "25 USDC",
    suggestedAmount: "25",
    use: "Stable claim route for explaining par-backed issuance without ETH price movement.",
  },
  LINK: {
    depositToken: "Sepolia LINK",
    suggestedDeposit: "1 LINK",
    suggestedAmount: "1",
    use: "Non-ETH claim for proving the curve is asset-agnostic and oracle-backed.",
  },
};

/**
 * Builds the demo claim list from the live subgraph. Receipt addresses,
 * symbols, maturities, backing ratios, decimals, and available sell routes come
 * from indexed data; only suggested deposit sizes and explanatory copy are static UX copy.
 */
export function buildDemoClaims(
  receiptAssets: GraphReceiptAsset[],
  underlyingTokens: Record<string, UnderlyingTokenInfo>,
  markets: Pick<LiveMarket, "tokenIn" | "quoteSymbol">[] = [],
): DemoClaimAsset[] {
  const nowMs = Date.now();
  const routesByReceipt = new Map<string, string[]>();

  for (const market of markets) {
    const key = market.tokenIn.toLowerCase();
    const current = routesByReceipt.get(key) ?? [];
    if (!current.includes(market.quoteSymbol)) current.push(market.quoteSymbol);
    routesByReceipt.set(key, current.sort());
  }

  return receiptAssets.map((receipt) => {
    const receiptAddress = (receipt.token?.id || receipt.id).toLowerCase() as `0x${string}`;
    const underlyingAddress = (receipt.underlying ?? "").toLowerCase() as `0x${string}`;
    const underlyingInfo = underlyingTokens[underlyingAddress] ?? null;
    const underlying = underlyingInfo?.symbol ?? inferUnderlyingSymbol(receipt.token.symbol);
    const underlyingDecimals = underlyingInfo?.decimals ?? 18;
    const enrichment = UNDERLYING_ENRICHMENT[underlying.toUpperCase()] ?? null;

    const maturityUnix = Number(receipt.maturity) || 0;
    const daysLeft = Math.max(0, Math.ceil((maturityUnix * 1000 - nowMs) / (24 * 60 * 60 * 1000)));

    const assetsPerReceipt = BigInt(receipt.assetsPerReceipt || "0");
    const backingPerReceipt = assetsPerReceipt > 0n ? Number(formatUnits(assetsPerReceipt, underlyingDecimals)) : 0;
    const backingRatio =
      backingPerReceipt > 0
        ? `1 receipt = ${Number.isInteger(backingPerReceipt) ? backingPerReceipt : backingPerReceipt.toFixed(6)} ${underlying} at maturity`
        : "Redeems at par after maturity";
    const availableRoutes = routesByReceipt.get(receiptAddress) ?? [];

    return {
      symbol: receipt.token.symbol,
      underlying,
      depositToken: enrichment?.depositToken ?? `Sepolia ${underlying}`,
      underlyingAddress,
      underlyingDecimals,
      maturity: formatMaturityUtc(maturityUnix),
      maturityUnix,
      tenor: daysLeft === 0 ? "matured" : `${daysLeft} days`,
      receiptAddress,
      receiptDecimals: receipt.token.decimals,
      backingRatio,
      availableRoutes,
      suggestedDeposit: enrichment?.suggestedDeposit ?? `1 ${underlying}`,
      suggestedAmount: enrichment?.suggestedAmount ?? "1",
      productUse:
        enrichment?.use ??
        "Maturing claim backed 1:1 on Sepolia; sell it early or redeem at maturity.",
    };
  });
}

export const demoClaimSummary = {
  title: "Acquire demo claims",
  body: "Deposit real Sepolia WETH, USDC, or LINK into a PT-style receipt contract, receive a transferable maturing claim, then sell it early through ZubiDubi or redeem it 1:1 after maturity.",
  production:
    "In production this same slot is a principal-token receipt, withdrawal receipt, vault claim, bridge receipt, or any transferable delayed-redemption asset.",
};
