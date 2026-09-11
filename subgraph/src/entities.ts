import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { Account, Market, Protocol, ReceiptAsset, StrategyBalance, StrategySnapshot, Token, ZubiDubiStrategy } from '../generated/schema'
import { ZubiDubiExitReceipt } from '../generated/ZubiDubiExitReceipt/ZubiDubiExitReceipt'
import {
  EXIT_RECEIPT,
  EXIT_RECEIPT_MATURITY,
  ONE_E18,
  ONE_BI,
  PROTOCOL_ID,
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
  LINK,
  ZERO_BI,
} from './constants'

export function eventId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
}

export function strategyId(maker: Address, app: Address, strategyHash: Bytes): string {
  return maker.toHexString() + '-' + app.toHexString() + '-' + strategyHash.toHexString()
}

export function marketId(receiptToken: string, quoteToken: string): string {
  return receiptToken + '-' + quoteToken
}

export function balanceId(strategy: ZubiDubiStrategy, token: Address): string {
  return strategy.id + '-' + token.toHexString()
}

export function exposureId(maker: Address, token: Address): string {
  return maker.toHexString() + '-' + token.toHexString()
}

export function loadProtocol(event: ethereum.Event): Protocol {
  let protocol = Protocol.load(PROTOCOL_ID)
  if (protocol == null) {
    protocol = new Protocol(PROTOCOL_ID)
    protocol.name = 'ZubiDubi'
    protocol.slug = 'zubidubi'
    protocol.network = 'sepolia'
    protocol.schemaVersion = '1.0.2-compatible'
    protocol.subgraphVersion = '0.9.2'
    protocol.methodologyVersion = '0.1.0'
    protocol.cumulativeStrategyCount = ZERO_BI
    protocol.cumulativeSwapCount = ZERO_BI
    protocol.cumulativeRouteCount = ZERO_BI
    protocol.cumulativeUniqueUsers = ZERO_BI
    protocol.cumulativeVolumeIn = ZERO_BI
    protocol.cumulativeVolumeOut = ZERO_BI
    protocol.cumulativeProtocolSideRevenue = ZERO_BI
  }
  protocol.lastUpdatedBlock = event.block.number
  protocol.lastUpdatedTimestamp = event.block.timestamp
  return protocol
}

export function loadAccount(address: Address, event: ethereum.Event): Account {
  let id = address.toHexString()
  let account = Account.load(id)
  if (account == null) {
    account = new Account(id)
    account.swapCount = ZERO_BI
    account.routeCount = ZERO_BI
    account.strategyCount = ZERO_BI
    account.firstSeenTimestamp = event.block.timestamp

    let protocol = loadProtocol(event)
    protocol.cumulativeUniqueUsers = protocol.cumulativeUniqueUsers.plus(ONE_BI)
    protocol.save()
  }
  account.lastSeenTimestamp = event.block.timestamp
  return account
}

export function loadToken(address: Address): Token {
  let id = address.toHexString()
  let token = Token.load(id)
  if (token == null) {
    token = new Token(id)
    token.symbol = symbolFor(address)
    token.name = token.symbol
    token.decimals = decimalsFor(address)
    token.isReceipt = isKnownReceipt(address)
    token.save()
  }
  return token
}

export function loadMarket(receiptToken: Token, quoteToken: Token, event: ethereum.Event): Market {
  let id = marketId(receiptToken.id, quoteToken.id)
  let market = Market.load(id)
  if (market == null) {
    market = new Market(id)
    market.receiptToken = receiptToken.id
    market.quoteToken = quoteToken.id
    market.totalStrategyCount = ZERO_BI
    market.activeStrategyCount = ZERO_BI
    market.totalVirtualReceipt = ZERO_BI
    market.totalVirtualQuote = ZERO_BI
    market.totalReceiptExposure = ZERO_BI
    market.totalQuotePulled = ZERO_BI
    market.swapCount = ZERO_BI
    market.routeCount = ZERO_BI
    market.cumulativeVolumeIn = ZERO_BI
    market.cumulativeVolumeOut = ZERO_BI
    market.cumulativeProtocolSideRevenue = ZERO_BI
  }
  market.lastUpdatedBlock = event.block.number
  market.lastUpdatedTimestamp = event.block.timestamp
  return market
}

export function loadStrategy(maker: Address, app: Address, strategyHash: Bytes, event: ethereum.Event): ZubiDubiStrategy {
  let id = strategyId(maker, app, strategyHash)
  let strategy = ZubiDubiStrategy.load(id)
  if (strategy == null) {
    strategy = new ZubiDubiStrategy(id)
    strategy.maker = loadAccount(maker, event).id
    strategy.app = app
    strategy.orderHash = strategyHash
    strategy.market = null
    strategy.strategyData = Bytes.empty()
    strategy.status = 'ACTIVE'
    strategy.receiptVirtualBalance = ZERO_BI
    strategy.quoteVirtualBalance = ZERO_BI
    strategy.exposureAmount = ZERO_BI
    strategy.quotePulledAmount = ZERO_BI
    strategy.createdAtBlock = event.block.number
    strategy.createdAtTimestamp = event.block.timestamp
  }
  strategy.updatedAtBlock = event.block.number
  strategy.updatedAtTimestamp = event.block.timestamp
  return strategy
}

export function attachStrategyMarket(strategy: ZubiDubiStrategy, event: ethereum.Event): void {
  if (strategy.market != null || strategy.receiptToken == null || strategy.quoteToken == null) return

  let receiptToken = Token.load(strategy.receiptToken!)
  let quoteToken = Token.load(strategy.quoteToken!)
  if (receiptToken == null || quoteToken == null) return

  let market = loadMarket(receiptToken, quoteToken, event)
  market.totalStrategyCount = market.totalStrategyCount.plus(ONE_BI)
  market.activeStrategyCount = market.activeStrategyCount.plus(ONE_BI)
  market.totalVirtualReceipt = market.totalVirtualReceipt.plus(strategy.receiptVirtualBalance)
  market.totalVirtualQuote = market.totalVirtualQuote.plus(strategy.quoteVirtualBalance)
  market.totalReceiptExposure = market.totalReceiptExposure.plus(strategy.exposureAmount)
  market.totalQuotePulled = market.totalQuotePulled.plus(strategy.quotePulledAmount)
  market.save()

  strategy.market = market.id
}

export function snapshotStrategy(strategy: ZubiDubiStrategy, reason: string, event: ethereum.Event): void {
  let snapshot = new StrategySnapshot(eventId(event) + '-' + reason)
  snapshot.strategy = strategy.id
  snapshot.market = strategy.market
  snapshot.receiptVirtualBalance = strategy.receiptVirtualBalance
  snapshot.quoteVirtualBalance = strategy.quoteVirtualBalance
  snapshot.exposureAmount = strategy.exposureAmount
  snapshot.quotePulledAmount = strategy.quotePulledAmount
  snapshot.status = strategy.status
  snapshot.reason = reason
  snapshot.blockNumber = event.block.number
  snapshot.timestamp = event.block.timestamp
  snapshot.transactionHash = event.transaction.hash
  snapshot.logIndex = event.logIndex
  snapshot.save()
}

export function loadStrategyBalance(strategy: ZubiDubiStrategy, tokenAddress: Address, event: ethereum.Event): StrategyBalance {
  let token = loadToken(tokenAddress)
  if (token.isReceipt) ensureReceiptAsset(tokenAddress, token, event)
  let id = balanceId(strategy, tokenAddress)
  let balance = StrategyBalance.load(id)
  if (balance == null) {
    balance = new StrategyBalance(id)
    balance.strategy = strategy.id
    balance.token = token.id
    balance.virtualBalance = ZERO_BI
    balance.pushedAmount = ZERO_BI
    balance.pulledAmount = ZERO_BI
  }
  balance.updatedAtBlock = event.block.number
  balance.updatedAtTimestamp = event.block.timestamp
  return balance
}

function ensureReceiptAsset(address: Address, token: Token, event: ethereum.Event): void {
  let id = address.toHexString()
  let receipt = ReceiptAsset.load(id)
  if (receipt != null) return

  receipt = new ReceiptAsset(id)
  receipt.token = token.id
  receipt.underlying = knownUnderlying(address)
  receipt.maturity = knownMaturity(address)
  receipt.assetsPerReceipt = knownAssetsPerReceipt(address)
  receipt.totalMinted = ZERO_BI
  receipt.totalBurned = ZERO_BI
  receipt.lastUpdatedBlock = event.block.number
  receipt.lastUpdatedTimestamp = event.block.timestamp
  receipt.save()
}

export function symbolFor(address: Address): string {
  if (address.equals(USDC)) return 'USDC'
  if (address.equals(WETH)) return 'WETH'
  if (address.equals(LINK)) return 'LINK'
  if (address.equals(EXIT_RECEIPT)) return 'PT-zbETH'
  if (address.equals(PT_ZBETH_30D)) return 'PT-zbETH-30D'
  if (address.equals(PT_ZBETH_180D)) return 'PT-zbETH-180D'
  if (address.equals(PT_ZBUSD_30D)) return 'PT-zbUSD-30D'
  if (address.equals(PT_ZBUSD_180D)) return 'PT-zbUSD-180D'
  if (address.equals(PT_ZBLINK_30D)) return 'PT-zbLINK-30D'
  if (address.equals(PT_ZBLINK_180D)) return 'PT-zbLINK-180D'
  let receipt = ZubiDubiExitReceipt.bind(address)
  let symbol = receipt.try_symbol()
  if (!symbol.reverted) return symbol.value
  return 'UNKNOWN'
}

export function decimalsFor(address: Address): i32 {
  if (address.equals(USDC)) return 6
  if (address.equals(WETH) || address.equals(LINK)) return 18
  if (isKnownReceipt(address)) return 18
  let receipt = ZubiDubiExitReceipt.bind(address)
  let decimals = receipt.try_decimals()
  if (!decimals.reverted) return decimals.value
  return 18
}

export function isKnownReceipt(address: Address): boolean {
  return address.equals(EXIT_RECEIPT) ||
    address.equals(PT_ZBETH_30D) ||
    address.equals(PT_ZBETH_180D) ||
    address.equals(PT_ZBUSD_30D) ||
    address.equals(PT_ZBUSD_180D) ||
    address.equals(PT_ZBLINK_30D) ||
    address.equals(PT_ZBLINK_180D)
}

function knownUnderlying(address: Address): Address {
  if (address.equals(EXIT_RECEIPT) || address.equals(PT_ZBETH_30D) || address.equals(PT_ZBETH_180D)) return WETH
  if (address.equals(PT_ZBUSD_30D) || address.equals(PT_ZBUSD_180D)) return USDC
  if (address.equals(PT_ZBLINK_30D) || address.equals(PT_ZBLINK_180D)) return LINK
  return Address.zero()
}

function knownMaturity(address: Address): BigInt {
  if (address.equals(EXIT_RECEIPT)) return EXIT_RECEIPT_MATURITY
  if (address.equals(PT_ZBETH_30D) || address.equals(PT_ZBUSD_30D) || address.equals(PT_ZBLINK_30D)) return PT_30D_MATURITY
  if (address.equals(PT_ZBETH_180D) || address.equals(PT_ZBUSD_180D) || address.equals(PT_ZBLINK_180D)) return PT_180D_MATURITY
  return ZERO_BI
}

function knownAssetsPerReceipt(address: Address): BigInt {
  if (address.equals(PT_ZBUSD_30D) || address.equals(PT_ZBUSD_180D)) return BigInt.fromI32(1000000)
  if (isKnownReceipt(address)) return ONE_E18
  return ZERO_BI
}
