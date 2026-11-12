import type { Coord, RunState, ScoreBreakdown } from './types';
import {
  cloneBoard,
  findFullLines,
  isFilled,
  pieceCells,
  placementConflicts,
  writePiece,
} from './board';
import { Rng } from './rng';
import { computeScore } from './scoring';
import { rarePlusCount } from './relics';
import { getMods } from './mods';
import { energyForPlacement } from './progression';
import { resolveDrop } from './placement';
import type { PieceProjection } from './placement';

export interface PreviewInfo {
  valid: boolean;
  anchor: Coord;
  lines: number;
  rows: number[];
  cols: number[];
  /** Footprint da peça (pode sair dos limites quando inválida). */
  cells: Coord[];
  /** Células que impedem o encaixe (preview vermelho). */
  blocked: Coord[];
  /** União linha ∪ coluna que será destruída. */
  cleared: Coord[];
  /** Células que a peça preencherá e que farão parte da destruição. */
  pieceCleared: Coord[];
  /** Células já ocupadas que serão destruídas. */
  boardCleared: Coord[];
  /** Interseções linha × coluna. */
  crossCells: Coord[];
  /** Pontuação real da jogada (mesma fórmula do `placePiece`). */
  score: ScoreBreakdown | null;
  /** Energia que a jogada concederia. */
  energy: number;
  label: string;
}

export function emptyPreview(anchor: Coord = { r: 0, c: 0 }): PreviewInfo {
  return {
    valid: false,
    anchor,
    lines: 0,
    rows: [],
    cols: [],
    cells: [],
    blocked: [],
    cleared: [],
    pieceCleared: [],
    boardCleared: [],
    crossCells: [],
    score: null,
    energy: 0,
    label: '',
  };
}

export function previewLabel(rows: readonly number[], cols: readonly number[]): string {
  const lines = rows.length + cols.length;
  if (lines === 0) return '';
  if (rows.length > 0 && cols.length > 0) return 'LINHA + COLUNA';
  if (lines === 1) return rows.length === 1 ? 'LINHA' : 'COLUNA';
  if (lines === 2) return 'DESTRUIÇÃO DUPLA';
  return `${lines} LINHAS COMBO`;
}

function unionClearCells(
  rows: readonly number[],
  cols: readonly number[],
  size: number,
): { cleared: Coord[]; crossCells: Coord[] } {
  const keys = new Set<string>();
  for (const r of rows) {
    for (let c = 0; c < size; c += 1) keys.add(`${r}:${c}`);
  }
  for (const c of cols) {
    for (let r = 0; r < size; r += 1) keys.add(`${r}:${c}`);
  }
  const cleared = [...keys]
    .map((key) => {
      const [r, c] = key.split(':').map(Number) as [number, number];
      return { r, c };
    })
    .sort((a, b) => a.r - b.r || a.c - b.c);
  const crossCells: Coord[] = [];
  for (const r of rows) {
    for (const c of cols) crossCells.push({ r, c });
  }
  return { cleared, crossCells };
}

/**
 * Simula a jogada em uma cópia lógica do tabuleiro e devolve tudo que o
 * preview precisa. Nunca altera a run, não consome poderes nem RNG real.
 */
export function previewPlacement(
  state: RunState,
  trayIndex: number,
  row: number,
  col: number,
): PreviewInfo {
  const piece = state.tray[trayIndex];
  const anchor = { r: row, c: col };
  if (!piece) return emptyPreview(anchor);

  const cells = pieceCells(piece, row, col);
  const options = { allowHazard: state.wildcardArmed };
  const blocked = placementConflicts(state.board, piece, row, col, options);
  if (blocked.length > 0) {
    return { ...emptyPreview(anchor), cells, blocked };
  }

  const board = cloneBoard(state.board);
  writePiece(board, piece, row, col);
  const full = findFullLines(board);
  const lines = full.rows.length + full.cols.length;
  const { cleared, crossCells } = unionClearCells(full.rows, full.cols, board.size);

  const footprint = new Set(cells.map(({ r, c }) => `${r}:${c}`));
  const pieceCleared: Coord[] = [];
  const boardCleared: Coord[] = [];
  for (const coord of cleared) {
    if (footprint.has(`${coord.r}:${coord.c}`)) pieceCleared.push(coord);
    else boardCleared.push(coord);
  }

  // Corrupção sob a peça (encaixe com Coringa) + corrupção nas linhas limpas.
  let corrupt = cells.filter(({ r, c }) => {
    const cell = state.board.cells[r]?.[c];
    return cell?.kind === 'corrupt';
  }).length;
  for (const { r, c } of cleared) {
    if (isFilled(state.board.cells[r][c]) && state.board.cells[r][c].kind === 'corrupt') corrupt += 1;
  }

  const mods = getMods(state);
  const blocks = piece.cells.length;
  const keepCombo = mods.comboKeepOnBigPlace > 0 && blocks >= mods.comboKeepOnBigPlace;
  const comboAfter = lines > 0 ? Math.min(40, state.combo + lines) : keepCombo ? state.combo : 0;

  // Mesmo RNG (clonado) e mesma ordem de consumo do `placePiece`:
  // `computeScore` é a primeira chamada estocástica, então o valor é idêntico.
  const rng = new Rng(state.rngState);
  const score = computeScore({
    blocks,
    lines,
    combo: state.combo,
    mods,
    rarePlus: rarePlusCount(state.relics),
    noClearStreak: state.noClearStreak,
    pieceMult: piece.special === 'prism' ? 3 : 1,
    rng,
  });

  const energy = energyForPlacement(
    {
      placed: 1,
      blocks,
      lines,
      extraLines: Math.max(0, lines - 1),
      combo: comboAfter,
      corrupt,
      special: Boolean(piece.special),
    },
    mods,
  );

  return {
    valid: true,
    anchor,
    lines,
    rows: full.rows,
    cols: full.cols,
    cells,
    blocked: [],
    cleared,
    pieceCleared,
    boardCleared,
    crossCells,
    score,
    energy,
    label: previewLabel(full.rows, full.cols),
  };
}

/**
 * Resolve a projeção do arraste (mesma função usada na confirmação) e devolve
 * o preview do encaixe resultante.
 */
export function previewAtProjection(
  state: RunState,
  trayIndex: number,
  projection: PieceProjection,
): PreviewInfo {
  const piece = state.tray[trayIndex];
  if (!piece) return emptyPreview();
  const resolution = resolveDrop(state.board, piece, projection, {
    allowHazard: state.wildcardArmed,
  });
  return previewPlacement(state, trayIndex, resolution.anchor.r, resolution.anchor.c);
}
