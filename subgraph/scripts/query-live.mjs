import 'dotenv/config'

const endpoint =
  process.env.ZUBIDUBI_SUBGRAPH_ENDPOINT ||
  'https://api.studio.thegraph.com/query/1760034/zubidubi/v0.9.3'

const query = `{
  markets(first: 10, orderBy: cumulativeVolumeOut, orderDirection: desc) {
    id
    receiptToken { symbol decimals }
    quoteToken { symbol decimals }
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
  }
  protocol(id: "zubidubi-sepolia") {
    cumulativeStrategyCount
    cumulativeSwapCount
    cumulativeRouteCount
    cumulativeVolumeIn
    cumulativeVolumeOut
    cumulativeProtocolSideRevenue
  }
  zubiDubiStrategies(first: 10, orderBy: updatedAtTimestamp, orderDirection: desc) {
    id
    orderHash
    market { id }
    strategyData
    status
    maker { id }
    receiptToken { symbol decimals }
    quoteToken { symbol decimals }
    receiptVirtualBalance
    quoteVirtualBalance
    exposureAmount
  }
  routeFees(first: 5, orderBy: timestamp, orderDirection: desc) {
    market { id }
    amount
    token { symbol }
    feeRecipient { id }
    transactionHash
  }
  routeFills(first: 10, orderBy: timestamp, orderDirection: desc) {
    market { id }
    maker { id }
    amountIn
    amountOut
    executionPriceE18
    routeTransactionHash
  }
}`

const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query }),
})

const body = await res.json()
if (!res.ok || body.errors || !body.data) {
  console.error(JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(body.data, null, 2))
