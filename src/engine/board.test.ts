import { describe, expect, it } from 'vitest';
import {
  applyClear,
  applyGravity,
  canPlace,
  countFilled,
  createBoard,
  findFullLines,
  placementsFor,
  plantBombs,
  spawnCorruption,
  tickBombs,
  writePiece,
} from './board';
import { makePiece, shapeById, SHAPES } from './pieces';
import { Rng } from './rng';
import { emptyCell } from './board';
import type { Board, Piece } from './types';

function shape(id: string): Piece {
  const found = shapeById(id);
  if (!found) throw new Error(`missing shape ${id}`);
  return makePiece(found, 0);
}

function fill(board: Board, r: number, c: number, kind: 'block' | 'corrupt' | 'frozen' | 'bomb' = 'block'): void {
  board.cells[r][c] = kind === 'block' ? { kind, color: 1 } : { kind, color: 1, timer: kind === 'bomb' ? 3 : undefined };
}

describe('board', () => {
  it('cria tabuleiro 9x9 vazio', () => {
    const board = createBoard();
    expect(board.size).toBe(9);
    expect(countFilled(board)).toBe(0);
    expect(board.cells[8][8].kind).toBe('empty');
  });

  it('valida limites ao posicionar', () => {
    const board = createBoard();
    expect(canPlace(board, shape('dot'), 0, 0)).toBe(true);
    expect(canPlace(board, shape('dot'), 9, 0)).toBe(false);
    expect(canPlace(board, shape('dot'), -1, 0)).toBe(false);
    expect(canPlace(board, shape('duo-0'), 0, 8)).toBe(false);
    expect(canPlace(board, shape('duo-0'), 0, 7)).toBe(true);
  });

  it('bloqueia encaixe em células ocupadas e em gelo', () => {
    const board = createBoard();
    fill(board, 4, 4, 'block');
    fill(board, 0, 0, 'frozen');
    expect(canPlace(board, shape('dot'), 4, 4)).toBe(false);
    expect(canPlace(board, shape('dot'), 0, 0)).toBe(false);
    expect(canPlace(board, shape('dot'), 0, 0, { allowHazard: true })).toBe(true);
  });

  it('detecta linhas e colunas completas', () => {
    const board = createBoard();
    for (let c = 0; c < 9; c += 1) fill(board, 2, c);
    for (let r = 0; r < 9; r += 1) fill(board, r, 6);
    const full = findFullLines(board);
    expect(full.rows).toEqual([2]);
    expect(full.cols).toEqual([6]);
  });

  it('remover linhas e colunas simultâneas conta células únicas', () => {
    const board = createBoard();
    for (let i = 0; i < 9; i += 1) {
      fill(board, 1, i);
      fill(board, i, 4);
    }
    const cleared = applyClear(board, [1], [4]);
    expect(cleared.cells.length).toBe(17);
    expect(countFilled(board)).toBe(0);
  });

  it('corrompidas e bombas são reportadas ao limpar e o gelo adjacente derrete', () => {
    const board = createBoard();
    for (let i = 0; i < 9; i += 1) fill(board, 3, i);
    board.cells[3][3] = { kind: 'corrupt', color: 2 };
    board.cells[3][4] = { kind: 'bomb', color: 3, timer: 5 };
    board.cells[2][3] = { kind: 'frozen', color: 4 };
    const cleared = applyClear(board, [3], []);
    expect(cleared.corrupt).toEqual([{ r: 3, c: 3 }]);
    expect(cleared.bombs).toEqual([{ r: 3, c: 4 }]);
    expect(cleared.frozenNearby).toEqual([{ r: 2, c: 3 }]);
    expect(board.cells[2][3].kind).toBe('empty');
  });

  it('peças com rotações distintas são geradas', () => {
    const ids = SHAPES.map((s) => s.id);
    expect(ids).toContain('corner-0');
    expect(ids).toContain('corner-3');
    expect(new Set(ids).size).toBe(ids.length);
    const elbow = SHAPES.filter((s) => s.id.startsWith('elbow4'));
    expect(elbow.length).toBe(4);
    for (const shapeDef of SHAPES) {
      expect(shapeDef.cells.length).toBe(shapeDef.size);
      const minR = Math.min(...shapeDef.cells.map((c) => c.r));
      const minC = Math.min(...shapeDef.cells.map((c) => c.c));
      expect(minR).toBe(0);
      expect(minC).toBe(0);
    }
  });

  it('coloca peça e conta células', () => {
    const board = createBoard();
    writePiece(board, shape('square4'), 1, 1);
    expect(countFilled(board)).toBe(4);
    // 64 ancoragens de 2x2 no 9x9, menos as 9 que colidem com o bloco em (1,1)
    expect(placementsFor(board, shape('square4')).length).toBe(55);
  });

  it('aplica gravidade empilhando blocos no fundo', () => {
    const board = createBoard();
    fill(board, 0, 0);
    fill(board, 3, 0);
    applyGravity(board);
    expect(board.cells[8][0].kind).toBe('block');
    expect(board.cells[7][0].kind).toBe('block');
    expect(board.cells[0][0].kind).toBe('empty');
  });

  it('corrupção respeita o espaço mínimo jogável', () => {
    const board = createBoard();
    const rng = new Rng(99);
    const created = spawnCorruption(board, 90, rng, 20);
    expect(created.length).toBeLessThanOrEqual(61);
    expect(countFilled(board)).toBeGreaterThan(0);
  });

  it('bombas explodem em corrupção ao chegar a zero', () => {
    const board = createBoard();
    board.cells[4][4] = { kind: 'bomb', color: 5, timer: 1 };
    const result = tickBombs(board);
    expect(result.exploded).toEqual([{ r: 4, c: 4 }]);
    expect(board.cells[3][4].kind).toBe('corrupt');
    expect(board.cells[4][4].kind).toBe('empty');
  });

  it('não planta mais bombas que o limite', () => {
    const board = createBoard();
    const rng = new Rng(3);
    plantBombs(board, 10, rng, 4, 4);
    const bombs = board.cells.flat().filter((cell) => cell.kind === 'bomb').length;
    expect(bombs).toBe(4);
    board.cells[0][0] = emptyCell();
    expect(board.cells[0][0].kind).toBe('empty');
  });
});
