import { Address, BigInt } from '@graphprotocol/graph-ts'

export const PROTOCOL_ID = 'zubidubi-sepolia'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ZERO_BI = BigInt.zero()
export const ONE_BI = BigInt.fromI32(1)
export const ONE_E18 = BigInt.fromString('1000000000000000000')

export const USDC = Address.fromString('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238')
export const EXIT_RECEIPT = Address.fromString('0xb7877571932a025e03a7b9616f254b361fd1759f')
export const PT_ZBETH_30D = Address.fromString('0x78890cd804f902e2bbd84a6984130423879be45b')
export const PT_ZBETH_60D = Address.fromString('0xd49f34d689c79e5a25d674ab684f33873a514d96')
export const PT_ZBETH_90D = Address.fromString('0xa35cbae88c35b4f06a9992942e889a82388d2ac8')
export const PT_ZBETH_180D = Address.fromString('0x680bc9cd0005461a95c75f4a1d3cbaddc7104cab')
export const PT_ZBETH_360D = Address.fromString('0x4f7c1919aabc995f41ad12cfae25ebf638e8ade4')

export const WETH = Address.fromString('0xfff9976782d46cc05630d1f6ebab18b2324d6b14')

export const EXIT_RECEIPT_MATURITY = BigInt.fromI32(1791643032)
export const PT_ZBETH_30D_MATURITY = BigInt.fromI32(1791650376)
export const PT_ZBETH_60D_MATURITY = BigInt.fromI32(1794242376)
export const PT_ZBETH_90D_MATURITY = BigInt.fromI32(1796834376)
export const PT_ZBETH_180D_MATURITY = BigInt.fromI32(1804610376)
export const PT_ZBETH_360D_MATURITY = BigInt.fromI32(1820162376)
