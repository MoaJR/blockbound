import { POWERS } from './powers';
import { RELICS } from './relics';
import { makePiece, shapeById } from './pieces';
import { createRun } from './run';
import type { MetaSnapshot, RunState } from './types';

export const ALL_META: MetaSnapshot = {
  unlockedRelics: RELICS.map((relic) => relic.id),
  unlockedPowers: POWERS.map((power) => power.id),
  talents: {},
};

export function freshRun(seed = 12345, meta: MetaSnapshot = ALL_META): RunState {
  return createRun(meta, seed, 0).state;
}

export function setCell(run: RunState, r: number, c: number, kind: 'block' | 'corrupt' | 'frozen' | 'bomb' | 'empty'): void {
  run.board.cells[r][c] =
    kind === 'empty' ? { kind: 'empty', color: -1 } : { kind, color: 0, timer: kind === 'bomb' ? 3 : undefined };
}

/** Preenche uma linha deixando buracos específicos. */
export function fillRow(run: RunState, row: number, holes: number[] = []): void {
  for (let c = 0; c < run.board.size; c += 1) {
    if (holes.includes(c)) setCell(run, row, c, 'empty');
    else setCell(run, row, c, 'block');
  }
}

export function fillColumn(run: RunState, col: number, holes: number[] = []): void {
  for (let r = 0; r < run.board.size; r += 1) {
    if (holes.includes(r)) setCell(run, r, col, 'empty');
    else setCell(run, r, col, 'block');
  }
}

export function fillBoard(run: RunState): void {
  for (let r = 0; r < run.board.size; r += 1) {
    for (let c = 0; c < run.board.size; c += 1) setCell(run, r, c, 'block');
  }
}

export function setTrayShape(run: RunState, index: number, shapeId: string): void {
  const shape = shapeById(shapeId);
  if (!shape) throw new Error(`forma desconhecida: ${shapeId}`);
  run.tray[index] = makePiece(shape, index);
}

export function countBlocks(run: RunState): number {
  let total = 0;
  for (const row of run.board.cells) {
    for (const cell of row) if (cell.kind === 'block') total += 1;
  }
  return total;
}

export function cellKind(run: RunState, r: number, c: number): string {
  return run.board.cells[r][c].kind;
}
