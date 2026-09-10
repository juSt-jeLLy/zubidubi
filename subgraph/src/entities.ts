import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { Account, Protocol, StrategyBalance, Token, ZubiDubiStrategy } from '../generated/schema'
import { ZubiDubiExitReceipt } from '../generated/ZubiDubiExitReceipt/ZubiDubiExitReceipt'
import { ONE_BI, PROTOCOL_ID, USDC, ZERO_BI } from './constants'

export function eventId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
}

export function strategyId(maker: Address, app: Address, strategyHash: Bytes): string {
  return maker.toHexString() + '-' + app.toHexString() + '-' + strategyHash.toHexString()
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
    protocol.subgraphVersion = '0.1.0'
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
    token.isReceipt = address.equals(Address.fromString('0x9c99F37e5Ad3F974eeb5a50F929EEa9fa70D3581'))
    token.save()
  }
  return token
}

export function loadStrategy(maker: Address, app: Address, strategyHash: Bytes, event: ethereum.Event): ZubiDubiStrategy {
  let id = strategyId(maker, app, strategyHash)
  let strategy = ZubiDubiStrategy.load(id)
  if (strategy == null) {
    strategy = new ZubiDubiStrategy(id)
    strategy.maker = loadAccount(maker, event).id
    strategy.app = app
    strategy.orderHash = strategyHash
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

export function loadStrategyBalance(strategy: ZubiDubiStrategy, tokenAddress: Address, event: ethereum.Event): StrategyBalance {
  let token = loadToken(tokenAddress)
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

export function symbolFor(address: Address): string {
  if (address.equals(USDC)) return 'USDC'
  let receipt = ZubiDubiExitReceipt.bind(address)
  let symbol = receipt.try_symbol()
  if (!symbol.reverted) return symbol.value
  return 'UNKNOWN'
}

export function decimalsFor(address: Address): i32 {
  if (address.equals(USDC)) return 6
  let receipt = ZubiDubiExitReceipt.bind(address)
  let decimals = receipt.try_decimals()
  if (!decimals.reverted) return decimals.value
  return 18
}

