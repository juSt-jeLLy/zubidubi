// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import type { Address, HexString } from '@1inch/sdk-core'
import { UINT_8_MAX, UINT_32_MAX, UINT_40_MAX } from '@1inch/byte-utils'
import assert from 'assert'
import { AquaExitTermArgsCoder } from './aqua-exit-term-args-coder'
import type { IArgsCoder, IArgsData } from '../types'

export class AquaExitTermArgs implements IArgsData {
  public static readonly CODER: IArgsCoder<AquaExitTermArgs> = new AquaExitTermArgsCoder()

  constructor(
    public readonly baseDiscountBps: bigint,
    public readonly annualRateBps: bigint,
    public readonly maxDiscountBps: bigint,
    public readonly maturity: bigint,
    public readonly maxStaleness: bigint,
    public readonly tokenInDecimals: bigint,
    public readonly tokenOutDecimals: bigint,
    public readonly oracleDecimals: bigint,
    public readonly oracleAddress: Address,
  ) {
    assert(
      baseDiscountBps >= 0n && baseDiscountBps <= UINT_32_MAX,
      `Invalid baseDiscountBps: ${baseDiscountBps}. Must be a valid uint32`,
    )
    assert(baseDiscountBps < 10_000n, `Base discount must be less than 10000 bps`)
    assert(
      annualRateBps >= 0n && annualRateBps <= UINT_32_MAX,
      `Invalid annualRateBps: ${annualRateBps}. Must be a valid uint32`,
    )
    assert(annualRateBps < 10_000n, `Annual rate must be less than 10000 bps`)
    assert(
      maxDiscountBps >= 0n && maxDiscountBps <= UINT_32_MAX,
      `Invalid maxDiscountBps: ${maxDiscountBps}. Must be a valid uint32`,
    )
    assert(maxDiscountBps < 10_000n, `Max discount must be less than 10000 bps`)
    assert(
      maturity >= 0n && maturity <= UINT_40_MAX,
      `Invalid maturity: ${maturity}. Must be a valid uint40`,
    )
    assert(
      maxStaleness >= 0n && maxStaleness <= UINT_32_MAX,
      `Invalid maxStaleness: ${maxStaleness}. Must be a valid uint32`,
    )
    assert(
      tokenInDecimals >= 0n && tokenInDecimals <= UINT_8_MAX,
      `Invalid tokenInDecimals: ${tokenInDecimals}. Must be a valid uint8`,
    )
    assert(tokenInDecimals <= 36n, `Token input decimals must be at most 36`)
    assert(
      tokenOutDecimals >= 0n && tokenOutDecimals <= UINT_8_MAX,
      `Invalid tokenOutDecimals: ${tokenOutDecimals}. Must be a valid uint8`,
    )
    assert(tokenOutDecimals <= 36n, `Token output decimals must be at most 36`)
    assert(
      oracleDecimals >= 0n && oracleDecimals <= UINT_8_MAX,
      `Invalid oracleDecimals: ${oracleDecimals}. Must be a valid uint8`,
    )
  }

  static decode(data: HexString): AquaExitTermArgs {
    return AquaExitTermArgs.CODER.decode(data)
  }

  toJSON(): Record<string, unknown> {
    return {
      baseDiscountBps: this.baseDiscountBps.toString(),
      annualRateBps: this.annualRateBps.toString(),
      maxDiscountBps: this.maxDiscountBps.toString(),
      maturity: this.maturity.toString(),
      maxStaleness: this.maxStaleness.toString(),
      tokenInDecimals: this.tokenInDecimals.toString(),
      tokenOutDecimals: this.tokenOutDecimals.toString(),
      oracleDecimals: this.oracleDecimals.toString(),
      oracleAddress: this.oracleAddress.toString(),
    }
  }
}
