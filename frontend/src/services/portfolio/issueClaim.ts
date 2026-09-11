import type { ConnectedWallet } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
  type PublicClient,
} from "viem";

import { DEFAULT_CHAIN } from "@/config/chains";
import type { DemoClaimAsset } from "./demoClaims";
import { explorerTxUrl } from "./demoClaims";

const ERC20_ABI = parseAbi([
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const RECEIPT_ABI = parseAbi([
  "function issue(uint256 assets,address receiver) returns (uint256 receiptAmount)",
  "function previewIssue(uint256 assets) view returns (uint256 receiptAmount)",
]);

let sharedPublicClient: PublicClient | null = null;

const RPC_TIMEOUT_MS = 12_000;

function asNetworkError(context: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(`${context}: ${detail}`);
}

function withTimeout<T>(promise: Promise<T>, ms = RPC_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("request timed out")), ms)),
  ]);
}

export function getClaimPublicClient(): PublicClient {
  if (!sharedPublicClient) {
    sharedPublicClient = createPublicClient({ chain: DEFAULT_CHAIN, transport: http() });
  }
  return sharedPublicClient;
}

export type ClaimBalance = { raw: bigint; formatted: string };

/** Reads the connected account's onchain balance of the underlying backing token. */
export async function readUnderlyingBalance(
  asset: DemoClaimAsset,
  owner: `0x${string}`,
): Promise<ClaimBalance> {
  try {
    const raw = (await withTimeout(
      getClaimPublicClient().readContract({
        address: asset.underlyingAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [owner],
      }),
    )) as bigint;
    return { raw, formatted: formatUnits(raw, asset.underlyingDecimals) };
  } catch (cause) {
    throw asNetworkError(`Could not read your ${asset.underlying} balance on Sepolia`, cause);
  }
}

/**
 * Preview how many receipts a deposit produces, using the onchain previewIssue view.
 * Returns a formatted receipt amount string (receipts are always 18-decimals).
 */
export async function previewClaimReceipts(asset: DemoClaimAsset, amount: string): Promise<string> {
  try {
    const rawAssets = parseUnits(amount, asset.underlyingDecimals);
    const receipts = (await withTimeout(
      getClaimPublicClient().readContract({
        address: asset.receiptAddress,
        abi: RECEIPT_ABI,
        functionName: "previewIssue",
        args: [rawAssets],
      }),
    )) as bigint;
    return formatUnits(receipts, asset.receiptDecimals);
  } catch (cause) {
    throw asNetworkError(`Could not preview ${asset.symbol} receipts on Sepolia`, cause);
  }
}

export type IssueClaimCallbacks = {
  onApprovalSubmitted?: (hash: `0x${string}`) => void;
  onIssueSubmitted?: (hash: `0x${string}`) => void;
};

export type IssueClaimResult = {
  approvalHash: `0x${string}`;
  issueHash: `0x${string}`;
  receiptAmount: string;
  txUrl: string;
};

/**
 * Issues a demo claim from the connected wallet:
 *   1. approve(underlying -> receipt contract)
 *   2. issue(assets, receiver) on the receipt contract
 * The minted claim lands directly in `receiver` (the connected wallet).
 */
export async function issueDemoClaim(
  wallet: ConnectedWallet,
  asset: DemoClaimAsset,
  amount: string,
  receiver: `0x${string}`,
  callbacks?: IssueClaimCallbacks,
): Promise<IssueClaimResult> {
  await wallet.switchChain(DEFAULT_CHAIN.id);
  const provider = await wallet.getEthereumProvider();
  const account = wallet.address as `0x${string}`;
  const walletClient = createWalletClient({
    account,
    chain: DEFAULT_CHAIN,
    transport: custom(provider),
  });
  const publicClient = getClaimPublicClient();
  const rawAssets = parseUnits(amount, asset.underlyingDecimals);

  const approvalHash = await walletClient.writeContract({
    address: asset.underlyingAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [asset.receiptAddress, rawAssets],
  });
  callbacks?.onApprovalSubmitted?.(approvalHash);
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });

  const issueHash = await walletClient.writeContract({
    address: asset.receiptAddress,
    abi: RECEIPT_ABI,
    functionName: "issue",
    args: [rawAssets, receiver],
  });
  callbacks?.onIssueSubmitted?.(issueHash);
  await publicClient.waitForTransactionReceipt({ hash: issueHash });

  const receipts = (await publicClient.readContract({
    address: asset.receiptAddress,
    abi: RECEIPT_ABI,
    functionName: "previewIssue",
    args: [rawAssets],
  })) as bigint;

  return {
    approvalHash,
    issueHash,
    receiptAmount: formatUnits(receipts, asset.receiptDecimals),
    txUrl: explorerTxUrl(issueHash),
  };
}
