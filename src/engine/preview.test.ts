import { describe, expect, it } from 'vitest';
import { placePiece, previewAtProjection, previewPlacement } from './run';
import { fillColumn, fillRow, freshRun, setCell, setTrayShape } from './testing';
import { resolveDrop } from './placement';
import type { Coord, Piece } from './types';

function posKey(list: readonly Coord[]): string[] {
  return list.map(({ r, c }) => `${r}:${c}`).sort();
}

describe('preview de posicionamento', () => {
  it('prevê linhas, colunas e células destruídas com interseção única', () => {
    const run = freshRun(30);
    fillRow(run, 8, [0]);
    fillColumn(run, 4, []);
    setTrayShape(run, 0, 'dot');

    const preview = previewPlacement(run, 0, 8, 0);
    expect(preview.valid).toBe(true);
    expect(preview.rows).toEqual([8]);
    expect(preview.cols).toEqual([4]);
    expect(preview.lines).toBe(2);
    expect(preview.cleared.length).toBe(17);
    expect(preview.crossCells).toEqual([{ r: 8, c: 4 }]);
    expect(preview.pieceCleared).toEqual([{ r: 8, c: 0 }]);
    expect(preview.boardCleared.length).toBe(16);
    expect(preview.label).toBe('LINHA + COLUNA');

    const result = placePiece(run, 0, 8, 0);
    expect(result.state.energy.earned - run.energy.earned).toBe(preview.energy);
  });

  it('pontuação prevista é idêntica à pontuação real (mesma fórmula e RNG)', () => {
    const run = freshRun(31);
    fillRow(run, 8, [3]);
    setTrayShape(run, 0, 'dot');

    const preview = previewPlacement(run, 0, 8, 3);
    const result = placePiece(run, 0, preview.anchor.r, preview.anchor.c);
    expect(result.ok).toBe(true);
    const clear = result.events.find((event) => event.type === 'clear');
    expect(clear).toBeTruthy();
    if (clear && clear.type === 'clear') {
      expect(clear.points).toBe(preview.score?.total);
    }
    expect(posKey(clear && clear.type === 'clear' ? clear.cells : [])).toEqual(
      posKey(preview.cleared),
    );
  });

  it('mantém a igualdade mesmo com Espelho de Prata (RNG espelhado)', () => {
    for (const seed of [41, 42, 43, 44, 45]) {
      const run = freshRun(seed);
      run.relics.push('silver_mirror');
      fillRow(run, 6, [2]);
      setTrayShape(run, 0, 'dot');
      const preview = previewPlacement(run, 0, 6, 2);
      const result = placePiece(run, 0, 6, 2);
      const score = result.events.find(
        (event) => event.type === 'score' && event.at !== undefined,
      );
      expect(score && score.type === 'score' ? score.amount : -1).toBe(preview.score?.total);
    }
  });

  it('não altera a run: tabuleiro, pontuação, energia e RNG intactos', () => {
    const run = freshRun(32);
    fillRow(run, 5, [1]);
    setTrayShape(run, 0, 'dot');
    const snapshot = structuredClone(run);

    const preview = previewPlacement(run, 0, 5, 1);
    expect(preview.valid).toBe(true);
    expect(run).toEqual(snapshot);
    expect(run.rngState).toBe(snapshot.rngState);
    expect(run.energy).toEqual(snapshot.energy);
    expect(run.stage.movesLeft).toBe(snapshot.stage.movesLeft);
  });

  it('posição inválida não mostra linhas nem recompensa', () => {
    const run = freshRun(33);
    fillRow(run, 3, []);
    setTrayShape(run, 0, 'dot');
    const preview = previewPlacement(run, 0, 3, 4);
    expect(preview.valid).toBe(false);
    expect(preview.score).toBeNull();
    expect(preview.lines).toBe(0);
    expect(preview.rows).toEqual([]);
    expect(preview.cols).toEqual([]);
    expect(preview.blocked).toEqual([{ r: 3, c: 4 }]);
  });

  it('prevê a energia coerente com o ganho real da jogada', () => {
    const run = freshRun(34);
    fillRow(run, 8, [0]);
    setTrayShape(run, 0, 'dot');
    const preview = previewPlacement(run, 0, 8, 0);
    const before = run.energy.value;
    const result = placePiece(run, 0, 8, 0);
    const gained = result.state.energy.earned - run.energy.earned;
    expect(gained).toBe(preview.energy);
    expect(result.state.energy.value).toBe(
      Math.min(result.state.energy.max, before + preview.energy),
    );
  });

  it('projeção do arraste e confirmação resolvem a mesma âncora', () => {
    const run = freshRun(35);
    const piece = run.tray[0] as Piece;
    setTrayShape(run, 0, 'tri-0');
    fillRow(run, 7, [2, 3, 4]);
    const projection = { row: 7.2, col: 1.7 };
    const preview = previewAtProjection(run, 0, projection);
    const expected = resolveDrop(run.board, run.tray[0] as Piece, projection);
    expect(preview.anchor).toEqual(expected.anchor);
    expect(preview.valid).toBe(expected.valid);
    expect(piece).toBeTruthy();
  });

  it('conta corrupção sob a peça e nas linhas limpas para a energia', () => {
    const run = freshRun(36);
    fillRow(run, 8, [0]);
    setCell(run, 8, 8, 'corrupt');
    setTrayShape(run, 0, 'dot');
    const preview = previewPlacement(run, 0, 8, 0);
    expect(preview.energy).toBe(25);
    const result = placePiece(run, 0, 8, 0);
    expect(result.state.energy.earned - run.energy.earned).toBe(preview.energy);
  });

  it('linhas múltiplas recebem rótulo de combo', () => {
    const run = freshRun(37);
    fillRow(run, 2, [4]);
    fillRow(run, 3, [4]);
    fillRow(run, 4, [4]);
    setTrayShape(run, 0, 'line5-1');
    const preview = previewPlacement(run, 0, 2, 4);
    expect(preview.valid).toBe(true);
    expect(preview.rows).toEqual([2, 3, 4]);
    expect(preview.lines).toBe(3);
    expect(preview.label).toBe('3 LINHAS COMBO');
  });
});
