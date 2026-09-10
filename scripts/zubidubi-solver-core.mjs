import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, decodeAbiParameters, formatUnits, http, parseAbi, parseUnits } from 'viem'
import { sepolia } from 'viem/chains'

export const DEFAULT_SUBGRAPH_ENDPOINT = 'https://api.studio.thegraph.com/query/1760034/zubidubi/v0.8.2'
export const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const QUOTE_ABI = parseAbi([
  'function quoteExactIn((address maker,uint256 traits,bytes data)[] orders,address tokenIn,address tokenOut,uint256 amountIn) view returns (uint256 totalIn,uint256 totalOut,(bytes32 orderHash,address maker,uint256 fillIn,uint256 amountOut,uint256 deliverableOut,bool skipped)[] quotes)',
])

const SOLVER_QUERY = `query SolverStrategies($tokenIn: String!, $tokenOut: String!) {
  markets(where: { receiptToken: $tokenIn, quoteToken: $tokenOut }) {
    id
    totalStrategyCount
    activeStrategyCount
    totalVirtualReceipt
    totalVirtualQuote
    totalReceiptExposure
    totalQuotePulled
    swapCount
    routeCount
    cumulativeVolumeIn
    cumulativeVolumeOut
    cumulativeProtocolSideRevenue
    lastUpdatedTimestamp
  }
  zubiDubiStrategies(
    where: { status: ACTIVE, receiptToken: $tokenIn, quoteToken: $tokenOut }
    orderBy: updatedAtTimestamp
    orderDirection: desc
  ) {
    id
    orderHash
    strategyData
    receiptVirtualBalance
    quoteVirtualBalance
    exposureAmount
    quotePulledAmount
    maker { id }
    receiptToken { id symbol decimals }
    quoteToken { id symbol decimals }
    updatedAtTimestamp
  }
}`

const MARKETS_QUERY = `{
  _meta {
    hasIndexingErrors
    block { number }
    deployment
  }
  protocol(id: "zubidubi-sepolia") {
    cumulativeStrategyCount
    cumulativeSwapCount
    cumulativeRouteCount
    cumulativeVolumeIn
    cumulativeVolumeOut
    cumulativeProtocolSideRevenue
  }
  markets(first: 25, orderBy: totalStrategyCount, orderDirection: desc) {
    id
    receiptToken { id symbol decimals }
    quoteToken { id symbol decimals }
    totalStrategyCount
    activeStrategyCount
    totalVirtualReceipt
    totalVirtualQuote
    totalReceiptExposure
    totalQuotePulled
    swapCount
    routeCount
    cumulativeVolumeIn
    cumulativeVolumeOut
    cumulativeProtocolSideRevenue
    lastUpdatedTimestamp
  }
  routeFills(first: 10, orderBy: timestamp, orderDirection: desc) {
    market { id }
    maker { id }
    amountIn
    amountOut
    executionPriceE18
    routeTransactionHash
    timestamp
  }
}`

export function loadSolverConfig(root = DEFAULT_ROOT) {
  loadEnv(join(root, 'subgraph/.env'))
  loadEnv(join(root, 'swap-vm/.env'))
  const deployment = JSON.parse(readFileSync(join(root, 'swap-vm/deployments/sepolia/ZubiDubi.json'), 'utf8'))
  return {
    root,
    deployment,
    endpoint: process.env.ZUBIDUBI_SUBGRAPH_ENDPOINT || DEFAULT_SUBGRAPH_ENDPOINT,
    rpcUrl: process.env.SEPOLIA_RPC_URL || process.env.RPC_URL,
  }
}

export async function quoteZubiDubiRoute(options = {}) {
  const config = loadSolverConfig(options.root || DEFAULT_ROOT)
  if (!config.rpcUrl) throw new Error('Missing SEPOLIA_RPC_URL in swap-vm/.env or RPC_URL in your environment.')

  const tokenIn = normalize(options.tokenIn || process.env.ZUBIDUBI_TOKEN_IN || config.deployment.exitReceipt)
  const tokenOut = normalize(options.tokenOut || process.env.ZUBIDUBI_TOKEN_OUT || config.deployment.usdc)
  const amountIn = typeof options.amountIn === 'bigint'
    ? options.amountIn
    : parseUnits(String(options.amountIn || process.env.ZUBIDUBI_AMOUNT_IN || '0.003'), Number(options.inputDecimals || 18))

  const graphData = await graphRequest(config.endpoint, SOLVER_QUERY, { tokenIn, tokenOut })
  const strategies = graphData.zubiDubiStrategies ?? []
  const market = graphData.markets?.[0] ?? null
  if (strategies.length === 0) {
    throw new Error(`No active indexed ZubiDubi strategies for ${tokenIn} -> ${tokenOut}.`)
  }

  const orders = strategies.map((strategy) => decodeOrder(strategy.strategyData))
  const client = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) })
  const [totalIn, totalOut, quotes] = await client.readContract({
    address: config.deployment.routeExecutor,
    abi: QUOTE_ABI,
    functionName: 'quoteExactIn',
    args: [orders, tokenIn, tokenOut, amountIn],
  })

  const quoteTokenDecimals = Number(strategies[0].quoteToken.decimals)
  const receiptDecimals = Number(strategies[0].receiptToken.decimals)
  const quoteCandidates = quotes.filter((quote) => quote.fillIn > 0n && !quote.skipped)
  const skippedQuotes = quotes.filter((quote) => quote.skipped)
  const routePreview = buildBestFirstPreview(quoteCandidates, amountIn, receiptDecimals, quoteTokenDecimals)

  const formatted = {
    product: 'ZubiDubi self-custodial term-liquidity solver',
    thesis: 'Makers quote programmable risk curves for Pendle-like maturing assets through Aqua; sellers get instant USDC without locked pools.',
    source: 'the-graph-studio + sepolia-rpc',
    graphEndpoint: config.endpoint,
    routeExecutor: config.deployment.routeExecutor,
    tokenIn,
    tokenOut,
    market,
    indexedStrategies: strategies.length,
    requestedReceiptIn: formatUnits(amountIn, receiptDecimals),
    quotedReceiptIn: formatUnits(totalIn, receiptDecimals),
    quotedNetOut: formatUnits(totalOut, quoteTokenDecimals),
    routePreview,
    quoteCandidates: quoteCandidates.map((quote) => ({
      maker: quote.maker,
      orderHash: quote.orderHash,
      fillIn: formatUnits(quote.fillIn, receiptDecimals),
      amountOut: formatUnits(quote.amountOut, quoteTokenDecimals),
      deliverableOut: formatUnits(quote.deliverableOut, quoteTokenDecimals),
    })),
    skippedMakers: skippedQuotes.map((quote) => ({
      maker: quote.maker,
      orderHash: quote.orderHash,
    })),
  }

  return {
    ...formatted,
    raw: {
      orders,
      amountIn,
      minNetOut: totalOut,
      receiptDecimals,
      quoteTokenDecimals,
      deployment: config.deployment,
    },
  }
}

export async function listZubiDubiMarkets(options = {}) {
  const config = loadSolverConfig(options.root || DEFAULT_ROOT)
  const graphData = await graphRequest(options.endpoint || config.endpoint, MARKETS_QUERY)
  return {
    product: 'ZubiDubi self-custodial term-liquidity network',
    thesis: 'Aqua makers share wallet-held liquidity across a term book of maturing PT-style assets.',
    graphEndpoint: options.endpoint || config.endpoint,
    ...graphData,
  }
}

export function toPublicQuote(quote) {
  const { raw, ...publicQuote } = quote
  return publicQuote
}

export async function graphRequest(url, graphQuery, variables = undefined) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: graphQuery, variables }),
  })
  const body = await res.json()
  if (!res.ok || body.errors || !body.data) {
    throw new Error(JSON.stringify(body, null, 2))
  }
  return body.data
}

export function decodeOrder(encodedOrder) {
  const [order] = decodeAbiParameters([
    {
      type: 'tuple',
      components: [
        { name: 'maker', type: 'address' },
        { name: 'traits', type: 'uint256' },
        { name: 'data', type: 'bytes' },
      ],
    },
  ], encodedOrder)
  return order
}

export function buildBestFirstPreview(candidates, requestedIn, receiptDecimals, quoteTokenDecimals) {
  const sorted = [...candidates].sort((a, b) => {
    const left = b.amountOut * a.fillIn
    const right = a.amountOut * b.fillIn
    if (left > right) return 1
    if (left < right) return -1
    return a.orderHash.localeCompare(b.orderHash)
  })

  let remaining = requestedIn
  const fills = []
  for (const quote of sorted) {
    if (remaining === 0n) break
    const fillIn = quote.fillIn < remaining ? quote.fillIn : remaining
    const amountOut = quote.amountOut * fillIn / quote.fillIn
    fills.push({
      maker: quote.maker,
      orderHash: quote.orderHash,
      fillIn: formatUnits(fillIn, receiptDecimals),
      estimatedGrossOut: formatUnits(amountOut, quoteTokenDecimals),
    })
    remaining -= fillIn
  }

  return {
    note: 'Best-first preview from Graph-discovered quote candidates; RouteExecutor rechecks deliverability and executes atomically onchain.',
    requestedIn: formatUnits(requestedIn, receiptDecimals),
    filledIn: formatUnits(requestedIn - remaining, receiptDecimals),
    unfilledIn: formatUnits(remaining, receiptDecimals),
    fills,
  }
}

export function normalize(address) {
  return address.toLowerCase()
}

export function loadEnv(path) {
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const index = line.indexOf('=')
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')
    if (!process.env[key]) process.env[key] = value
  }
}
