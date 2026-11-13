import { describe, expect, it } from 'vitest';
import {
  TOUCH_LIFT_MAX,
  TOUCH_LIFT_MIN,
  cellProjection,
  dragGrabOffsets,
  ghostBox,
  ghostOrigin,
  rectsOverlap,
  touchDragLift,
} from './drag';
import { createBoard } from '../engine/board';
import { resolveDrop } from '../engine/placement';
import type { Piece } from '../engine/types';

const BOARD_RECT = { left: 20, top: 300, width: 360, height: 360 };
const CELL = BOARD_RECT.width / 9;

function square(size: number): Piece {
  return {
    id: 'p',
    shapeId: 'square',
    color: 0,
    cells: Array.from({ length: size * size }, (_, index) => ({
      r: Math.floor(index / size),
      c: index % size,
    })),
  };
}

describe('touchDragLift', () => {
  it('fica dentro da faixa ergonômica em todos os viewports alvo', () => {
    for (const height of [640, 800, 844, 915, 932]) {
      const lift = touchDragLift(height);
      expect(lift).toBeGreaterThanOrEqual(TOUCH_LIFT_MIN);
      expect(lift).toBeLessThanOrEqual(TOUCH_LIFT_MAX);
    }
  });

  it('cresce com a altura da tela e satura no máximo', () => {
    expect(touchDragLift(640)).toBe(TOUCH_LIFT_MIN);
    expect(touchDragLift(844)).toBeGreaterThan(touchDragLift(640));
    expect(touchDragLift(4000)).toBe(TOUCH_LIFT_MAX);
  });

  it('cai no valor de referência quando a viewport é desconhecida', () => {
    expect(touchDragLift(0)).toBe(70);
    expect(touchDragLift(Number.NaN)).toBe(70);
  });
});

describe('dragGrabOffsets', () => {
  it('mouse preserva o ponto exato da pega (sem lift)', () => {
    const offsets = dragGrabOffsets({
      pointerType: 'mouse',
      fx: 0.25,
      fy: 0.75,
      width: 3,
      height: 2,
      cell: CELL,
      viewportHeight: 900,
    });
    expect(offsets.lift).toBe(0);
    expect(offsets.grabX).toBeCloseTo(0.25 * 3 * CELL);
    expect(offsets.grabY).toBeCloseTo(0.75 * 2 * CELL);
  });

  it('toque mantém a base da peça acima do dedo, independente de onde tocou', () => {
    const base = {
      pointerType: 'touch',
      fx: 0.5,
      width: 2,
      height: 3,
      cell: CELL,
      viewportHeight: 844,
    };
    const top = dragGrabOffsets({ ...base, fy: 0 });
    const bottom = dragGrabOffsets({ ...base, fy: 1 });
    expect(top.grabY).toBe(bottom.grabY);
    expect(top.lift).toBe(bottom.lift);
    expect(top.grabY).toBeCloseTo(3 * CELL);
    expect(top.lift).toBeGreaterThanOrEqual(TOUCH_LIFT_MIN);
  });

  it('limita fx/fy ao intervalo 0..1', () => {
    const offsets = dragGrabOffsets({
      pointerType: 'mouse',
      fx: 4,
      fy: -2,
      width: 2,
      height: 2,
      cell: CELL,
      viewportHeight: 900,
    });
    expect(offsets.grabX).toBeCloseTo(2 * CELL);
    expect(offsets.grabY).toBeCloseTo(0);
  });
});

describe('ghostOrigin', () => {
  it('mantém exatamente o offset durante o movimento', () => {
    const offsets = dragGrabOffsets({
      pointerType: 'touch',
      fx: 0.5,
      fy: 0.5,
      width: 2,
      height: 2,
      cell: CELL,
      viewportHeight: 844,
    });
    const a = ghostOrigin(180, 700, offsets);
    const b = ghostOrigin(210, 660, offsets);
    expect(b.x - a.x).toBeCloseTo(30);
    expect(b.y - a.y).toBeCloseTo(-40);
    // base da peça sempre `lift` px acima do dedo
    expect(660 - (b.y + 2 * CELL)).toBeCloseTo(offsets.lift);
  });
});

describe('rectsOverlap', () => {
  const box = ghostBox({ x: 40, y: 320 }, 2, 2, CELL);

  it('detecta sobreposição com o tabuleiro', () => {
    expect(rectsOverlap(box, BOARD_RECT)).toBe(true);
  });

  it('ignora quando o ghost está completamente fora', () => {
    const far = ghostBox({ x: 40, y: 20 }, 2, 2, CELL);
    expect(rectsOverlap(far, BOARD_RECT)).toBe(false);
    expect(rectsOverlap(far, BOARD_RECT, CELL * 0.15)).toBe(false);
  });

  it('aceita a folga de borda usada no arraste', () => {
    const above = ghostBox({ x: 40, y: BOARD_RECT.top - 2 * CELL - CELL * 0.1 }, 2, 2, CELL);
    expect(rectsOverlap(above, BOARD_RECT)).toBe(false);
    expect(rectsOverlap(above, BOARD_RECT, CELL * 0.15)).toBe(true);
  });
});

describe('cellProjection', () => {
  it('converte o canto do ghost em coordenadas fracionárias de célula', () => {
    const origin = { x: BOARD_RECT.left + CELL * 2.5, y: BOARD_RECT.top + CELL * 1.25 };
    expect(cellProjection(origin, BOARD_RECT, CELL)).toEqual({ row: 1.25, col: 2.5 });
  });

  it('preview e drop concordam usando o ghost elevado do toque', () => {
    const board = createBoard(9);
    const piece = square(2);
    const offsets = dragGrabOffsets({
      pointerType: 'touch',
      fx: 0.5,
      fy: 0,
      width: 2,
      height: 2,
      cell: CELL,
      viewportHeight: 844,
    });
    // dedo na linha 5, coluna 3 — a peça está `lift` px acima
    const pointer = { x: BOARD_RECT.left + CELL * 3, y: BOARD_RECT.top + CELL * 5 };
    const origin = ghostOrigin(pointer.x, pointer.y, offsets);

    const duringDrag = resolveDrop(board, piece, cellProjection(origin, BOARD_RECT, CELL));
    const onRelease = resolveDrop(
      board,
      piece,
      cellProjection(ghostOrigin(pointer.x, pointer.y, offsets), BOARD_RECT, CELL),
    );

    expect(duringDrag.anchor).toEqual(onRelease.anchor);
    // a âncora vem do ghost (elevado), não do dedo
    expect(duringDrag.anchor.c).toBe(3 - Math.round(0.5 * 2));
    expect(duringDrag.anchor.r).toBe(Math.max(0, Math.round(3 - offsets.lift / CELL)));
  });
});
