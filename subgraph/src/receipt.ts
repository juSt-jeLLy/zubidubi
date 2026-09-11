import { Address, BigInt } from '@graphprotocol/graph-ts'
import { ReceiptAsset } from '../generated/schema'
import { Transfer, ZubiDubiExitReceipt } from '../generated/ZubiDubiExitReceipt/ZubiDubiExitReceipt'
import { loadToken } from './entities'
import {
  EXIT_RECEIPT,
  EXIT_RECEIPT_MATURITY,
  LINK,
  ONE_E18,
  PT_180D_MATURITY,
  PT_30D_MATURITY,
  PT_ZBETH_180D,
  PT_ZBETH_30D,
  PT_ZBLINK_180D,
  PT_ZBLINK_30D,
  PT_ZBUSD_180D,
  PT_ZBUSD_30D,
  USDC,
  WETH,
  ZERO_ADDRESS,
  ZERO_BI,
} from './constants'

export function handleReceiptTransfer(event: Transfer): void {
  let token = loadToken(event.address)
  token.isReceipt = true
  token.save()

  let receipt = ReceiptAsset.load(event.address.toHexString())
  if (receipt == null) {
    receipt = new ReceiptAsset(event.address.toHexString())
    receipt.token = token.id

    receipt.underlying = knownUnderlying(event.address)
    receipt.maturity = knownMaturity(event.address)
    receipt.assetsPerReceipt = knownAssetsPerReceipt(event.address)

    if (receipt.maturity.isZero()) {
      let contract = ZubiDubiExitReceipt.bind(event.address)
      let underlying = contract.try_underlying()
      let maturity = contract.try_maturity()
      let assetsPerReceipt = contract.try_assetsPerReceipt()

      receipt.underlying = underlying.reverted ? Address.zero() : underlying.value
      receipt.maturity = maturity.reverted ? ZERO_BI : maturity.value
      receipt.assetsPerReceipt = assetsPerReceipt.reverted ? ZERO_BI : assetsPerReceipt.value
    }
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

function knownUnderlying(address: Address): Address {
  if (address.equals(EXIT_RECEIPT) || address.equals(PT_ZBETH_30D) || address.equals(PT_ZBETH_180D)) return WETH
  if (address.equals(PT_ZBUSD_30D) || address.equals(PT_ZBUSD_180D)) return USDC
  if (address.equals(PT_ZBLINK_30D) || address.equals(PT_ZBLINK_180D)) return LINK
  return Address.zero()
}

function knownAssetsPerReceipt(address: Address): BigInt {
  if (address.equals(PT_ZBUSD_30D) || address.equals(PT_ZBUSD_180D)) return BigInt.fromI32(1000000)
  if (isReceiptAddress(address)) return ONE_E18
  return ZERO_BI
}

function knownMaturity(address: Address): BigInt {
  if (address.equals(EXIT_RECEIPT)) return EXIT_RECEIPT_MATURITY
  if (address.equals(PT_ZBETH_30D) || address.equals(PT_ZBUSD_30D) || address.equals(PT_ZBLINK_30D)) return PT_30D_MATURITY
  if (address.equals(PT_ZBETH_180D) || address.equals(PT_ZBUSD_180D) || address.equals(PT_ZBLINK_180D)) return PT_180D_MATURITY
  return ZERO_BI
}

function isReceiptAddress(address: Address): boolean {
  return address.equals(EXIT_RECEIPT) ||
    address.equals(PT_ZBETH_30D) ||
    address.equals(PT_ZBETH_180D) ||
    address.equals(PT_ZBUSD_30D) ||
    address.equals(PT_ZBUSD_180D) ||
    address.equals(PT_ZBLINK_30D) ||
    address.equals(PT_ZBLINK_180D)
}
