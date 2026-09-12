import { Address, BigInt } from '@graphprotocol/graph-ts'

export const PROTOCOL_ID = 'zubidubi-sepolia'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ZERO_BI = BigInt.zero()
export const ONE_BI = BigInt.fromI32(1)
export const ONE_E18 = BigInt.fromString('1000000000000000000')

export const USDC = Address.fromString('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238')
export const WETH = Address.fromString('0xfff9976782d46cc05630d1f6ebab18b2324d6b14')
export const LINK = Address.fromString('0x779877a7b0d9e8603169ddbd7836e478b4624789')
export const AQUA_SWAPVM_ROUTER = Address.fromString('0x3d39b155de93cb9c340577e06b801c4956ed2a57')
export const EXIT_RECEIPT = Address.fromString('0xb7877571932a025e03a7b9616f254b361fd1759f')
export const PT_ZBETH_30D = Address.fromString('0xc53c8d1ffbbb502e1a9004a93ea33adc2039f513')
export const PT_ZBETH_180D = Address.fromString('0x4ef8c0e1a313dff9c25512fb6df10c871879a029')
export const PT_ZBUSD_30D = Address.fromString('0xa6d3a922aa36b37cd9e3fb7a0436ac7df310ae57')
export const PT_ZBUSD_180D = Address.fromString('0x4bd685da37569691cc7427b7ce509a23bc70b044')
export const PT_ZBLINK_30D = Address.fromString('0x6d6fdf4d13d2b440cfbfd464a11c55af05964e96')
export const PT_ZBLINK_180D = Address.fromString('0x5e34350a960911490b9d78f3424bb4303ef29757')

export const EXIT_RECEIPT_MATURITY = BigInt.fromI32(1791643032)
export const PT_30D_MATURITY = BigInt.fromI32(1791669240)
export const PT_180D_MATURITY = BigInt.fromI32(1804629240)
