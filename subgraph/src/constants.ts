import { Address, BigInt } from '@graphprotocol/graph-ts'

export const PROTOCOL_ID = 'zubidubi-sepolia'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ZERO_BI = BigInt.zero()
export const ONE_BI = BigInt.fromI32(1)
export const ONE_E18 = BigInt.fromString('1000000000000000000')

export const EXIT_RECEIPT = Address.fromString('0x1585b2f1C396Cd9295e58FC0B51c065Ad5d68c03')
export const USDC = Address.fromString('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238')
