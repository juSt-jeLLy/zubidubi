import type { ConnectedWallet } from "@privy-io/react-auth";
import {
  createWalletClient,
  custom,
  formatUnits,
  parseAbi,
  type PublicClient,
} from "viem";

import { DEFAULT_CHAIN } from "@/config/chains";
import type { GraphReceiptAsset, LiveMarket } from "@/services/markets/types";
import {
  explorerTxUrl,
  formatMaturityUtc,
  type UnderlyingTokenInfo,
} from "@/services/portfolio/demoClaims";
import {
  getClaimPublicClient,
} from "@/services/portfolio/issueClaim";
import type { ReceiptPosition } from "./types";

const RECEIPT_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function previewRedeem(uint256 receiptAmount) view returns (uint256 assets)",
  "function redeem(uint256 receiptAmount,address receiver) returns (uint256 assets)",
]);

const DAY_SECONDS = 24 * 60 * 60;

function inferUnderlyingSymbol(receiptSymbol: string) {
  const upper = receiptSymbol.toUpperCase();
  if (upper.includes("ETH")) return "WETH";
  if (upper.includes("LINK")) return "LINK";
  if (upper.includes("USD")) return "USDC";
  return "TOKEN";
}

function inferUnderlyingDecimals(symbol: string) {
  return symbol.toUpperCase() === "USDC" ? 6 : 18;
}

function amountLabel(raw: bigint, decimals: number, maxFractionDigits = 6) {
  const numeric = Number(formatUnits(raw, decimals));
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

function routesByReceipt(markets: Pick<LiveMarket, "tokenIn" | "quoteSymbol">[]) {
  const routes = new Map<string, string[]>();

  for (const market of markets) {
    const key = market.tokenIn.toLowerCase();
    const existing = routes.get(key) ?? [];
    if (!existing.includes(market.quoteSymbol)) existing.push(market.quoteSymbol);
    routes.set(key, existing.sort());
  }

  return routes;
}

export async function readReceiptPositions({
  owner,
  receiptAssets,
  underlyingTokens,
  markets,
  client = getClaimPublicClient(),
}: {
  owner: `0x${string}`;
  receiptAssets: GraphReceiptAsset[];
  underlyingTokens: Record<string, UnderlyingTokenInfo>;
  markets: Pick<LiveMarket, "tokenIn" | "quoteSymbol">[];
  client?: PublicClient;
}): Promise<ReceiptPosition[]> {
  const now = Math.floor(Date.now() / 1000);
  const routes = routesByReceipt(markets);

  const positions = await Promise.all(
    receiptAssets.map(async (receipt) => {
      const receiptAddress = (receipt.token.id || receipt.id).toLowerCase() as `0x${string}`;
      const underlyingAddress = receipt.underlying.toLowerCase() as `0x${string}`;
      const underlyingInfo = underlyingTokens[underlyingAddress];
      const underlying = underlyingInfo?.symbol ?? inferUnderlyingSymbol(receipt.token.symbol);
      const underlyingDecimals =
        underlyingInfo?.decimals ?? inferUnderlyingDecimals(underlying);
      const maturityUnix = Number(receipt.maturity) || 0;
      const daysToMaturity = Math.max(0, Math.ceil((maturityUnix - now) / DAY_SECONDS));
      const isMatured = maturityUnix > 0 && maturityUnix <= now;

      const rawBalance = (await client.readContract({
        address: receiptAddress,
        abi: RECEIPT_ABI,
        functionName: "balanceOf",
        args: [owner],
      })) as bigint;

      let rawRedeemable = 0n;
      if (rawBalance > 0n) {
        rawRedeemable = (await client.readContract({
          address: receiptAddress,
          abi: RECEIPT_ABI,
          functionName: "previewRedeem",
          args: [rawBalance],
        })) as bigint;
      }

      const numericBalance = Number(formatUnits(rawBalance, receipt.token.decimals));

      return {
        id: receipt.id,
        symbol: receipt.token.symbol,
        receiptAddress,
        receiptDecimals: receipt.token.decimals,
        underlying,
        underlyingAddress,
        underlyingDecimals,
        maturityUnix,
        maturityLabel: formatMaturityUtc(maturityUnix),
        daysToMaturity,
        isMatured,
        rawBalance,
        formattedBalance: amountLabel(rawBalance, receipt.token.decimals),
        numericBalance,
        rawRedeemable,
        formattedRedeemable: amountLabel(rawRedeemable, underlyingDecimals),
        claimable: rawBalance > 0n && isMatured,
        sellRoutes: routes.get(receiptAddress) ?? [],
      } satisfies ReceiptPosition;
    }),
  );

  return positions.sort((a, b) => {
    if (a.rawBalance > 0n && b.rawBalance === 0n) return -1;
    if (a.rawBalance === 0n && b.rawBalance > 0n) return 1;
    return a.maturityUnix - b.maturityUnix || a.symbol.localeCompare(b.symbol);
  });
}

export type RedeemReceiptResult = {
  txHash: `0x${string}`;
  txUrl: string;
  amount: string;
  underlying: string;
};

export async function redeemReceiptPosition(
  wallet: ConnectedWallet,
  position: ReceiptPosition,
  receiver: `0x${string}`,
): Promise<RedeemReceiptResult> {
  if (!position.claimable) {
    throw new Error(`${position.symbol} is not mature or has no wallet balance to claim.`);
  }

  await wallet.switchChain(DEFAULT_CHAIN.id);
  const provider = await wallet.getEthereumProvider();
  const account = wallet.address as `0x${string}`;
  const walletClient = createWalletClient({
    account,
    chain: DEFAULT_CHAIN,
    transport: custom(provider),
  });
  const publicClient = getClaimPublicClient();

  const txHash = await walletClient.writeContract({
    address: position.receiptAddress,
    abi: RECEIPT_ABI,
    functionName: "redeem",
    args: [position.rawBalance, receiver],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    txUrl: explorerTxUrl(txHash),
    amount: position.formattedRedeemable,
    underlying: position.underlying,
  };
}
