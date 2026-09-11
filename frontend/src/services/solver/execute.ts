import type { ConnectedWallet } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http, parseAbi } from "viem";

import { DEFAULT_CHAIN } from "@/config/chains";

import type { SolverQuote } from "./types";

const ERC20_ABI = parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]);

const ROUTE_EXECUTOR_ABI = parseAbi([
  "function routeExactIn((address maker,uint256 traits,bytes data)[] orders,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient) returns (uint256 totalIn,uint256 totalOut)",
]);

export type ExecuteRouteResult = {
  approvalHash: `0x${string}`;
  routeHash: `0x${string}`;
};

export async function executeRouteQuote(
  wallet: ConnectedWallet,
  quote: SolverQuote,
  recipient: `0x${string}`,
  callbacks?: {
    onApprovalSubmitted?: (hash: `0x${string}`) => void;
    onRouteSubmitted?: (hash: `0x${string}`) => void;
  },
): Promise<ExecuteRouteResult> {
  if (!quote.execution) {
    throw new Error("This quote is not executable because the route cannot fully fill the amount.");
  }

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

  const approvalHash = await walletClient.writeContract({
    address: quote.execution.tokenIn as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [quote.execution.routeExecutor as `0x${string}`, BigInt(quote.execution.amountIn)],
  });
  callbacks?.onApprovalSubmitted?.(approvalHash);
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });

  const routeHash = await walletClient.writeContract({
    address: quote.execution.routeExecutor as `0x${string}`,
    abi: ROUTE_EXECUTOR_ABI,
    functionName: "routeExactIn",
    args: [
      quote.execution.orders.map((order) => ({
        maker: order.maker as `0x${string}`,
        traits: BigInt(order.traits),
        data: order.data,
      })),
      quote.execution.tokenIn as `0x${string}`,
      quote.execution.tokenOut as `0x${string}`,
      BigInt(quote.execution.amountIn),
      BigInt(quote.execution.minAmountOut),
      recipient,
    ],
  });
  callbacks?.onRouteSubmitted?.(routeHash);
  await publicClient.waitForTransactionReceipt({ hash: routeHash });

  return { approvalHash, routeHash };
}
