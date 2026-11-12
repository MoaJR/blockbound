import type { RunMods, RunState } from './types';
import { deriveMods } from './relics';

/**
 * Modificadores efetivos da run (relíquias + talentos + modificador de estágio).
 * Vive em módulo próprio para que `progression.ts` e `run.ts` compartilhem a
 * mesma derivação sem import circular.
 */
export function getMods(state: RunState): RunMods {
  return deriveMods(state.relics, state.talents, state.stage.modifier);
}
