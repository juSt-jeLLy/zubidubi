export const PORTFOLIO_QUERY = /* GraphQL */ `
  query Portfolio($account: String!) {
    _meta {
      hasIndexingErrors
      block {
        number
      }
    }
    receiptAssets(first: 50, orderBy: maturity, orderDirection: asc) {
      id
      token {
        id
        symbol
        decimals
      }
      underlying
      maturity
      assetsPerReceipt
      totalMinted
      totalBurned
      lastUpdatedBlock
      lastUpdatedTimestamp
    }
    markets(first: 50, orderBy: activeStrategyCount, orderDirection: desc) {
      id
      receiptToken {
        id
        symbol
        name
        decimals
        isReceipt
      }
      quoteToken {
        id
        symbol
        name
        decimals
        isReceipt
      }
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
      lastUpdatedBlock
      lastUpdatedTimestamp
    }
    makerStrategies: zubiDubiStrategies(
      first: 50
      where: { maker: $account }
      orderBy: updatedAtTimestamp
      orderDirection: desc
    ) {
      id
      orderHash
      status
      market {
        id
        receiptToken {
          id
          symbol
          decimals
        }
        quoteToken {
          id
          symbol
          decimals
        }
      }
      receiptToken {
        id
        symbol
        decimals
      }
      quoteToken {
        id
        symbol
        decimals
      }
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
        assignmentCount
        fillCount
      }
      createdAtBlock
      createdAtTimestamp
      updatedAtBlock
      updatedAtTimestamp
    }
    takerRoutes: routes(
      first: 25
      where: { taker: $account }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      market {
        id
        receiptToken {
          id
          symbol
          decimals
        }
        quoteToken {
          id
          symbol
          decimals
        }
      }
      taker {
        id
      }
      recipient {
        id
      }
      tokenIn {
        id
        symbol
        decimals
      }
      tokenOut {
        id
        symbol
        decimals
      }
      amountIn
      netAmountOut
      fills
      feeAmount
      blockNumber
      timestamp
      transactionHash
    }
    recipientRoutes: routes(
      first: 25
      where: { recipient: $account }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      market {
        id
        receiptToken {
          id
          symbol
          decimals
        }
        quoteToken {
          id
          symbol
          decimals
        }
      }
      taker {
        id
      }
      recipient {
        id
      }
      tokenIn {
        id
        symbol
        decimals
      }
      tokenOut {
        id
        symbol
        decimals
      }
      amountIn
      netAmountOut
      fills
      feeAmount
      blockNumber
      timestamp
      transactionHash
    }
    takerFills: routeFills(
      first: 25
      where: { taker: $account }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      routeTransactionHash
      strategy {
        id
      }
      market {
        id
        receiptToken {
          id
          symbol
          decimals
        }
        quoteToken {
          id
          symbol
          decimals
        }
      }
      maker {
        id
      }
      taker {
        id
      }
      tokenIn {
        id
        symbol
        decimals
      }
      tokenOut {
        id
        symbol
        decimals
      }
      amountIn
      amountOut
      executionPriceE18
      blockNumber
      timestamp
    }
    makerFills: routeFills(
      first: 25
      where: { maker: $account }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      routeTransactionHash
      strategy {
        id
      }
      market {
        id
        receiptToken {
          id
          symbol
          decimals
        }
        quoteToken {
          id
          symbol
          decimals
        }
      }
      maker {
        id
      }
      taker {
        id
      }
      tokenIn {
        id
        symbol
        decimals
      }
      tokenOut {
        id
        symbol
        decimals
      }
      amountIn
      amountOut
      executionPriceE18
      blockNumber
      timestamp
    }
    makerFees: routeFees(
      first: 25
      where: { feeRecipient: $account }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      market {
        id
        receiptToken {
          id
          symbol
        }
        quoteToken {
          id
          symbol
        }
      }
      token {
        id
        symbol
        decimals
      }
      amount
      transactionHash
      blockNumber
      timestamp
    }
  }
`;
