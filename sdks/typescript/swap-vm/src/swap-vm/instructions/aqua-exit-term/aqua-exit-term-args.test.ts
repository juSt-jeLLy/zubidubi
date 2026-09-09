// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { describe, expect, it } from 'vitest'
import { Address, HexString } from '@1inch/sdk-core'
import { AquaProgramBuilder } from '../../programs'
import { AquaExitTermArgs } from './aqua-exit-term-args'
import { AquaExitTermArgsCoder } from './aqua-exit-term-args-coder'

describe('AquaExitTermArgsCoder', () => {
  const coder = new AquaExitTermArgsCoder()
  const oracle = new Address('0x1234567890123456789012345678901234567890')

  it('encodes args exactly like AquaExitTermArgsBuilder.build()', () => {
    const args = new AquaExitTermArgs(100n, 1200n, 300n, 1735689600n, 3600n, 18n, 18n, 18n, oracle)

    expect(coder.encode(args).toString()).toBe(
      '0x00000064000004b00000012c006774858000000e101212121234567890123456789012345678901234567890',
    )
  })

  it('decodes encoded args', () => {
    const encoded = new HexString(
      '0x00000064000004b00000012c006774858000000e101212121234567890123456789012345678901234567890',
    )

    const decoded = coder.decode(encoded)

    expect(decoded.baseDiscountBps).toBe(100n)
    expect(decoded.annualRateBps).toBe(1200n)
    expect(decoded.maxDiscountBps).toBe(300n)
    expect(decoded.maturity).toBe(1735689600n)
    expect(decoded.maxStaleness).toBe(3600n)
    expect(decoded.tokenInDecimals).toBe(18n)
    expect(decoded.tokenOutDecimals).toBe(18n)
    expect(decoded.oracleDecimals).toBe(18n)
    expect(decoded.oracleAddress.toString()).toBe(oracle.toString())
  })

  it('builds and decodes an Aqua program with opcode 34', () => {
    const args = new AquaExitTermArgs(100n, 1200n, 300n, 1735689600n, 3600n, 18n, 18n, 18n, oracle)
    const program = new AquaProgramBuilder().aquaExitTermSwap1D(args).build()

    expect(program.toString()).toBe(
      '0x222c00000064000004b00000012c006774858000000e101212121234567890123456789012345678901234567890',
    )

    const decoded = AquaProgramBuilder.decode(program).getInstructions()
    expect(decoded).toHaveLength(1)
    expect(decoded[0].args.toJSON()).toEqual(args.toJSON())
  })
})
