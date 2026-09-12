import { OrderBudgetAssignment, MakerSkip, Route, RouteFee, RouteFeeAccrual, TermRiskBudget, TermRiskBudgetUse, ZubiDubiStrategy } from '../generated/schema'
import { ZubiDubiMakerSkipped, ZubiDubiOrderBudgetAssigned, ZubiDubiRouteFeePaid, ZubiDubiRouteFilled, ZubiDubiTermRiskBudgetSet, ZubiDubiTermRiskBudgetUsed } from '../generated/ZubiDubiRouteExecutor/ZubiDubiRouteExecutor'
import { eventId, loadAccount, loadMarket, loadProtocol, loadToken, strategyId } from './entities'
import { AQUA_SWAPVM_ROUTER } from './constants'
import { ONE_BI, ZERO_BI } from './constants'

export function handleRouteFilled(event: ZubiDubiRouteFilled): void {
  let protocol = loadProtocol(event)
  protocol.cumulativeRouteCount = protocol.cumulativeRouteCount.plus(ONE_BI)
  protocol.save()

  let taker = loadAccount(event.params.taker, event)
  taker.routeCount = taker.routeCount.plus(ONE_BI)
  taker.save()

  let recipient = loadAccount(event.params.recipient, event)
  recipient.save()

  let route = new Route(eventId(event))
  route.taker = taker.id
  route.recipient = recipient.id
  let tokenIn = loadToken(event.params.tokenIn)
  let tokenOut = loadToken(event.params.tokenOut)
  let market = loadMarket(tokenIn, tokenOut, event)
  market.routeCount = market.routeCount.plus(ONE_BI)
  let accrual = RouteFeeAccrual.load(event.transaction.hash.toHexString())
  if (accrual != null) {
    market.cumulativeProtocolSideRevenue = market.cumulativeProtocolSideRevenue.plus(accrual.amount)
  }
  market.save()

  route.market = market.id
  route.tokenIn = tokenIn.id
  route.tokenOut = tokenOut.id
  route.amountIn = event.params.amountIn
  route.netAmountOut = event.params.amountOut
  route.fills = event.params.fills
  route.feeAmount = accrual == null ? ZERO_BI : accrual.amount
  route.blockNumber = event.block.number
  route.timestamp = event.block.timestamp
  route.transactionHash = event.transaction.hash
  route.logIndex = event.logIndex
  route.save()

  if (accrual != null) {
    let fee = RouteFee.load(accrual.routeFee)
    if (fee != null) {
      fee.market = market.id
      fee.save()
    }
    accrual.save()
  }
}

export function handleRouteFeePaid(event: ZubiDubiRouteFeePaid): void {
  let protocol = loadProtocol(event)
  protocol.cumulativeProtocolSideRevenue = protocol.cumulativeProtocolSideRevenue.plus(event.params.amount)
  protocol.save()

  let feeRecipient = loadAccount(event.params.feeRecipient, event)
  feeRecipient.save()

  let tokenOut = loadToken(event.params.tokenOut)

  let fee = new RouteFee(eventId(event))
  fee.market = null
  fee.feeRecipient = feeRecipient.id
  fee.token = tokenOut.id
  fee.amount = event.params.amount
  fee.transactionHash = event.transaction.hash
  fee.blockNumber = event.block.number
  fee.timestamp = event.block.timestamp
  fee.logIndex = event.logIndex
  fee.save()

  let accrual = new RouteFeeAccrual(event.transaction.hash.toHexString())
  accrual.routeFee = fee.id
  accrual.token = tokenOut.id
  accrual.amount = event.params.amount
  accrual.save()
}

export function handleMakerSkipped(event: ZubiDubiMakerSkipped): void {
  let maker = loadAccount(event.params.maker, event)
  maker.save()

  let skip = new MakerSkip(eventId(event))
  skip.orderHash = event.params.orderHash
  skip.maker = maker.id
  skip.transactionHash = event.transaction.hash
  skip.blockNumber = event.block.number
  skip.timestamp = event.block.timestamp
  skip.logIndex = event.logIndex
  skip.save()
}

export function handleTermRiskBudgetSet(event: ZubiDubiTermRiskBudgetSet): void {
  let maker = loadAccount(event.params.maker, event)
  maker.save()

  let budgetId = budgetEntityId(event.params.maker.toHexString(), event.params.budgetId.toHexString())
  let budget = TermRiskBudget.load(budgetId)
  if (budget == null) {
    budget = new TermRiskBudget(budgetId)
    budget.maker = maker.id
    budget.budgetId = event.params.budgetId
    budget.receiptExposure = ZERO_BI
    budget.quoteSpent = ZERO_BI
    budget.assignmentCount = ZERO_BI
    budget.fillCount = ZERO_BI
  }

  budget.maxReceiptExposure = event.params.maxReceiptExposure
  budget.maxQuoteSpend = event.params.maxQuoteSpend
  budget.pressurePenaltyBps = event.params.pressurePenaltyBps
  budget.lastUpdatedBlock = event.block.number
  budget.lastUpdatedTimestamp = event.block.timestamp
  budget.save()
}

export function handleOrderBudgetAssigned(event: ZubiDubiOrderBudgetAssigned): void {
  let maker = loadAccount(event.params.maker, event)
  maker.save()

  let budgetId = budgetEntityId(event.params.maker.toHexString(), event.params.budgetId.toHexString())
  let budget = TermRiskBudget.load(budgetId)
  if (budget == null) {
    budget = new TermRiskBudget(budgetId)
    budget.maker = maker.id
    budget.budgetId = event.params.budgetId
    budget.maxReceiptExposure = ZERO_BI
    budget.maxQuoteSpend = ZERO_BI
    budget.receiptExposure = ZERO_BI
    budget.quoteSpent = ZERO_BI
    budget.pressurePenaltyBps = ZERO_BI
    budget.assignmentCount = ZERO_BI
    budget.fillCount = ZERO_BI
  }
  budget.assignmentCount = budget.assignmentCount.plus(ONE_BI)
  budget.lastUpdatedBlock = event.block.number
  budget.lastUpdatedTimestamp = event.block.timestamp
  budget.save()

  let receiptToken = loadToken(event.params.receiptToken)
  let quoteToken = loadToken(event.params.quoteToken)

  let strategy = ZubiDubiStrategy.load(strategyId(event.params.maker, AQUA_SWAPVM_ROUTER, event.params.orderHash))
  if (strategy != null) {
    strategy.budget = budget.id
    strategy.save()
  }

  let assignment = OrderBudgetAssignment.load(event.params.orderHash.toHexString())
  if (assignment == null) {
    assignment = new OrderBudgetAssignment(event.params.orderHash.toHexString())
  }
  assignment.orderHash = event.params.orderHash
  assignment.strategy = strategy == null ? null : strategy.id
  assignment.maker = maker.id
  assignment.budget = budget.id
  assignment.receiptToken = receiptToken.id
  assignment.quoteToken = quoteToken.id
  assignment.assignedAtBlock = event.block.number
  assignment.assignedAtTimestamp = event.block.timestamp
  assignment.transactionHash = event.transaction.hash
  assignment.save()
}

export function handleTermRiskBudgetUsed(event: ZubiDubiTermRiskBudgetUsed): void {
  let maker = loadAccount(event.params.maker, event)
  maker.save()

  let budgetId = budgetEntityId(event.params.maker.toHexString(), event.params.budgetId.toHexString())
  let budget = TermRiskBudget.load(budgetId)
  if (budget == null) {
    budget = new TermRiskBudget(budgetId)
    budget.maker = maker.id
    budget.budgetId = event.params.budgetId
    budget.maxReceiptExposure = ZERO_BI
    budget.maxQuoteSpend = ZERO_BI
    budget.assignmentCount = ZERO_BI
    budget.pressurePenaltyBps = ZERO_BI
  }
  budget.receiptExposure = event.params.receiptExposure
  budget.quoteSpent = event.params.quoteSpent
  budget.fillCount = budget.fillCount.plus(ONE_BI)
  budget.lastUpdatedBlock = event.block.number
  budget.lastUpdatedTimestamp = event.block.timestamp
  budget.save()

  let strategy = ZubiDubiStrategy.load(strategyId(event.params.maker, AQUA_SWAPVM_ROUTER, event.params.orderHash))

  let use = new TermRiskBudgetUse(eventId(event))
  use.maker = maker.id
  use.budget = budget.id
  use.orderHash = event.params.orderHash
  use.strategy = strategy == null ? null : strategy.id
  use.fillIn = event.params.fillIn
  use.amountOut = event.params.amountOut
  use.receiptExposure = event.params.receiptExposure
  use.quoteSpent = event.params.quoteSpent
  use.transactionHash = event.transaction.hash
  use.blockNumber = event.block.number
  use.timestamp = event.block.timestamp
  use.logIndex = event.logIndex
  use.save()
}

function budgetEntityId(maker: string, budgetId: string): string {
  return maker + '-' + budgetId
}
