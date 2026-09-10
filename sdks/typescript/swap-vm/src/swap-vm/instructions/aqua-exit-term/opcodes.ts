// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { AquaExitTermArgs } from './aqua-exit-term-args'
import { Opcode } from '../opcode'

export const aquaExitBackingOracleCheck: Opcode<AquaExitTermArgs> = new Opcode(
  Symbol('AquaExitTerm.aquaExitBackingOracleCheck'),
  AquaExitTermArgs.CODER,
)

export const aquaExitExposureCap: Opcode<AquaExitTermArgs> = new Opcode(
  Symbol('AquaExitTerm.aquaExitExposureCap'),
  AquaExitTermArgs.CODER,
)

export const aquaExitDiscountCurve1D: Opcode<AquaExitTermArgs> = new Opcode(
  Symbol('AquaExitTerm.aquaExitDiscountCurve1D'),
  AquaExitTermArgs.CODER,
)
