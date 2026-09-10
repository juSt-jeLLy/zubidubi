// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { describe, expect, it } from 'vitest'
import { Address, HexString } from '@1inch/sdk-core'
import { AquaProgramBuilder } from '../../programs'
import { AquaExitTermArgs } from './aqua-exit-term-args'
import { AquaExitTermArgsCoder } from './aqua-exit-term-args-coder'

describe('AquaExitTermArgsCoder', () => {
  const coder = new AquaExitTermArgsCoder()
  const oracle = new Address('0x1234567890123456789012345678901234567890')
  const allowedTokenIn = new Address('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  const allowedTokenOut = new Address('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
  const secondaryOracle = new Address('0xcccccccccccccccccccccccccccccccccccccccc')
  const encodedArgs =
    '0x00000064000004b00000012c006774858000000e10121212123456789012345678901234567890123456789000000000000000004563918244f40000000000fa00000000000000008ac7230489e8000000000032000000190000000000ffffffffffaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbcccccccccccccccccccccccccccccccccccccccc00000310000000c80100000320'

  it('encodes args exactly like AquaExitTermArgsBuilder.build()', () => {
    const args = new AquaExitTermArgs(
      100n,
      1200n,
      300n,
      1735689600n,
      3600n,
      18n,
      18n,
      18n,
      oracle,
      5n * 10n ** 18n,
      250n,
      10n * 10n ** 18n,
      50n,
      25n,
      0n,
      (1n << 40n) - 1n,
      allowedTokenIn,
      allowedTokenOut,
      secondaryOracle,
      784n,
      200n,
      1n,
      800n,
    )

    expect(coder.encode(args).toString()).toBe(encodedArgs)
  })

  it('decodes encoded args', () => {
    const encoded = new HexString(encodedArgs)

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
    expect(decoded.maxExposure).toBe(5n * 10n ** 18n)
    expect(decoded.inventorySlopeBps).toBe(250n)
    expect(decoded.maxNotionalOut).toBe(10n * 10n ** 18n)
    expect(decoded.liquiditySlopeBps).toBe(50n)
    expect(decoded.riskTierBps).toBe(25n)
    expect(decoded.minMaturity).toBe(0n)
    expect(decoded.maxMaturity).toBe((1n << 40n) - 1n)
    expect(decoded.allowedTokenIn.toString()).toBe(allowedTokenIn.toString())
    expect(decoded.allowedTokenOut.toString()).toBe(allowedTokenOut.toString())
    expect(decoded.secondaryOracleAddress.toString()).toBe(secondaryOracle.toString())
    expect(decoded.maxDeviationBps).toBe(784n)
    expect(decoded.deviationHaircutBps).toBe(200n)
    expect(decoded.curveFamily).toBe(1n)
    expect(decoded.convexityBps).toBe(800n)
  })

  it('builds and decodes the reusable AquaExit instruction-library sequence', () => {
    const args = new AquaExitTermArgs(
      100n,
      1200n,
      300n,
      1735689600n,
      3600n,
      18n,
      18n,
      18n,
      oracle,
      5n * 10n ** 18n,
      250n,
      10n * 10n ** 18n,
      50n,
      25n,
      0n,
      (1n << 40n) - 1n,
      allowedTokenIn,
      allowedTokenOut,
      secondaryOracle,
      784n,
      200n,
      1n,
      800n,
    )
    const program = new AquaProgramBuilder().aquaExitTermLibrary(args).build()

    expect(program.toString()).toBe(
      `0x24ab${encodedArgs.slice(2)}25ab${encodedArgs.slice(2)}26ab${encodedArgs.slice(2)}`,
    )

    const decoded = AquaProgramBuilder.decode(program).getInstructions()
    expect(decoded).toHaveLength(3)
    expect(decoded.map((ix) => ix.args.toJSON())).toEqual([
      args.toJSON(),
      args.toJSON(),
      args.toJSON(),
    ])
  })
})
