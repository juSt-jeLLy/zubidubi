import { createPublicClient, createWalletClient, formatUnits, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { loadSolverConfig, normalize, quoteZubiDubiRoute, toPublicQuote } from './zubidubi-solver-core.mjs'

const quote = await quoteZubiDubiRoute()
console.log(JSON.stringify(toPublicQuote(quote), null, 2))

// ZUBIDUBI_EXECUTE=1 turns the solver into a taker: it mints fresh backed receipts on
// Sepolia (WETH deposit -> issue), quotes the Graph-discovered route, then atomically
// executes it through ZubiDubiRouteExecutor. Set ZUBIDUBI_AMOUNT_IN for the size and
// ZUBIDUBI_RECIPIENT to route USDC proceeds elsewhere (default: operator EOA).
if (process.env.ZUBIDUBI_EXECUTE === '1') {
  if (!quote.raw.minNetOut || quote.raw.amountIn <= 0n) {
    throw new Error('Route cannot fill the requested amount; aborting execution.')
  }
  await executeRoute(quote)
}

async function executeRoute(quote) {
  const config = loadSolverConfig()
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY || process.env.ZUBIDUBI_PRIVATE_KEY
  if (!privateKey) throw new Error('Missing SEPOLIA_PRIVATE_KEY (in swap-vm/.env) for execution.')

  const account = privateKeyToAccount(privateKey)
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(config.rpcUrl) })
  const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) })
  const recipient = normalize(process.env.ZUBIDUBI_RECIPIENT || account.address)

  const weth = normalize(config.deployment.weth)
  const exitReceipt = normalize(config.deployment.exitReceipt)
  const executor = normalize(config.deployment.routeExecutor)
  const usdc = normalize(config.deployment.usdc)

  const depositAbi = parseAbi(['function deposit() payable'])
  const approveAbi = parseAbi(['function approve(address,uint256) returns (bool)'])
  const issueAbi = parseAbi(['function issue(uint256,address) returns (uint256)'])
  const routeAbi = parseAbi([
    'function routeExactIn((address maker,uint256 traits,bytes data)[] orders,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient) returns (uint256 totalIn,uint256 totalOut)',
  ])
  const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)'])

  const wait = async (label, hash) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`[execute] ${label}: ${receipt.status} ${hash}`)
    if (receipt.status !== 'success') throw new Error(`Transaction failed: ${label}`)
    return receipt
  }

  console.log(`[execute] operator=${account.address} recipient=${recipient} amountIn=${formatUnits(quote.raw.amountIn, quote.raw.receiptDecimals)} minNetOut=${formatUnits(quote.raw.minNetOut, quote.raw.quoteTokenDecimals)} USDC`)

  const deposit = await wallet.writeContract({ address: weth, abi: depositAbi, functionName: 'deposit', value: quote.raw.amountIn })
  await wait('WETH.deposit', deposit)
  const approveWeth = await wallet.writeContract({ address: weth, abi: approveAbi, functionName: 'approve', args: [exitReceipt, quote.raw.amountIn] })
  await wait('WETH.approve(receipt)', approveWeth)
  const issue = await wallet.writeContract({ address: exitReceipt, abi: issueAbi, functionName: 'issue', args: [quote.raw.amountIn, account.address] })
  await wait('receipt.issue', issue)
  const approveReceipt = await wallet.writeContract({ address: exitReceipt, abi: approveAbi, functionName: 'approve', args: [executor, quote.raw.amountIn] })
  await wait('receipt.approve(executor)', approveReceipt)

  const routeTx = await wallet.writeContract({
    address: executor,
    abi: routeAbi,
    functionName: 'routeExactIn',
    args: [quote.raw.orders, quote.tokenIn, quote.tokenOut, quote.raw.amountIn, quote.raw.minNetOut, recipient],
  })
  await wait('routeExactIn', routeTx)

  const [leftoverReceipts, recipientUsdc] = await Promise.all([
    publicClient.readContract({ address: exitReceipt, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] }),
  ])

  console.log(JSON.stringify({
    execution: 'SUCCESS',
    routeTransaction: routeTx,
    operator: account.address,
    recipient,
    receiptIn: formatUnits(quote.raw.amountIn, quote.raw.receiptDecimals),
    minNetOut: formatUnits(quote.raw.minNetOut, quote.raw.quoteTokenDecimals),
    operatorReceiptLeftover: formatUnits(leftoverReceipts, quote.raw.receiptDecimals),
    recipientUsdcBalance: formatUnits(recipientUsdc, quote.raw.quoteTokenDecimals),
  }, null, 2))
}
