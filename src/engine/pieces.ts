import type { Board, Coord, Piece, PieceShape, ShapeTag, Special } from './types';
import { anyPlacement, canPlace, countFilled, isFilled, placementsFor } from './board';
import { nextId } from './rng';
import type { Rng } from './rng';

const C = (r: number, c: number): Coord => ({ r, c });

export function normalize(cells: Coord[]): Coord[] {
  const minR = Math.min(...cells.map((x) => x.r));
  const minC = Math.min(...cells.map((x) => x.c));
  return cells
    .map((x) => ({ r: x.r - minR, c: x.c - minC }))
    .sort((a, b) => a.r - b.r || a.c - b.c);
}

function rotate(cells: Coord[]): Coord[] {
  return normalize(cells.map(({ r, c }) => ({ r: c, c: -r })));
}

function signature(cells: Coord[]): string {
  return cells.map((x) => `${x.r}.${x.c}`).join('|');
}

function rotations(base: Coord[], max: number): Coord[][] {
  const out: Coord[][] = [];
  let current = normalize(base);
  for (let i = 0; i < max; i += 1) {
    if (!out.some((candidate) => signature(candidate) === signature(current))) out.push(current);
    current = rotate(current);
  }
  return out;
}

interface RawShape {
  id: string;
  cells: Coord[];
  weight: number;
  tags: ShapeTag[];
  rotations: number;
}

const RAW_SHAPES: RawShape[] = [
  { id: 'dot', cells: [C(0, 0)], weight: 7, tags: ['small'], rotations: 1 },
  { id: 'duo', cells: [C(0, 0), C(0, 1)], weight: 10, tags: ['small'], rotations: 2 },
  { id: 'tri', cells: [C(0, 0), C(0, 1), C(0, 2)], weight: 8, tags: ['small', 'line'], rotations: 2 },
  { id: 'corner', cells: [C(0, 0), C(1, 0), C(1, 1)], weight: 10, tags: ['corner'], rotations: 4 },
  { id: 'line4', cells: [C(0, 0), C(0, 1), C(0, 2), C(0, 3)], weight: 7, tags: ['line', 'big'], rotations: 2 },
  { id: 'square4', cells: [C(0, 0), C(0, 1), C(1, 0), C(1, 1)], weight: 9, tags: ['block', 'big'], rotations: 1 },
  { id: 'elbow4', cells: [C(0, 0), C(1, 0), C(2, 0), C(2, 1)], weight: 7, tags: ['corner', 'big'], rotations: 4 },
  { id: 'tee4', cells: [C(0, 0), C(0, 1), C(0, 2), C(1, 1)], weight: 6, tags: ['big'], rotations: 4 },
  { id: 'ess4', cells: [C(0, 1), C(0, 2), C(1, 0), C(1, 1)], weight: 5, tags: ['big'], rotations: 2 },
  { id: 'zee4', cells: [C(0, 0), C(0, 1), C(1, 1), C(1, 2)], weight: 5, tags: ['big'], rotations: 2 },
  { id: 'line5', cells: [C(0, 0), C(0, 1), C(0, 2), C(0, 3), C(0, 4)], weight: 3, tags: ['line', 'big'], rotations: 2 },
  { id: 'plus5', cells: [C(1, 0), C(1, 1), C(1, 2), C(0, 1), C(2, 1)], weight: 3, tags: ['plus', 'big'], rotations: 1 },
  {
    id: 'bigelbow',
    cells: [C(0, 0), C(1, 0), C(2, 0), C(2, 1), C(2, 2)],
    weight: 3,
    tags: ['corner', 'big'],
    rotations: 4,
  },
  {
    id: 'square9',
    cells: [C(0, 0), C(0, 1), C(0, 2), C(1, 0), C(1, 1), C(1, 2), C(2, 0), C(2, 1), C(2, 2)],
    weight: 1,
    tags: ['block', 'big'],
    rotations: 1,
  },
];

function buildShapes(): PieceShape[] {
  const out: PieceShape[] = [];
  for (const raw of RAW_SHAPES) {
    const forms = rotations(raw.cells, raw.rotations);
    const weight = raw.weight / forms.length;
    forms.forEach((cells, index) => {
      out.push({
        id: forms.length > 1 ? `${raw.id}-${index}` : raw.id,
        cells,
        weight: Math.max(1, Math.round(weight * 4)) / 4,
        size: cells.length,
        tags: raw.tags,
      });
    });
  }
  return out;
}

export const SHAPES: PieceShape[] = buildShapes();
const SHAPE_MAP = new Map(SHAPES.map((shape) => [shape.id, shape]));

export function shapeById(id: string): PieceShape | undefined {
  return SHAPE_MAP.get(id);
}

export function shapeBounds(cells: readonly Coord[]): { h: number; w: number } {
  let h = 0;
  let w = 0;
  for (const cell of cells) {
    h = Math.max(h, cell.r + 1);
    w = Math.max(w, cell.c + 1);
  }
  return { h, w };
}

export function makePiece(shape: PieceShape, color: number): Piece {
  return { id: nextId('pc'), shapeId: shape.id, cells: shape.cells.map((o) => ({ ...o })), color };
}

export function makeSpecialPiece(special: Special, color: number): Piece {
  const cells: Coord[] = special === 'tnt' ? [C(0, 0), C(0, 1)] : [C(0, 0)];
  return { id: nextId('sp'), shapeId: `special-${special}`, cells, color, special };
}

const SPECIALS: Special[] = ['prism', 'star', 'tnt'];

function shapeWeight(shape: PieceShape, preference: 'small' | 'heavy' | 'none'): number {
  if (preference === 'none') return shape.weight;
  const big = shape.tags.includes('big');
  if (preference === 'small') return shape.weight * (big ? 0.35 : 1.9);
  return shape.weight * (big ? 2.1 : 0.4);
}

function randomPiece(rng: Rng, preference: 'small' | 'heavy' | 'none'): Piece {
  const entries = SHAPES.map((shape) => ({ item: shape, weight: shapeWeight(shape, preference) }));
  const shape = rng.weighted(entries) ?? (SHAPES[0] as PieceShape);
  return makePiece(shape, rng.int(6));
}

function randomSpecial(rng: Rng): Piece {
  const special = rng.pick(SPECIALS);
  return makeSpecialPiece(special, rng.int(6));
}

export interface TrayOptions {
  specialChance?: number;
  forcePrism?: boolean;
  preference?: 'small' | 'heavy' | 'none';
  /** Desativa peças especiais (estágios "precisos"). */
  allowSpecials?: boolean;
  /** Reorganizar nível 3: prefere bandejas com peças que completam linha. */
  preferClear?: boolean;
}

/**
 * Conta até `limit` posições da peça que completariam uma linha ou coluna.
 * Verificação barata (sem clonar o tabuleiro), usada pelo `preferClear`.
 */
export function countCompletingPlacements(board: Board, piece: Piece, limit = 3): number {
  if (limit <= 0) return 0;
  let found = 0;
  for (let r = 0; r < board.size; r += 1) {
    for (let c = 0; c < board.size; c += 1) {
      if (!canPlace(board, piece, r, c)) continue;
      if (completesLineAt(board, piece, r, c)) {
        found += 1;
        if (found >= limit) return found;
      }
    }
  }
  return found;
}

function completesLineAt(board: Board, piece: Piece, r: number, c: number): boolean {
  const { h, w } = shapeBounds(piece.cells);
  const rows = new Set<number>();
  const cols = new Set<number>();
  for (const offset of piece.cells) {
    rows.add(r + offset.r);
    cols.add(c + offset.c);
  }
  for (const row of rows) {
    let filled = 0;
    for (let col = 0; col < board.size; col += 1) if (isFilled(board.cells[row][col])) filled += 1;
    let adds = 0;
    for (const offset of piece.cells) if (r + offset.r === row) adds += 1;
    if (filled + adds >= board.size) return true;
  }
  for (const col of cols) {
    let filled = 0;
    for (let row = 0; row < board.size; row += 1) if (isFilled(board.cells[row][col])) filled += 1;
    let adds = 0;
    for (const offset of piece.cells) if (c + offset.c === col) adds += 1;
    if (filled + adds >= board.size) return true;
  }
  // Garante que o span não saia do tabuleiro (canPlace já validou).
  return h <= 0 || w <= 0;
}

/**
 * Gera a bandeja de 3 peças garantindo que ao menos uma encaixa.
 * Prefere conjuntos com 2+ opções válidas para reduzir derrotas injustas.
 */
export function generateTray(board: Board, rng: Rng, options: TrayOptions = {}): Piece[] {
  const preference = options.preference ?? 'none';
  const specialChance = options.allowSpecials === false ? 0 : (options.specialChance ?? 0.06);
  const occupancy = countFilled(board) / (board.size * board.size);
  let best: Piece[] | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 26; attempt += 1) {
    const tray: Piece[] = [];
    for (let i = 0; i < 3; i += 1) {
      const forcedPrism = i === 0 && options.forcePrism;
      if (forcedPrism) tray.push(makeSpecialPiece('prism', rng.int(6)));
      else if (rng.chance(specialChance)) tray.push(randomSpecial(rng));
      else tray.push(randomPiece(rng, preference));
    }
    const placeable = tray.filter((piece) => placementsFor(board, piece).length > 0).length;
    const totalCells = tray.reduce((sum, piece) => sum + piece.cells.length, 0);
    let clears = 0;
    if (options.preferClear) {
      for (const piece of tray) {
        if (clears >= 3) break;
        clears += countCompletingPlacements(board, piece, 3 - clears);
      }
    }
    let value = placeable * 10 + Math.min(3, clears) * 7;
    if (occupancy > 0.55 && totalCells > 16) value -= 8;
    if (placeable === 0) value = -100;
    if (value > bestScore) {
      bestScore = value;
      best = tray;
    }
    if (placeable >= 2 && (!options.preferClear || clears > 0)) break;
  }

  if (best && bestScore > 0) return best;

  // Resgate: procura qualquer forma pequena que encaixe.
  const rescue = SHAPES.filter((shape) => shape.size <= 2).sort((a, b) => a.size - b.size);
  for (const shape of rescue) {
    const candidate = makePiece(shape, rng.int(6));
    if (placementsFor(board, candidate).length > 0) {
      return [
        candidate,
        makePiece(SHAPES[0] as PieceShape, rng.int(6)),
        makePiece(SHAPES[0] as PieceShape, rng.int(6)),
      ];
    }
  }
  return (
    best ?? [
      makePiece(SHAPES[0] as PieceShape, 0),
      makePiece(SHAPES[0] as PieceShape, 1),
      makePiece(SHAPES[0] as PieceShape, 2),
    ]
  );
}

export function trayHasPlacement(board: Board, tray: readonly (Piece | null)[], allowHazard = false): boolean {
  return anyPlacement(board, tray, { allowHazard });
}
