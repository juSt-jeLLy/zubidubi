import { Address } from '@graphprotocol/graph-ts'
import { ReceiptAsset } from '../generated/schema'
import { Transfer, ZubiDubiExitReceipt } from '../generated/ZubiDubiExitReceipt/ZubiDubiExitReceipt'
import { loadToken } from './entities'
import { ZERO_ADDRESS, ZERO_BI } from './constants'

export function handleReceiptTransfer(event: Transfer): void {
  let token = loadToken(event.address)
  token.isReceipt = true
  token.save()

  let receipt = ReceiptAsset.load(event.address.toHexString())
  if (receipt == null) {
    receipt = new ReceiptAsset(event.address.toHexString())
    receipt.token = token.id

    let contract = ZubiDubiExitReceipt.bind(event.address)
    let underlying = contract.try_underlying()
    let maturity = contract.try_maturity()
    let assetsPerReceipt = contract.try_assetsPerReceipt()

    receipt.underlying = underlying.reverted ? Address.zero() : underlying.value
    receipt.maturity = maturity.reverted ? ZERO_BI : maturity.value
    receipt.assetsPerReceipt = assetsPerReceipt.reverted ? ZERO_BI : assetsPerReceipt.value
    receipt.totalMinted = ZERO_BI
    receipt.totalBurned = ZERO_BI
  }

  if (event.params.from.toHexString() == ZERO_ADDRESS) {
    receipt.totalMinted = receipt.totalMinted.plus(event.params.value)
  }
  if (event.params.to.toHexString() == ZERO_ADDRESS) {
    receipt.totalBurned = receipt.totalBurned.plus(event.params.value)
  }

  receipt.lastUpdatedBlock = event.block.number
  receipt.lastUpdatedTimestamp = event.block.timestamp
  receipt.save()
}
