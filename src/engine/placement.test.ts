import { describe, expect, it } from 'vitest';
import { anchorFromCell, resolveDrop, snapProjection } from './placement';
import { createBoard, placementsFor } from './board';
import { makePiece, shapeById } from './pieces';
import type { Piece } from './types';

function shape(id: string): Piece {
  const found = shapeById(id);
  if (!found) throw new Error(`forma ausente: ${id}`);
  return makePiece(found, 0);
}

describe('projeção do arraste', () => {
  it('arredonda a projeção para a célula mais próxima', () => {
    const board = createBoard();
    const piece = shape('duo-0');
    expect(snapProjection(board, piece, { row: 2.4, col: 3.6 })).toEqual({ r: 2, c: 4 });
    expect(snapProjection(board, piece, { row: 2.6, col: 3.4 })).toEqual({ r: 3, c: 3 });
  });

  it('limita a âncora para a peça caber no tabuleiro', () => {
    const board = createBoard();
    const piece = shape('tri-0');
    expect(snapProjection(board, piece, { row: 8.2, col: 8.2 })).toEqual({ r: 8, c: 6 });
    expect(snapProjection(board, piece, { row: -3, col: -1 })).toEqual({ r: 0, c: 0 });
  });

  it('resolve o drop com limites e conflitos na mesma chamada', () => {
    const board = createBoard();
    const piece = shape('dot');
    const ok = resolveDrop(board, piece, { row: 4.1, col: 4.9 });
    expect(ok).toEqual({ anchor: { r: 4, c: 5 }, valid: true, blocked: [], clamped: false });
    const flagged = resolveDrop(board, piece, { row: 9.4, col: -2 });
    expect(flagged.anchor).toEqual({ r: 8, c: 0 });
    expect(flagged.clamped).toBe(true);
    expect(flagged.valid).toBe(true);
  });

  it('marca as células de conflito quando a posição está ocupada', () => {
    const board = createBoard();
    board.cells[4][5] = { kind: 'block', color: 0 };
    const piece = shape('duo-0');
    const drop = resolveDrop(board, piece, { row: 4, col: 5 });
    expect(drop.valid).toBe(false);
    expect(drop.blocked).toEqual([{ r: 4, c: 5 }]);
  });

  it('converte célula tocada em âncora centralizada na peça', () => {
    expect(anchorFromCell(shape('square4'), { r: 4, c: 4 })).toEqual({ r: 4, c: 4 });
    expect(anchorFromCell(shape('dot'), { r: 4, c: 4 })).toEqual({ r: 4, c: 4 });
    expect(anchorFromCell(shape('line5-0'), { r: 2, c: 4 })).toEqual({ r: 2, c: 2 });
  });

  it('respeita o Coringa (allowHazard) na resolução do drop', () => {
    const board = createBoard();
    board.cells[2][2] = { kind: 'frozen', color: 4 };
    const piece = shape('dot');
    expect(resolveDrop(board, piece, { row: 2, col: 2 }).valid).toBe(false);
    expect(resolveDrop(board, piece, { row: 2, col: 2 }, { allowHazard: true }).valid).toBe(true);
  });

  it('toda âncora resolvida permite encaixe (paridade com placementsFor)', () => {
    const board = createBoard();
    const rngBoard = placementsFor(board, shape('corner-0'));
    for (const spot of rngBoard) {
      const drop = resolveDrop(board, shape('corner-0'), { row: spot.r, col: spot.c });
      expect(drop.anchor).toEqual(spot);
      expect(drop.valid).toBe(true);
    }
  });
});
