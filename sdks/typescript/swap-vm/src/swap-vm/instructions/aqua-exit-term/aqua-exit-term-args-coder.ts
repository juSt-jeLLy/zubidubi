// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { BytesBuilder, BytesIter } from '@1inch/byte-utils'
import { Address, HexString } from '@1inch/sdk-core'
import { AquaExitTermArgs } from './aqua-exit-term-args'
import type { IArgsCoder } from '../types'

export class AquaExitTermArgsCoder implements IArgsCoder<AquaExitTermArgs> {
  encode(args: AquaExitTermArgs): HexString {
    const builder = new BytesBuilder()
    builder.addUint32(args.baseDiscountBps)
    builder.addUint32(args.annualRateBps)
    builder.addUint32(args.maxDiscountBps)
    builder.addUint40(args.maturity)
    builder.addUint32(args.maxStaleness)
    builder.addUint8(args.tokenInDecimals)
    builder.addUint8(args.tokenOutDecimals)
    builder.addUint8(args.oracleDecimals)
    builder.addAddress(args.oracleAddress.toString())
    builder.addBytes(uint128Hex(args.maxExposure))
    builder.addUint32(args.inventorySlopeBps)
    builder.addBytes(uint128Hex(args.maxNotionalOut))
    builder.addUint32(args.liquiditySlopeBps)
    builder.addUint32(args.riskTierBps)
    builder.addUint40(args.minMaturity)
    builder.addUint40(args.maxMaturity)
    builder.addAddress(args.allowedTokenIn.toString())
    builder.addAddress(args.allowedTokenOut.toString())

    return new HexString(builder.asHex())
  }

  decode(data: HexString): AquaExitTermArgs {
    const iter = BytesIter.HexString(data.toString())
    const baseDiscountBps = iter.nextUint32()
    const annualRateBps = iter.nextUint32()
    const maxDiscountBps = iter.nextUint32()
    const maturity = iter.nextUint40()
    const maxStaleness = iter.nextUint32()
    const tokenInDecimals = iter.nextUint8()
    const tokenOutDecimals = iter.nextUint8()
    const oracleDecimals = iter.nextUint8()
    const oracleAddress = new Address(iter.nextAddress())
    const maxExposure = BigInt(iter.nextBytes(16))
    const inventorySlopeBps = iter.nextUint32()
    const maxNotionalOut = BigInt(iter.nextBytes(16))
    const liquiditySlopeBps = iter.nextUint32()
    const riskTierBps = iter.nextUint32()
    const minMaturity = iter.nextUint40()
    const maxMaturity = iter.nextUint40()
    const allowedTokenIn = new Address(iter.nextAddress())
    const allowedTokenOut = new Address(iter.nextAddress())

    return new AquaExitTermArgs(
      BigInt(baseDiscountBps),
      BigInt(annualRateBps),
      BigInt(maxDiscountBps),
      BigInt(maturity),
      BigInt(maxStaleness),
      BigInt(tokenInDecimals),
      BigInt(tokenOutDecimals),
      BigInt(oracleDecimals),
      oracleAddress,
      maxExposure,
      BigInt(inventorySlopeBps),
      maxNotionalOut,
      BigInt(liquiditySlopeBps),
      BigInt(riskTierBps),
      BigInt(minMaturity),
      BigInt(maxMaturity),
      allowedTokenIn,
      allowedTokenOut,
    )
  }
}

function uint128Hex(value: bigint): string {
  return `0x${value.toString(16).padStart(32, '0')}`
}
