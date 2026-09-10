import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, decodeAbiParameters, formatUnits, http, parseAbi, parseUnits } from 'viem'
import { sepolia } from 'viem/chains'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv(join(root, 'subgraph/.env'))
loadEnv(join(root, 'swap-vm/.env'))

const deployment = JSON.parse(readFileSync(join(root, 'swap-vm/deployments/sepolia/ZubiDubi.json'), 'utf8'))

const endpoint =
  process.env.ZUBIDUBI_SUBGRAPH_ENDPOINT ||
  'https://api.studio.thegraph.com/query/1760034/zubidubi/v0.3.0'
const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL
const tokenIn = normalize(process.env.ZUBIDUBI_TOKEN_IN || deployment.exitReceipt)
const tokenOut = normalize(process.env.ZUBIDUBI_TOKEN_OUT || deployment.usdc)
const amountIn = parseUnits(process.env.ZUBIDUBI_AMOUNT_IN || '0.003', 18)

if (!rpcUrl) {
  console.error('Missing SEPOLIA_RPC_URL in swap-vm/.env or RPC_URL in your environment.')
  process.exit(1)
}

const query = `query SolverStrategies($tokenIn: String!, $tokenOut: String!) {
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

const graphData = await graphRequest(endpoint, query, { tokenIn, tokenOut })
const strategies = graphData.zubiDubiStrategies ?? []
const market = graphData.markets?.[0] ?? null

if (strategies.length === 0) {
  console.error(`No active indexed ZubiDubi strategies for ${tokenIn} -> ${tokenOut}.`)
  process.exit(1)
}

const orders = strategies.map((strategy) => decodeOrder(strategy.strategyData))
const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
const [totalIn, totalOut, quotes] = await client.readContract({
  address: deployment.routeExecutor,
  abi: parseAbi([
    'function quoteExactIn((address maker,uint256 traits,bytes data)[] orders,address tokenIn,address tokenOut,uint256 amountIn) view returns (uint256 totalIn,uint256 totalOut,(bytes32 orderHash,address maker,uint256 fillIn,uint256 amountOut,uint256 deliverableOut,bool skipped)[] quotes)',
  ]),
  functionName: 'quoteExactIn',
  args: [orders, tokenIn, tokenOut, amountIn],
})

const quoteTokenDecimals = Number(strategies[0].quoteToken.decimals)
const receiptDecimals = Number(strategies[0].receiptToken.decimals)
const quoteCandidates = quotes.filter((quote) => quote.fillIn > 0n && !quote.skipped)
const skippedQuotes = quotes.filter((quote) => quote.skipped)
const routePreview = buildBestFirstPreview(quoteCandidates, amountIn)

console.log(JSON.stringify({
  source: 'the-graph-studio + sepolia-rpc',
  graphEndpoint: endpoint,
  routeExecutor: deployment.routeExecutor,
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
}, null, 2))

async function graphRequest(url, graphQuery, variables) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: graphQuery, variables }),
  })
  const body = await res.json()
  if (!res.ok || body.errors) {
    throw new Error(JSON.stringify(body, null, 2))
  }
  return body.data
}

function decodeOrder(encodedOrder) {
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

function normalize(address) {
  return address.toLowerCase()
}

function buildBestFirstPreview(candidates, requestedIn) {
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
    note: 'Best-first preview from Graph-discovered quote candidates; RouteExecutor rechecks and executes atomically onchain.',
    fills,
  }
}

function loadEnv(path) {
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
