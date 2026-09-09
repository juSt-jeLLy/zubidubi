// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { AquaExitTermArgs } from './aqua-exit-term-args'
import { Opcode } from '../opcode'

export const aquaExitTermSwap1D: Opcode<AquaExitTermArgs> = new Opcode(
  Symbol('AquaExitTerm.aquaExitTermSwap1D'),
  AquaExitTermArgs.CODER,
)
