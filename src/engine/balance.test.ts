import { describe, expect, it } from 'vitest';
import { chooseReward, isStuck, placePiece } from './run';
import { cloneBoard, findFullLines, placementConflicts, writePiece } from './board';
import { shapeBounds } from './pieces';
import { freshRun } from './testing';
import { defaultMeta, metaSnapshot } from './meta';
import type { RunState } from './types';

/**
 * Harness de balanceamento (determinístico).
 *
 * Um bot heurístico joga com o engine real para garantir que a primeira câmara
 * é justa e que a progressão não é uma parede. As bandas abaixo são a régua do
 * design: se alguém mexer em alvos/par e o jogo ficar impossível (como era com
 * 20 jogadas para 1.050 pontos), este teste falha.
 */

const NEW_META = metaSnapshot(defaultMeta());

interface BotMove {
  index: number;
  r: number;
  c: number;
  value: number;
}

/** Jogadas legais ordenadas por uma heurística simples (linhas > blocos > compactação). */
function playableMoves(run: RunState): BotMove[] {
  const out: BotMove[] = [];
  const size = run.board.size;
  for (let index = 0; index < run.tray.length; index += 1) {
    const piece = run.tray[index];
    if (!piece) continue;
    const { h, w } = shapeBounds(piece.cells);
    for (let r = 0; r + h <= size; r += 1) {
      for (let c = 0; c + w <= size; c += 1) {
        if (
          placementConflicts(run.board, piece, r, c, { allowHazard: run.wildcardArmed }).length > 0
        ) {
          continue;
        }
        const board = cloneBoard(run.board);
        writePiece(board, piece, r, c);
        const full = findFullLines(board);
        const lines = full.rows.length + full.cols.length;
        let neighbors = 0;
        for (const cell of piece.cells) {
          const rr = r + cell.r;
          const cc = c + cell.c;
          for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nr = rr + dr;
            const nc = cc + dc;
            if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
            if (board.cells[nr][nc].kind !== 'empty') neighbors += 1;
          }
        }
        out.push({ index, r, c, value: lines * 1000 + piece.cells.length * 8 + neighbors * 2 });
      }
    }
  }
  out.sort((a, b) => b.value - a.value || a.index - b.index || a.r - b.r || a.c - b.c);
  return out;
}

function playChamberOne(seed: number) {
  let run = freshRun(seed, NEW_META);
  const par = run.stage.movesTotal;
  let guard = 0;
  while (run.status === 'playing' && guard < 120) {
    guard += 1;
    const moves = playableMoves(run);
    if (moves.length === 0) break;
    const pick = moves[0];
    const result = placePiece(run, pick.index, pick.r, pick.c);
    if (!result.ok) break;
    run = result.state;
  }
  return {
    cleared: run.status === 'stageClear' || run.status === 'victory',
    moves: run.stage.movesTotal - run.stage.movesLeft,
    par,
    run,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

describe('balanceamento das câmaras', () => {
  it('a primeira câmara é vencível com folga e sem estourar o par', () => {
    const seeds = 24;
    const results = Array.from({ length: seeds }, (_, index) => playChamberOne((index + 1) * 7919));
    const clears = results.filter((entry) => entry.cleared);
    const clearRate = clears.length / seeds;
    const movesToClear = clears.map((entry) => entry.moves);
    const par = results[0].par;
    const overtimeRate =
      clears.filter((entry) => entry.moves > par).length / Math.max(1, clears.length);

    console.info(
      `câmara 1: ${Math.round(clearRate * 100)}% de conclusão · mediana ${median(movesToClear)} jogadas (par ${par}) · prorrogação ${Math.round(overtimeRate * 100)}%`,
    );

    expect(clearRate).toBeGreaterThanOrEqual(0.85);
    expect(median(movesToClear)).toBeGreaterThanOrEqual(12);
    expect(median(movesToClear)).toBeLessThanOrEqual(par);
    expect(overtimeRate).toBeLessThanOrEqual(0.35);
  });

  it('não deixa o jogador em estado morto (travado sem resgate)', () => {
    for (let index = 1; index <= 12; index += 1) {
      const { run } = playChamberOne(index * 104729);
      if (run.status !== 'playing') continue;
      if (playableMoves(run).length > 0) continue;
      // Sem encaixe: o engine precisa oferecer um resgate ou já ter encerrado.
      expect(isStuck(run)).toBe(false);
    }
  });

  it('uma run completa passa de 2 câmaras', () => {
    const chambers: number[] = [];
    for (let index = 1; index <= 6; index += 1) {
      let run = freshRun(index * 104729, NEW_META);
      let cleared = 0;
      let guard = 0;
      while (guard < 900) {
        guard += 1;
        if (run.status === 'stageClear') {
          cleared += 1;
          const pick = run.rewardOffer?.[0];
          if (!pick) break;
          const result = chooseReward(run, pick);
          if (!result.ok) break;
          run = result.state;
          continue;
        }
        if (run.status !== 'playing') break;
        const moves = playableMoves(run);
        if (moves.length === 0) break;
        const pick = moves[0];
        const result = placePiece(run, pick.index, pick.r, pick.c);
        if (!result.ok) break;
        run = result.state;
      }
      chambers.push(cleared);
    }
    console.info(`câmaras concluídas por run (bot): ${chambers.join(', ')}`);
    expect(Math.min(...chambers)).toBeGreaterThanOrEqual(2);
  });
});
