import { MakerSkip, Route, RouteFee, RouteFeeAccrual } from '../generated/schema'
import { ZubiDubiMakerSkipped, ZubiDubiRouteFeePaid, ZubiDubiRouteFilled } from '../generated/ZubiDubiRouteExecutor/ZubiDubiRouteExecutor'
import { eventId, loadAccount, loadMarket, loadProtocol, loadToken } from './entities'
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
