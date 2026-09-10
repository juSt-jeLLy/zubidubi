import { Docked, Pulled, Pushed, Shipped } from '../generated/Aqua/Aqua'
import { loadAccount, loadProtocol, loadStrategy, loadStrategyBalance } from './entities'
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
  strategy.save()
}

export function handleDocked(event: Docked): void {
  let protocol = loadProtocol(event)
  protocol.save()

  let strategy = loadStrategy(event.params.maker, event.params.app, event.params.strategyHash, event)
  strategy.status = 'DOCKED'
  strategy.save()
}

export function handlePushed(event: Pushed): void {
  let protocol = loadProtocol(event)
  protocol.save()

  let strategy = loadStrategy(event.params.maker, event.params.app, event.params.strategyHash, event)
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
  strategy.save()
}

export function handlePulled(event: Pulled): void {
  let protocol = loadProtocol(event)
  protocol.save()

  let strategy = loadStrategy(event.params.maker, event.params.app, event.params.strategyHash, event)
  let balance = loadStrategyBalance(strategy, event.params.token, event)
  balance.virtualBalance = balance.virtualBalance.minus(event.params.amount)
  balance.pulledAmount = balance.pulledAmount.plus(event.params.amount)
  balance.save()

  if (strategy.quoteToken == balance.token) {
    strategy.quoteVirtualBalance = balance.virtualBalance
    strategy.quotePulledAmount = strategy.quotePulledAmount.plus(event.params.amount)
  }
  strategy.save()
}

