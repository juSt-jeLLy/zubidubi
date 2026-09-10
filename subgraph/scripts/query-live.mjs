import 'dotenv/config'

const endpoint =
  process.env.ZUBIDUBI_SUBGRAPH_ENDPOINT ||
  'https://api.studio.thegraph.com/query/1760034/zubidubi/v0.1.0'

const query = `{
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
    amount
    token { symbol }
    feeRecipient { id }
    transactionHash
  }
}`

const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query }),
})

const body = await res.json()
if (!res.ok || body.errors) {
  console.error(JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(body.data, null, 2))
