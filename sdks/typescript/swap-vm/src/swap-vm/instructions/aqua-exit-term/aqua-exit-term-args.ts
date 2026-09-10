// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import type { Address, HexString } from '@1inch/sdk-core'
import { UINT_8_MAX, UINT_32_MAX, UINT_40_MAX } from '@1inch/byte-utils'
import assert from 'assert'
import { AquaExitTermArgsCoder } from './aqua-exit-term-args-coder'
import type { IArgsCoder, IArgsData } from '../types'

const UINT_128_MAX = (1n << 128n) - 1n

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
    public readonly maxExposure: bigint,
    public readonly inventorySlopeBps: bigint,
    public readonly maxNotionalOut: bigint,
    public readonly liquiditySlopeBps: bigint,
    public readonly riskTierBps: bigint,
    public readonly minMaturity: bigint,
    public readonly maxMaturity: bigint,
    public readonly allowedTokenIn: Address,
    public readonly allowedTokenOut: Address,
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
    assert(
      maxExposure >= 0n && maxExposure <= UINT_128_MAX,
      `Invalid maxExposure: ${maxExposure}. Must be a valid uint128`,
    )
    assert(
      inventorySlopeBps >= 0n && inventorySlopeBps <= UINT_32_MAX,
      `Invalid inventorySlopeBps: ${inventorySlopeBps}. Must be a valid uint32`,
    )
    assert(inventorySlopeBps < 10_000n, `Inventory slope must be less than 10000 bps`)
    assert(
      maxNotionalOut >= 0n && maxNotionalOut <= UINT_128_MAX,
      `Invalid maxNotionalOut: ${maxNotionalOut}. Must be a valid uint128`,
    )
    assert(
      liquiditySlopeBps >= 0n && liquiditySlopeBps <= UINT_32_MAX,
      `Invalid liquiditySlopeBps: ${liquiditySlopeBps}. Must be a valid uint32`,
    )
    assert(liquiditySlopeBps < 10_000n, `Liquidity slope must be less than 10000 bps`)
    assert(
      riskTierBps >= 0n && riskTierBps <= UINT_32_MAX,
      `Invalid riskTierBps: ${riskTierBps}. Must be a valid uint32`,
    )
    assert(riskTierBps < 10_000n, `Risk tier must be less than 10000 bps`)
    assert(
      minMaturity >= 0n && minMaturity <= UINT_40_MAX,
      `Invalid minMaturity: ${minMaturity}. Must be a valid uint40`,
    )
    assert(
      maxMaturity >= 0n && maxMaturity <= UINT_40_MAX,
      `Invalid maxMaturity: ${maxMaturity}. Must be a valid uint40`,
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
      maxExposure: this.maxExposure.toString(),
      inventorySlopeBps: this.inventorySlopeBps.toString(),
      maxNotionalOut: this.maxNotionalOut.toString(),
      liquiditySlopeBps: this.liquiditySlopeBps.toString(),
      riskTierBps: this.riskTierBps.toString(),
      minMaturity: this.minMaturity.toString(),
      maxMaturity: this.maxMaturity.toString(),
      allowedTokenIn: this.allowedTokenIn.toString(),
      allowedTokenOut: this.allowedTokenOut.toString(),
    }
  }
}
