import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
  encodePacked,
  formatUnits,
  http,
  keccak256,
  parseAbi,
  parseUnits,
  toBytes,
} from 'viem'
import { sepolia } from 'viem/chains'

export const DEFAULT_SUBGRAPH_ENDPOINT = 'https://api.studio.thegraph.com/query/1760034/zubidubi/v0.9.6'
export const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const QUOTE_ABI = parseAbi([
  'function quoteExactIn((address maker,uint256 traits,bytes data)[] orders,address tokenIn,address tokenOut,uint256 amountIn) view returns (uint256 totalIn,uint256 totalOut,(bytes32 orderHash,address maker,uint256 fillIn,uint256 amountOut,uint256 deliverableOut,bytes32 budgetId,uint256 budgetRemainingIn,uint256 budgetRemainingOut,bool skipped)[] quotes)',
])

const ROUTER_ABI = parseAbi([
  'function hash((address maker,uint256 traits,bytes data) order) view returns (bytes32)',
])

const USE_AQUA_INSTEAD_OF_SIGNATURE_BIT = 1n << 254n
const OP_AQUA_EXIT_BACKING_ORACLE_CHECK = 0x24
const OP_AQUA_EXIT_EXPOSURE_CAP = 0x25
const OP_AQUA_EXIT_DISCOUNT_CURVE_1D = 0x26
const MAX_UINT128 = (1n << 128n) - 1n

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
    budget {
      id
      budgetId
      maxReceiptExposure
      maxQuoteSpend
      receiptExposure
      quoteSpent
      pressurePenaltyBps
    }
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
  const markets = JSON.parse(readFileSync(join(root, 'config/zubidubi-markets.json'), 'utf8'))
  const defaultAsset = markets.sepolia.maturingAssets[0]
  const defaultQuote = markets.sepolia.quoteAssets[0]
  return {
    root,
    deployment,
    markets,
    defaultAsset,
    defaultTokenIn: defaultAsset.address,
    defaultTokenOut: defaultQuote.address,
    endpoint: process.env.ZUBIDUBI_SUBGRAPH_ENDPOINT || DEFAULT_SUBGRAPH_ENDPOINT,
    rpcUrl: process.env.SEPOLIA_RPC_URL || process.env.RPC_URL,
  }
}

export async function quoteZubiDubiRoute(options = {}) {
  const config = loadSolverConfig(options.root || DEFAULT_ROOT)
  if (!config.rpcUrl) throw new Error('Missing SEPOLIA_RPC_URL in swap-vm/.env or RPC_URL in your environment.')

  const tokenIn = normalize(options.tokenIn || process.env.ZUBIDUBI_TOKEN_IN || config.defaultTokenIn)
  const tokenOut = normalize(options.tokenOut || process.env.ZUBIDUBI_TOKEN_OUT || config.defaultTokenOut)
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
  const strategyByOrderHash = new Map(strategies.map((strategy) => [String(strategy.orderHash).toLowerCase(), strategy]))
  const enrichedQuotes = quotes.map((quote) => ({
    ...quote,
    budgetPressure: buildBudgetPressureMeta(
      quote,
      strategyByOrderHash.get(String(quote.orderHash).toLowerCase())?.budget,
      receiptDecimals,
      quoteTokenDecimals,
    ),
  }))
  const quoteCandidates = enrichedQuotes.filter((quote) => quote.fillIn > 0n && !quote.skipped)
  const skippedQuotes = enrichedQuotes.filter((quote) => quote.skipped)
  const routePreview = buildBestFirstPreview(quoteCandidates, amountIn, receiptDecimals, quoteTokenDecimals)
  const canExecute = totalIn === amountIn
  const fillStatus = canExecute ? 'FULL' : totalIn > 0n ? 'PARTIAL' : 'NONE'
  const shortfallIn = amountIn - totalIn
  const netRate = totalIn > 0n
    ? Number(formatUnits(totalOut, quoteTokenDecimals)) / Number(formatUnits(totalIn, receiptDecimals))
    : 0

  const formatted = {
    product: 'ZubiDubi self-custodial term-liquidity solver',
    thesis: 'Programmable term-liquidity books for delayed-redemption assets: Aqua holds maker liquidity in-wallet, while reusable SwapVM instructions price term risk.',
    source: 'the-graph-studio + sepolia-rpc',
    graphEndpoint: config.endpoint,
    routeExecutor: config.deployment.routeExecutor,
    tokenIn,
    tokenOut,
    market,
    indexedStrategies: strategies.length,
    canExecute,
    fillStatus,
    requestedReceiptIn: formatUnits(amountIn, receiptDecimals),
    quotedReceiptIn: formatUnits(totalIn, receiptDecimals),
    shortfallReceiptIn: formatUnits(shortfallIn, receiptDecimals),
    quotedNetOut: formatUnits(totalOut, quoteTokenDecimals),
    benchmark: {
      source: 'oracle',
      label: 'SwapVM oracle/inventory curve',
      rate: totalIn > 0n ? String(netRate) : null,
      deltaBps: null,
      note: 'Sepolia quotes are executable onchain routes. Pendle side-by-side is available through npm run zubidubi:pendle-benchmark on a mainnet fork.',
    },
    routePreview,
    quoteCandidates: quoteCandidates.map((quote) => ({
      maker: quote.maker,
      orderHash: quote.orderHash,
      fillIn: formatUnits(quote.fillIn, receiptDecimals),
      amountOut: formatUnits(quote.amountOut, quoteTokenDecimals),
      deliverableOut: formatUnits(quote.deliverableOut, quoteTokenDecimals),
      budgetId: quote.budgetId,
      budgetRemainingIn: formatUnits(quote.budgetRemainingIn, receiptDecimals),
      budgetRemainingOut: formatUnits(quote.budgetRemainingOut, quoteTokenDecimals),
      budgetPressure: quote.budgetPressure,
    })),
    skippedMakers: skippedQuotes.map((quote) => ({
      maker: quote.maker,
      orderHash: quote.orderHash,
      deliverableOut: formatUnits(quote.deliverableOut, quoteTokenDecimals),
      budgetId: quote.budgetId,
      budgetRemainingIn: formatUnits(quote.budgetRemainingIn, receiptDecimals),
      budgetRemainingOut: formatUnits(quote.budgetRemainingOut, quoteTokenDecimals),
      budgetPressure: quote.budgetPressure,
      reason: quote.deliverableOut === 0n
        ? 'No deliverable maker output after live wallet balance, allowance, Aqua virtual balance, and shared term-risk budget checks.'
        : 'Skipped by route executor after executable-liquidity and maker policy checks.',
    })),
    execution: canExecute ? {
      routeExecutor: config.deployment.routeExecutor,
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      minAmountOut: totalOut.toString(),
      receiptDecimals,
      quoteTokenDecimals,
      orders: orders.map((order) => ({
        maker: order.maker,
        traits: order.traits.toString(),
        data: order.data,
      })),
    } : null,
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
    thesis: 'Aqua makers share wallet-held liquidity across programmable term-liquidity books for maturing PT-style assets.',
    graphEndpoint: options.endpoint || config.endpoint,
    ...graphData,
  }
}

export async function buildMakerStrategy(options = {}) {
  const config = loadSolverConfig(options.root || DEFAULT_ROOT)
  const marketConfig = config.markets.sepolia
  const maker = requiredAddress(options.maker, 'maker')
  const tokenIn = normalize(options.tokenIn || config.defaultTokenIn)
  const tokenOut = normalize(options.tokenOut || config.defaultTokenOut)
  const receipt = findByAddress(marketConfig.maturingAssets, tokenIn)
  const quote = findByAddress(marketConfig.quoteAssets, tokenOut)
  if (!receipt) throw new Error(`Unsupported receipt token for maker strategy: ${tokenIn}`)
  if (!quote) throw new Error(`Unsupported quote token for maker strategy: ${tokenOut}`)

  const oracle = options.oracleAddress
    ? {
        address: requiredAddress(options.oracleAddress, 'oracleAddress'),
        decimals: Number(options.oracleDecimals || 18),
        symbol: options.oracleSymbol || 'custom',
      }
    : findRatioOracle(marketConfig, receipt.underlyingSymbol, quote.symbol)

  const quoteLiquidityRaw = parsePositiveUnits(
    options.quoteLiquidity || options.amount || '25',
    quote.decimals,
    'quoteLiquidity',
  )
  const maxExposureRaw = parsePositiveUnits(
    options.maxExposure || defaultExposureFor(receipt),
    receipt.decimals,
    'maxExposure',
  )
  const maxNotionalOutRaw = options.maxNotionalOut
    ? parsePositiveUnits(options.maxNotionalOut, quote.decimals, 'maxNotionalOut')
    : 0n
  const budgetLabel = String(options.budgetLabel || `${receipt.underlyingSymbol}-${quote.symbol}-term-book`)
  const budgetId = bytes32OrHash(options.budgetId, budgetLabel)
  const budgetMaxExposureRaw = options.budgetMaxExposure
    ? parsePositiveUnits(options.budgetMaxExposure, receipt.decimals, 'budgetMaxExposure')
    : maxExposureRaw * 3n
  const budgetMaxSpendRaw = options.budgetMaxSpend
    ? parsePositiveUnits(options.budgetMaxSpend, quote.decimals, 'budgetMaxSpend')
    : quoteLiquidityRaw * 3n
  const budgetPressurePenaltyBps = toBps(options.budgetPressurePenaltyBps ?? percentToBps(options.budgetPressurePenaltyPct ?? 1), 'budgetPressurePenaltyBps')

  assertUint128(quoteLiquidityRaw, 'quoteLiquidity')
  assertUint128(maxExposureRaw, 'maxExposure')
  assertUint128(maxNotionalOutRaw, 'maxNotionalOut')
  assertUint128(budgetMaxExposureRaw, 'budgetMaxExposure')
  assertUint128(budgetMaxSpendRaw, 'budgetMaxSpend')

  const now = Math.floor(Date.now() / 1000)
  const maturity = Number(options.maturity || receipt.maturity)
  const minMaturity = Number(options.minMaturity || now + Number(options.minDays || 1) * 86_400)
  const maxMaturity = Number(options.maxMaturity || now + Number(options.maxDays || 540) * 86_400)
  if (maturity < minMaturity || maturity > maxMaturity) {
    throw new Error(
      `${receipt.symbol} maturity is outside the selected maker window (${minMaturity}..${maxMaturity}).`,
    )
  }

  const args = encodePacked(
    [
      'uint32',
      'uint32',
      'uint32',
      'uint40',
      'uint32',
      'uint8',
      'uint8',
      'uint8',
      'address',
      'uint128',
      'uint32',
      'uint128',
      'uint32',
      'uint32',
      'uint40',
      'uint40',
      'address',
      'address',
      'address',
      'uint32',
      'uint32',
      'uint8',
      'uint32',
    ],
    [
      toBps(options.baseDiscountBps ?? percentToBps(options.baseDiscountPct ?? 0.4), 'baseDiscountBps'),
      toBps(options.annualRateBps ?? percentToBps(options.annualRatePct ?? 6), 'annualRateBps'),
      toBps(options.maxDiscountBps ?? percentToBps(options.maxDiscountPct ?? 4), 'maxDiscountBps'),
      BigInt(maturity),
      toUint(options.maxStaleness ?? 172_800, 'maxStaleness'),
      Number(receipt.decimals),
      Number(quote.decimals),
      Number(oracle.decimals),
      oracle.address,
      maxExposureRaw,
      toBps(options.inventorySlopeBps ?? percentToBps(options.inventorySlopePct ?? 1.5), 'inventorySlopeBps'),
      maxNotionalOutRaw,
      toBps(options.liquiditySlopeBps ?? percentToBps(options.liquiditySlopePct ?? 0.6), 'liquiditySlopeBps'),
      toBps(options.riskTierBps ?? riskTierBps(options.riskTier || options.tier || 'balanced'), 'riskTierBps'),
      BigInt(minMaturity),
      BigInt(maxMaturity),
      tokenIn,
      tokenOut,
      options.secondaryOracleAddress ? requiredAddress(options.secondaryOracleAddress, 'secondaryOracleAddress') : '0x0000000000000000000000000000000000000000',
      toBps(options.maxDeviationBps ?? percentToBps(options.deviationPct ?? 0), 'maxDeviationBps'),
      toBps(options.deviationHaircutBps ?? percentToBps(options.deviationHaircutPct ?? 0), 'deviationHaircutBps'),
      Number(options.curveFamily ?? (options.convex === false ? 0 : 1)),
      toBps(options.convexityBps ?? percentToBps(Number(options.convexity ?? 1.8)), 'convexityBps'),
    ],
  )

  const argLength = (args.length - 2) / 2
  if (argLength > 255) throw new Error(`Strategy arg payload is too large for uint8 length: ${argLength}`)

  const len = argLength.toString(16).padStart(2, '0')
  const program = concatHex([
    `0x${OP_AQUA_EXIT_BACKING_ORACLE_CHECK.toString(16).padStart(2, '0')}${len}`,
    args,
    `0x${OP_AQUA_EXIT_EXPOSURE_CAP.toString(16).padStart(2, '0')}${len}`,
    args,
    `0x${OP_AQUA_EXIT_DISCOUNT_CURVE_1D.toString(16).padStart(2, '0')}${len}`,
    args,
  ])

  const order = {
    maker,
    traits: USE_AQUA_INSTEAD_OF_SIGNATURE_BIT,
    data: program,
  }
  const encodedOrder = encodeAbiParameters([
    {
      type: 'tuple',
      components: [
        { name: 'maker', type: 'address' },
        { name: 'traits', type: 'uint256' },
        { name: 'data', type: 'bytes' },
      ],
    },
  ], [order])

  let orderHash = null
  if (config.rpcUrl) {
    const client = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) })
    orderHash = await client.readContract({
      address: marketConfig.core.aquaSwapVMRouter,
      abi: ROUTER_ABI,
      functionName: 'hash',
      args: [order],
    })
  }

  return {
    product: 'ZubiDubi maker strategy builder',
    source: 'config/zubidubi-markets.json + reusable SwapVM term-liquidity instruction library',
    chainId: marketConfig.chainId,
    core: {
      aqua: marketConfig.core.aqua,
      router: marketConfig.core.aquaSwapVMRouter,
      routeExecutor: marketConfig.core.routeExecutor,
    },
    orderHash,
    order: {
      maker,
      traits: order.traits.toString(),
      data: order.data,
    },
    encodedOrder,
    tokens: [tokenIn, tokenOut],
    amounts: ['0', quoteLiquidityRaw.toString()],
    market: {
      pair: `${receipt.symbol}/${quote.symbol}`,
      receiptSymbol: receipt.symbol,
      quoteSymbol: quote.symbol,
      receiptDecimals: receipt.decimals,
      quoteDecimals: quote.decimals,
      maturity,
      oracle: {
        symbol: oracle.symbol,
        address: oracle.address,
        decimals: oracle.decimals,
      },
    },
    limits: {
      quoteLiquidity: formatUnits(quoteLiquidityRaw, quote.decimals),
      maxExposure: formatUnits(maxExposureRaw, receipt.decimals),
      maxNotionalOut: maxNotionalOutRaw === 0n ? 'unbounded' : formatUnits(maxNotionalOutRaw, quote.decimals),
    },
    termRiskBudget: {
      id: budgetId,
      label: budgetLabel,
      maxReceiptExposure: formatUnits(budgetMaxExposureRaw, receipt.decimals),
      maxQuoteSpend: formatUnits(budgetMaxSpendRaw, quote.decimals),
      maxReceiptExposureRaw: budgetMaxExposureRaw.toString(),
      maxQuoteSpendRaw: budgetMaxSpendRaw.toString(),
      pressurePenaltyBps: budgetPressurePenaltyBps,
      receiptToken: tokenIn,
      quoteToken: tokenOut,
    },
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

function buildBudgetPressureMeta(quote, budget, receiptDecimals, quoteTokenDecimals) {
  const zeroBudgetId = /^0x0{64}$/i
  if (!budget || !quote.budgetId || zeroBudgetId.test(String(quote.budgetId))) return null

  const maxReceiptExposureRaw = BigInt(budget.maxReceiptExposure ?? 0)
  const maxQuoteSpendRaw = BigInt(budget.maxQuoteSpend ?? 0)
  const budgetRemainingInRaw = quote.budgetRemainingIn
  const budgetRemainingOutRaw = quote.budgetRemainingOut
  const pressurePenaltyBps = Number(budget.pressurePenaltyBps ?? 0)

  const receiptUsedRaw = maxReceiptExposureRaw > 0n && budgetRemainingInRaw < maxReceiptExposureRaw
    ? maxReceiptExposureRaw - budgetRemainingInRaw
    : 0n
  const quoteUsedRaw = maxQuoteSpendRaw > 0n && budgetRemainingOutRaw < maxQuoteSpendRaw
    ? maxQuoteSpendRaw - budgetRemainingOutRaw
    : 0n

  const receiptUtilizationBps = maxReceiptExposureRaw > 0n
    ? Number((receiptUsedRaw * 10_000n) / maxReceiptExposureRaw)
    : 0
  const quoteUtilizationBps = maxQuoteSpendRaw > 0n
    ? Number((quoteUsedRaw * 10_000n) / maxQuoteSpendRaw)
    : 0
  const utilizationBps = Math.min(Math.max(receiptUtilizationBps, quoteUtilizationBps), 10_000)
  const activePressureBps = Math.min(Math.floor((pressurePenaltyBps * utilizationBps) / 10_000), 10_000)

  return {
    budgetId: budget.budgetId ?? quote.budgetId,
    maxReceiptExposure: formatUnits(maxReceiptExposureRaw, receiptDecimals),
    maxQuoteSpend: formatUnits(maxQuoteSpendRaw, quoteTokenDecimals),
    receiptUsed: formatUnits(receiptUsedRaw, receiptDecimals),
    quoteUsed: formatUnits(quoteUsedRaw, quoteTokenDecimals),
    receiptUtilizationBps,
    quoteUtilizationBps,
    utilizationBps,
    pressurePenaltyBps,
    activePressureBps,
  }
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
      budgetId: quote.budgetId,
      budgetRemainingIn: formatUnits(quote.budgetRemainingIn, receiptDecimals),
      budgetRemainingOut: formatUnits(quote.budgetRemainingOut, quoteTokenDecimals),
      budgetPressure: quote.budgetPressure,
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

function requiredAddress(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/u.test(value)) {
    throw new Error(`Invalid ${label} address.`)
  }
  return value
}

function findByAddress(items, address) {
  const normalized = normalize(address)
  return items.find((item) => normalize(item.address) === normalized) || null
}

function findRatioOracle(marketConfig, underlyingSymbol, quoteSymbol) {
  const base = underlyingSymbol === 'WETH' ? 'ETH' : underlyingSymbol
  const symbol = `${base}/${quoteSymbol}`
  const oracle = marketConfig.oracles.ratioAdapters.find((item) => item.symbol === symbol)
  if (!oracle) throw new Error(`No deployed Sepolia ratio oracle configured for ${symbol}.`)
  return oracle
}

function defaultExposureFor(receipt) {
  const symbol = receipt.symbol.toUpperCase()
  if (symbol.includes('USD')) return '50000'
  if (symbol.includes('LINK')) return '2500'
  return '10'
}

function parsePositiveUnits(value, decimals, label) {
  const parsed = parseUnits(String(value), Number(decimals))
  if (parsed <= 0n) throw new Error(`${label} must be greater than zero.`)
  return parsed
}

function assertUint128(value, label) {
  if (value < 0n || value > MAX_UINT128) throw new Error(`${label} exceeds uint128.`)
}

function percentToBps(value) {
  return Math.round(Number(value) * 100)
}

function toBps(value, label) {
  return toUint(value, label)
}

function toUint(value, label) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a positive number.`)
  return Math.round(parsed)
}

function riskTierBps(tier) {
  if (tier === 'conservative') return 25
  if (tier === 'aggressive') return 150
  return 75
}

function bytes32OrHash(value, fallbackLabel) {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/u.test(value)) return value
  return keccak256(toBytes(String(value || fallbackLabel)))
}

function concatHex(parts) {
  return `0x${parts.map((part) => part.replace(/^0x/u, '')).join('')}`
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
