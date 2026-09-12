export const MARKET_BOARD_QUERY = /* GraphQL */ `
  query MarketBoard {
    _meta {
      hasIndexingErrors
      block {
        number
      }
      deployment
    }
    protocol(id: "zubidubi-sepolia") {
      cumulativeStrategyCount
      cumulativeSwapCount
      cumulativeRouteCount
      cumulativeVolumeIn
      cumulativeVolumeOut
      cumulativeProtocolSideRevenue
      lastUpdatedBlock
      lastUpdatedTimestamp
    }
    markets(first: 50, orderBy: totalStrategyCount, orderDirection: desc) {
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
    routeFills(first: 20, orderBy: timestamp, orderDirection: desc) {
      id
      routeTransactionHash
      market {
        id
        receiptToken {
          symbol
          decimals
        }
        quoteToken {
          symbol
          decimals
        }
      }
      maker {
        id
      }
      amountIn
      amountOut
      executionPriceE18
      timestamp
      blockNumber
    }
    strategySnapshots(first: 20, orderBy: timestamp, orderDirection: desc) {
      id
      reason
      status
      market {
        id
        receiptToken {
          symbol
        }
        quoteToken {
          symbol
          decimals
        }
      }
      strategy {
        maker {
          id
        }
      }
      receiptVirtualBalance
      quoteVirtualBalance
      exposureAmount
      quotePulledAmount
      transactionHash
      timestamp
      blockNumber
    }
    routeFees(first: 10, orderBy: timestamp, orderDirection: desc) {
      id
      market {
        id
        receiptToken {
          symbol
        }
        quoteToken {
          symbol
        }
      }
      token {
        symbol
        decimals
      }
      amount
      transactionHash
      timestamp
      blockNumber
    }
    termRiskBudgets(first: 20, orderBy: lastUpdatedTimestamp, orderDirection: desc) {
      id
      maker {
        id
      }
      budgetId
      maxReceiptExposure
      maxQuoteSpend
      receiptExposure
      quoteSpent
      pressurePenaltyBps
      assignmentCount
      fillCount
      lastUpdatedBlock
      lastUpdatedTimestamp
    }
    termRiskBudgetUses(first: 20, orderBy: timestamp, orderDirection: desc) {
      id
      maker {
        id
      }
      budget {
        id
        budgetId
      }
      orderHash
      fillIn
      amountOut
      receiptExposure
      quoteSpent
      transactionHash
      blockNumber
      timestamp
    }
  }
`;
