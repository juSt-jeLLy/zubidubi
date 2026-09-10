import { Address, BigInt } from '@graphprotocol/graph-ts'

export const PROTOCOL_ID = 'zubidubi-sepolia'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ZERO_BI = BigInt.zero()
export const ONE_BI = BigInt.fromI32(1)
export const ONE_E18 = BigInt.fromString('1000000000000000000')

export const EXIT_RECEIPT = Address.fromString('0x8a0d1a9df2808a35eea759905baf7bf121bac4e1')
export const USDC = Address.fromString('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238')
