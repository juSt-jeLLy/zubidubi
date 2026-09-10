import { BigInt } from '@graphprotocol/graph-ts'
import { MakerExposure, RouteFill, Swap, Token } from '../generated/schema'
import { Swapped } from '../generated/AquaSwapVMRouter/AquaSwapVMRouter'
import { eventId, exposureId, loadAccount, loadMarket, loadProtocol, loadStrategy, loadToken, snapshotStrategy } from './entities'
import { ONE_BI, ONE_E18, ZERO_BI } from './constants'

export function handleSwapped(event: Swapped): void {
  let protocol = loadProtocol(event)
  protocol.cumulativeSwapCount = protocol.cumulativeSwapCount.plus(ONE_BI)
  protocol.cumulativeVolumeIn = protocol.cumulativeVolumeIn.plus(event.params.amountIn)
  protocol.cumulativeVolumeOut = protocol.cumulativeVolumeOut.plus(event.params.amountOut)
  protocol.save()

  let maker = loadAccount(event.params.maker, event)
  maker.swapCount = maker.swapCount.plus(ONE_BI)
  maker.save()

  let taker = loadAccount(event.params.taker, event)
  taker.swapCount = taker.swapCount.plus(ONE_BI)
  taker.save()

  let tokenIn = loadToken(event.params.tokenIn)
  let tokenOut = loadToken(event.params.tokenOut)
  let strategy = loadStrategy(event.params.maker, event.address, event.params.orderHash, event)

  let swap = new Swap(eventId(event))
  swap.orderHash = event.params.orderHash
  swap.strategy = strategy.id
  swap.maker = maker.id
  swap.taker = taker.id
  swap.tokenIn = tokenIn.id
  swap.tokenOut = tokenOut.id
  swap.amountIn = event.params.amountIn
  swap.amountOut = event.params.amountOut
  swap.blockNumber = event.block.number
  swap.timestamp = event.block.timestamp
  swap.transactionHash = event.transaction.hash
  swap.logIndex = event.logIndex
  swap.save()

  let fill = new RouteFill(eventId(event))
  fill.routeTransactionHash = event.transaction.hash
  fill.orderHash = event.params.orderHash
  fill.strategy = strategy.id
  fill.market = strategy.market
  fill.maker = maker.id
  fill.taker = taker.id
  fill.tokenIn = tokenIn.id
  fill.tokenOut = tokenOut.id
  fill.amountIn = event.params.amountIn
  fill.amountOut = event.params.amountOut
  fill.executionPriceE18 = priceE18(event.params.amountIn, event.params.amountOut, tokenIn, tokenOut)
  fill.blockNumber = event.block.number
  fill.timestamp = event.block.timestamp
  fill.logIndex = event.logIndex
  fill.save()

  let market = loadMarket(tokenIn, tokenOut, event)
  market.swapCount = market.swapCount.plus(ONE_BI)
  market.cumulativeVolumeIn = market.cumulativeVolumeIn.plus(event.params.amountIn)
  market.cumulativeVolumeOut = market.cumulativeVolumeOut.plus(event.params.amountOut)
  market.save()

  let exposure = MakerExposure.load(exposureId(event.params.maker, event.params.tokenIn))
  if (exposure == null) {
    exposure = new MakerExposure(exposureId(event.params.maker, event.params.tokenIn))
    exposure.maker = maker.id
    exposure.receiptToken = tokenIn.id
    exposure.amount = ZERO_BI
    exposure.swapCount = ZERO_BI
  }
  exposure.amount = exposure.amount.plus(event.params.amountIn)
  exposure.swapCount = exposure.swapCount.plus(ONE_BI)
  exposure.lastUpdatedBlock = event.block.number
  exposure.lastUpdatedTimestamp = event.block.timestamp
  exposure.save()

  strategy.save()
  snapshotStrategy(strategy, 'SWAPPED', event)
}

function priceE18(amountIn: BigInt, amountOut: BigInt, tokenIn: Token, tokenOut: Token): BigInt {
  if (amountIn.isZero()) return ZERO_BI
  let inScale = BigInt.fromI32(10).pow(tokenIn.decimals as u8)
  let outScale = BigInt.fromI32(10).pow(tokenOut.decimals as u8)
  return amountOut.times(ONE_E18).times(inScale).div(amountIn).div(outScale)
}
