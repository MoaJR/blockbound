import type { Board, Coord, Piece } from './types';
import { placementConflicts } from './board';
import type { PlacementOptions } from './board';
import { shapeBounds } from './pieces';

/**
 * Projeção do arraste: canto superior esquerdo do bounding box da peça em
 * coordenadas de célula do tabuleiro (fracionárias, podem ser negativas).
 */
export interface PieceProjection {
  row: number;
  col: number;
}

export interface DropResolution {
  /** Âncora inteira (canto superior esquerdo em células). */
  anchor: Coord;
  valid: boolean;
  /** Células que impedem o encaixe (para o feedback vermelho). */
  blocked: Coord[];
  /** A âncora foi puxada para dentro do tabuleiro (peça maior que a sobra). */
  clamped: boolean;
}

/** Limita a âncora para que a peça caiba no tabuleiro. */
export function clampAnchor(board: Board, piece: Piece, anchor: Coord): Coord {
  const { h, w } = shapeBounds(piece.cells);
  const maxR = Math.max(0, board.size - h);
  const maxC = Math.max(0, board.size - w);
  return {
    r: Math.max(0, Math.min(maxR, Math.round(anchor.r))),
    c: Math.max(0, Math.min(maxC, Math.round(anchor.c))),
  };
}

/**
 * Converte a projeção fracionária na âncora de grade mais próxima.
 * Usada pelo preview E pela confirmação do drop — nunca duplicar.
 */
export function snapProjection(board: Board, piece: Piece, projection: PieceProjection): Coord {
  return clampAnchor(board, piece, { r: projection.row, c: projection.col });
}

export function resolveDrop(
  board: Board,
  piece: Piece,
  projection: PieceProjection,
  options: PlacementOptions = {},
): DropResolution {
  const raw = { r: Math.round(projection.row), c: Math.round(projection.col) };
  const anchor = clampAnchor(board, piece, raw);
  const clamped = anchor.r !== raw.r || anchor.c !== raw.c;
  const blocked = placementConflicts(board, piece, anchor.r, anchor.c, options);
  return { anchor, valid: blocked.length === 0, blocked, clamped };
}

/** Âncora para toque/teclado: célula tocada menos metade do span da peça. */
export function anchorFromCell(piece: Piece, cell: Coord): Coord {
  const { h, w } = shapeBounds(piece.cells);
  return {
    r: cell.r - Math.floor((h - 1) / 2),
    c: cell.c - Math.floor((w - 1) / 2),
  };
}

/** True quando a âncora deixa a peça inteira dentro do tabuleiro. */
export function anchorFits(board: Board, piece: Piece, anchor: Coord): boolean {
  const { h, w } = shapeBounds(piece.cells);
  return (
    anchor.r >= 0 && anchor.c >= 0 && anchor.r + h <= board.size && anchor.c + w <= board.size
  );
}
