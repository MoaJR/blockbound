import type { Coord, PowerId } from '../engine/types';

export type ClearTier = 1 | 2 | 3 | 4;
export type ComboTier = 'x2' | 'x3' | 'x5' | 'x10';

export function clearTier(lines: number, cross: boolean): ClearTier {
  if (cross || lines >= 4) return 4;
  if (lines >= 3) return 3;
  if (lines === 2) return 2;
  return 1;
}

export function comboTier(level: number): ComboTier {
  if (level >= 10) return 'x10';
  if (level >= 5) return 'x5';
  if (level >= 3) return 'x3';
  return 'x2';
}

export function centroid(cells: Coord[]): { r: number; c: number } {
  if (cells.length === 0) return { r: 4, c: 4 };
  let r = 0;
  let c = 0;
  for (const cell of cells) {
    r += cell.r;
    c += cell.c;
  }
  return { r: r / cells.length, c: c / cells.length };
}

export const POWER_COLOR: Record<PowerId, string> = {
  hammer: '#ffd76a',
  bomb: '#ff8a3d',
  drill: '#9be8ff',
  shuffle: '#c9a6ff',
  convert: '#b06bff',
  wildcard: '#4ade80',
};

export function clearParticleCount(tier: ClearTier): number {
  if (tier >= 4) return 7;
  if (tier === 3) return 5;
  if (tier === 2) return 4;
  return 2;
}

export function shakeMagnitude(tier: ClearTier): number {
  if (tier >= 4) return 6;
  if (tier === 3) return 4.5;
  if (tier === 2) return 3;
  return 1.8;
}

export function rowsAndCols(cells: Coord[]): { rows: number[]; cols: number[] } {
  const rows = new Set<number>();
  const cols = new Set<number>();
  for (const cell of cells) {
    rows.add(cell.r);
    cols.add(cell.c);
  }
  return { rows: [...rows].sort((a, b) => a - b), cols: [...cols].sort((a, b) => a - b) };
}
