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
    )
  }
}
