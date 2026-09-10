import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { Docked, Pulled, Pushed, Shipped } from '../generated/Aqua/Aqua'
import { Market, ZubiDubiStrategy } from '../generated/schema'
import { attachStrategyMarket, loadAccount, loadMarket, loadProtocol, loadStrategy, loadStrategyBalance, loadToken, snapshotStrategy } from './entities'
import { ONE_BI } from './constants'

export function handleShipped(event: Shipped): void {
  let protocol = loadProtocol(event)
  protocol.cumulativeStrategyCount = protocol.cumulativeStrategyCount.plus(ONE_BI)
  protocol.save()

  let maker = loadAccount(event.params.maker, event)
  maker.strategyCount = maker.strategyCount.plus(ONE_BI)
  maker.save()

  let strategy = loadStrategy(event.params.maker, event.params.app, event.params.strategyHash, event)
  strategy.strategyData = event.params.strategy
  strategy.status = 'ACTIVE'
  attachStrategyMarket(strategy, event)
  strategy.save()
  snapshotStrategy(strategy, 'SHIPPED', event)
}

export function handleDocked(event: Docked): void {
  let protocol = loadProtocol(event)
  protocol.save()

  let strategy = loadStrategy(event.params.maker, event.params.app, event.params.strategyHash, event)
  if (strategy.status == 'ACTIVE' && strategy.market != null) {
    let market = loadStrategyMarket(strategy.market!, event)
    if (market != null && market.activeStrategyCount.gt(ONE_BI)) {
      market.activeStrategyCount = market.activeStrategyCount.minus(ONE_BI)
      market.save()
    } else if (market != null) {
      market.activeStrategyCount = market.activeStrategyCount.minus(market.activeStrategyCount)
      market.save()
    }
  }
  strategy.status = 'DOCKED'
  strategy.save()
  snapshotStrategy(strategy, 'DOCKED', event)
}

export function handlePushed(event: Pushed): void {
  let protocol = loadProtocol(event)
  protocol.save()

  let strategy = loadStrategy(event.params.maker, event.params.app, event.params.strategyHash, event)
  let hadMarket = strategy.market != null
  let oldReceiptVirtualBalance = strategy.receiptVirtualBalance
  let oldQuoteVirtualBalance = strategy.quoteVirtualBalance
  let oldExposureAmount = strategy.exposureAmount
  let balance = loadStrategyBalance(strategy, event.params.token, event)
  balance.virtualBalance = balance.virtualBalance.plus(event.params.amount)
  balance.pushedAmount = balance.pushedAmount.plus(event.params.amount)
  balance.save()

  if (event.params.amount.isZero() && strategy.receiptToken == null) {
    strategy.receiptToken = balance.token
  } else if (!event.params.amount.isZero() && strategy.quoteToken == null) {
    strategy.quoteToken = balance.token
  }

  if (strategy.receiptToken == balance.token) {
    strategy.receiptVirtualBalance = balance.virtualBalance
    strategy.exposureAmount = balance.virtualBalance
  }
  if (strategy.quoteToken == balance.token) {
    strategy.quoteVirtualBalance = balance.virtualBalance
  }
  attachStrategyMarket(strategy, event)
  if (hadMarket) {
    updateStrategyMarketTotals(
      strategy,
      oldReceiptVirtualBalance,
      oldQuoteVirtualBalance,
      oldExposureAmount,
      strategy.quotePulledAmount,
      event
    )
  }
  strategy.save()
  snapshotStrategy(strategy, 'PUSHED', event)
}

export function handlePulled(event: Pulled): void {
  let protocol = loadProtocol(event)
  protocol.save()

  let strategy = loadStrategy(event.params.maker, event.params.app, event.params.strategyHash, event)
  let oldReceiptVirtualBalance = strategy.receiptVirtualBalance
  let oldQuoteVirtualBalance = strategy.quoteVirtualBalance
  let oldExposureAmount = strategy.exposureAmount
  let oldQuotePulledAmount = strategy.quotePulledAmount
  let balance = loadStrategyBalance(strategy, event.params.token, event)
  balance.virtualBalance = balance.virtualBalance.minus(event.params.amount)
  balance.pulledAmount = balance.pulledAmount.plus(event.params.amount)
  balance.save()

  if (strategy.quoteToken == balance.token) {
    strategy.quoteVirtualBalance = balance.virtualBalance
    strategy.quotePulledAmount = strategy.quotePulledAmount.plus(event.params.amount)
  }
  updateStrategyMarketTotals(
    strategy,
    oldReceiptVirtualBalance,
    oldQuoteVirtualBalance,
    oldExposureAmount,
    oldQuotePulledAmount,
    event
  )
  strategy.save()
  snapshotStrategy(strategy, 'PULLED', event)
}

function loadStrategyMarket(marketId: string, event: ethereum.Event): Market | null {
  let parts = marketId.split('-')
  if (parts.length != 2) return null
  let receiptToken = loadToken(Address.fromString(parts[0]))
  let quoteToken = loadToken(Address.fromString(parts[1]))
  return loadMarket(receiptToken, quoteToken, event)
}

function updateStrategyMarketTotals(
  strategy: ZubiDubiStrategy,
  oldReceiptVirtualBalance: BigInt,
  oldQuoteVirtualBalance: BigInt,
  oldExposureAmount: BigInt,
  oldQuotePulledAmount: BigInt,
  event: ethereum.Event
): void {
  if (strategy.market == null || strategy.receiptToken == null || strategy.quoteToken == null) return

  let receiptToken = loadToken(Address.fromString(strategy.receiptToken!))
  let quoteToken = loadToken(Address.fromString(strategy.quoteToken!))
  let market = loadMarket(receiptToken, quoteToken, event)
  market.totalVirtualReceipt = market.totalVirtualReceipt.minus(oldReceiptVirtualBalance).plus(strategy.receiptVirtualBalance)
  market.totalVirtualQuote = market.totalVirtualQuote.minus(oldQuoteVirtualBalance).plus(strategy.quoteVirtualBalance)
  market.totalReceiptExposure = market.totalReceiptExposure.minus(oldExposureAmount).plus(strategy.exposureAmount)
  market.totalQuotePulled = market.totalQuotePulled.minus(oldQuotePulledAmount).plus(strategy.quotePulledAmount)
  market.save()
}
