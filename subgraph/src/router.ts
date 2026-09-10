import { MakerExposure, Swap } from '../generated/schema'
import { Swapped } from '../generated/AquaSwapVMRouter/AquaSwapVMRouter'
import { eventId, exposureId, loadAccount, loadProtocol, loadStrategy, loadToken } from './entities'
import { ONE_BI, ZERO_BI } from './constants'

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

  strategy.exposureAmount = strategy.exposureAmount.plus(event.params.amountIn)
  strategy.quotePulledAmount = strategy.quotePulledAmount.plus(event.params.amountOut)
  strategy.save()
}

