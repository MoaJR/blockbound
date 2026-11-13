import { describe, expect, it } from 'vitest';
import {
  centroid,
  clearParticleCount,
  clearTier,
  comboTier,
  rowsAndCols,
  shakeMagnitude,
} from './director';

describe('direção de efeitos', () => {
  it('escala a intensidade da limpeza', () => {
    expect(clearTier(1, false)).toBe(1);
    expect(clearTier(2, false)).toBe(2);
    expect(clearTier(3, false)).toBe(3);
    expect(clearTier(4, false)).toBe(4);
    expect(clearTier(1, true)).toBe(4);
    expect(clearParticleCount(1)).toBeLessThan(clearParticleCount(3));
    expect(shakeMagnitude(1)).toBeLessThan(shakeMagnitude(4));
  });

  it('escala os combos por faixa', () => {
    expect(comboTier(2)).toBe('x2');
    expect(comboTier(3)).toBe('x3');
    expect(comboTier(5)).toBe('x5');
    expect(comboTier(10)).toBe('x10');
    expect(comboTier(24)).toBe('x10');
  });

  it('calcula centro e linhas afetadas', () => {
    expect(centroid([{ r: 0, c: 0 }])).toEqual({ r: 0, c: 0 });
    const center = centroid([
      { r: 1, c: 2 },
      { r: 3, c: 6 },
    ]);
    expect(center).toEqual({ r: 2, c: 4 });
    expect(rowsAndCols([{ r: 2, c: 4 }, { r: 2, c: 7 }, { r: 5, c: 7 }])).toEqual({
      rows: [2, 5],
      cols: [4, 7],
    });
  });
});
