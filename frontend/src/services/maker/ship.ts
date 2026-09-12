import type { ConnectedWallet } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http, parseAbi } from "viem";

import { DEFAULT_CHAIN } from "@/config/chains";

import type { BuiltMakerStrategy, ShipMakerStrategyResult } from "./types";

const ERC20_ABI = parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]);

const AQUA_ABI = parseAbi([
  "function ship(address app,bytes strategy,address[] tokens,uint256[] amounts) returns (bytes32 strategyHash)",
]);

const ROUTE_EXECUTOR_ABI = parseAbi([
  "function setTermRiskBudget(bytes32 budgetId,uint128 maxReceiptExposure,uint128 maxQuoteSpend,uint32 pressurePenaltyBps)",
  "function assignOrderTermRiskBudget(bytes32 orderHash,bytes32 budgetId,address receiptToken,address quoteToken)",
]);

export type ShipMakerCallbacks = {
  onApprovalSubmitted?: (hash: `0x${string}`) => void;
  onShipSubmitted?: (hash: `0x${string}`) => void;
  onBudgetSubmitted?: (hash: `0x${string}`) => void;
};

export async function shipMakerStrategy(
  wallet: ConnectedWallet,
  strategy: BuiltMakerStrategy,
  callbacks?: ShipMakerCallbacks,
): Promise<ShipMakerStrategyResult> {
  await wallet.switchChain(DEFAULT_CHAIN.id);
  const provider = await wallet.getEthereumProvider();
  const account = wallet.address as `0x${string}`;
  const walletClient = createWalletClient({
    account,
    chain: DEFAULT_CHAIN,
    transport: custom(provider),
  });
  const publicClient = createPublicClient({
    chain: DEFAULT_CHAIN,
    transport: http(),
  });

  const quoteToken = strategy.tokens[1];
  const quoteAmount = BigInt(strategy.amounts[1] ?? "0");
  if (quoteAmount <= 0n) throw new Error("Quote liquidity must be greater than zero.");

  const approvalHash = await walletClient.writeContract({
    address: quoteToken,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [strategy.core.aqua as `0x${string}`, quoteAmount],
  });
  callbacks?.onApprovalSubmitted?.(approvalHash);
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });

  const shipHash = await walletClient.writeContract({
    address: strategy.core.aqua as `0x${string}`,
    abi: AQUA_ABI,
    functionName: "ship",
    args: [
      strategy.core.router as `0x${string}`,
      strategy.encodedOrder,
      strategy.tokens,
      strategy.amounts.map((amount) => BigInt(amount)),
    ],
  });
  callbacks?.onShipSubmitted?.(shipHash);
  await publicClient.waitForTransactionReceipt({ hash: shipHash });

  if (strategy.termRiskBudget && strategy.orderHash) {
    const budgetHash = await walletClient.writeContract({
      address: strategy.core.routeExecutor as `0x${string}`,
      abi: ROUTE_EXECUTOR_ABI,
      functionName: "setTermRiskBudget",
      args: [
        strategy.termRiskBudget.id,
        BigInt(strategy.termRiskBudget.maxReceiptExposureRaw),
        BigInt(strategy.termRiskBudget.maxQuoteSpendRaw),
        strategy.termRiskBudget.pressurePenaltyBps,
      ],
    });
    callbacks?.onBudgetSubmitted?.(budgetHash);
    await publicClient.waitForTransactionReceipt({ hash: budgetHash });

    const assignHash = await walletClient.writeContract({
      address: strategy.core.routeExecutor as `0x${string}`,
      abi: ROUTE_EXECUTOR_ABI,
      functionName: "assignOrderTermRiskBudget",
      args: [
        strategy.orderHash as `0x${string}`,
        strategy.termRiskBudget.id,
        strategy.termRiskBudget.receiptToken,
        strategy.termRiskBudget.quoteToken,
      ],
    });
    callbacks?.onBudgetSubmitted?.(assignHash);
    await publicClient.waitForTransactionReceipt({ hash: assignHash });
  }

  return { approvalHash, shipHash, orderHash: strategy.orderHash };
}
