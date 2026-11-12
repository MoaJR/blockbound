import { BOARD_SIZE } from './types';
import type { Board, Cell, Coord, Piece } from './types';
import type { Rng } from './rng';

export const BLOCK_COLORS = 6;

export function emptyCell(): Cell {
  return { kind: 'empty', color: -1 };
}

export function createBoard(size: number = BOARD_SIZE): Board {
  const cells: Cell[][] = [];
  for (let r = 0; r < size; r += 1) {
    const row: Cell[] = [];
    for (let c = 0; c < size; c += 1) row.push(emptyCell());
    cells.push(row);
  }
  return { size, cells };
}

export function cloneBoard(board: Board): Board {
  return {
    size: board.size,
    cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
  };
}

export function inBounds(board: Board, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < board.size && c < board.size;
}

/** Célula conta como preenchida para completar linha. */
export function isFilled(cell: Cell): boolean {
  return cell.kind === 'block' || cell.kind === 'corrupt' || cell.kind === 'bomb';
}

export function isBlocking(cell: Cell): boolean {
  return cell.kind !== 'empty';
}

export function pieceCells(piece: Piece, r: number, c: number): Coord[] {
  return piece.cells.map((offset) => ({ r: r + offset.r, c: c + offset.c }));
}

export interface PlacementOptions {
  /** Coringa: ignora congelamento/corrupção no encaixe. */
  allowHazard?: boolean;
}

/**
 * Células que impedem o encaixe (fora dos limites ou ocupadas).
 * Regra única de colisão usada por `canPlace`, pela prévia e pelo drop.
 */
export function placementConflicts(
  board: Board,
  piece: Piece,
  r: number,
  c: number,
  options: PlacementOptions = {},
): Coord[] {
  const blocked: Coord[] = [];
  for (const offset of piece.cells) {
    const rr = r + offset.r;
    const cc = c + offset.c;
    if (!inBounds(board, rr, cc)) {
      blocked.push({ r: rr, c: cc });
      continue;
    }
    const cell = board.cells[rr][cc] as Cell;
    if (cell.kind === 'empty') continue;
    if (options.allowHazard && (cell.kind === 'frozen' || cell.kind === 'corrupt')) continue;
    blocked.push({ r: rr, c: cc });
  }
  return blocked;
}

export function canPlace(
  board: Board,
  piece: Piece,
  r: number,
  c: number,
  options: PlacementOptions = {},
): boolean {
  return placementConflicts(board, piece, r, c, options).length === 0;
}

export function placementsFor(board: Board, piece: Piece, options: PlacementOptions = {}): Coord[] {
  const out: Coord[] = [];
  for (let r = 0; r < board.size; r += 1) {
    for (let c = 0; c < board.size; c += 1) {
      if (canPlace(board, piece, r, c, options)) out.push({ r, c });
    }
  }
  return out;
}

export function anyPlacement(
  board: Board,
  pieces: readonly (Piece | null)[],
  options: PlacementOptions = {},
): boolean {
  for (const piece of pieces) {
    if (!piece) continue;
    for (let r = 0; r < board.size; r += 1) {
      for (let c = 0; c < board.size; c += 1) {
        if (canPlace(board, piece, r, c, options)) return true;
      }
    }
  }
  return false;
}

/** Escreve uma peça no tabuleiro (sem validar) e devolve as células absolutas. */
export function writePiece(board: Board, piece: Piece, r: number, c: number): Coord[] {
  const cells = pieceCells(piece, r, c);
  for (const coord of cells) {
    board.cells[coord.r][coord.c] = { kind: 'block', color: piece.color };
  }
  return cells;
}

export interface FullLines {
  rows: number[];
  cols: number[];
}

export function findFullLines(board: Board): FullLines {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < board.size; r += 1) {
    let full = true;
    for (let c = 0; c < board.size; c += 1) {
      if (!isFilled(board.cells[r][c] as Cell)) {
        full = false;
        break;
      }
    }
    if (full) rows.push(r);
  }
  for (let c = 0; c < board.size; c += 1) {
    let full = true;
    for (let r = 0; r < board.size; r += 1) {
      if (!isFilled(board.cells[r][c] as Cell)) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

export interface ClearedCells {
  cells: Coord[];
  corrupt: Coord[];
  bombs: Coord[];
  frozenNearby: Coord[];
}

/**
 * Remove as linhas completas e descongela células congeladas em volta delas.
 */
export function applyClear(board: Board, rows: number[], cols: number[]): ClearedCells {
  const toClear = new Set<string>();
  const corrupt: Coord[] = [];
  const bombs: Coord[] = [];
  const add = (r: number, c: number) => toClear.add(`${r}:${c}`);

  for (const r of rows) for (let c = 0; c < board.size; c += 1) add(r, c);
  for (const c of cols) for (let r = 0; r < board.size; r += 1) add(r, c);

  for (const key of toClear) {
    const [r, c] = key.split(':').map(Number) as [number, number];
    const cell = board.cells[r][c] as Cell;
    if (cell.kind === 'corrupt') corrupt.push({ r, c });
    if (cell.kind === 'bomb') bombs.push({ r, c });
    if (isFilled(cell)) board.cells[r][c] = emptyCell();
  }

  const cleared: Coord[] = [];
  for (const key of toClear) {
    const [r, c] = key.split(':').map(Number) as [number, number];
    cleared.push({ r, c });
  }
  cleared.sort((a, b) => a.r - b.r || a.c - b.c);

  // Descongela células congeladas nas linhas limpas ou ortogonalmente adjacentes.
  const frozenNearby: Coord[] = [];
  const clearSet = new Set(cleared.map((p) => `${p.r}:${p.c}`));
  for (let r = 0; r < board.size; r += 1) {
    for (let c = 0; c < board.size; c += 1) {
      const cell = board.cells[r][c] as Cell;
      if (cell.kind !== 'frozen') continue;
      const neighbors = [
        `${r - 1}:${c}`,
        `${r + 1}:${c}`,
        `${r}:${c - 1}`,
        `${r}:${c + 1}`,
        `${r}:${c}`,
      ];
      if (neighbors.some((key) => clearSet.has(key))) {
        board.cells[r][c] = emptyCell();
        frozenNearby.push({ r, c });
      }
    }
  }

  return { cells: cleared, corrupt, bombs, frozenNearby };
}

export function destroyCells(board: Board, coords: readonly Coord[]): Coord[] {
  const destroyed: Coord[] = [];
  for (const { r, c } of coords) {
    if (!inBounds(board, r, c)) continue;
    if (board.cells[r][c].kind === 'empty') continue;
    board.cells[r][c] = emptyCell();
    destroyed.push({ r, c });
  }
  return destroyed;
}

export function areaAround(r: number, c: number, radius: number, board: Board): Coord[] {
  const out: Coord[] = [];
  for (let dr = -radius; dr <= radius; dr += 1) {
    for (let dc = -radius; dc <= radius; dc += 1) {
      const rr = r + dr;
      const cc = c + dc;
      if (inBounds(board, rr, cc)) out.push({ r: rr, c: cc });
    }
  }
  return out;
}

export function rowCells(board: Board, r: number): Coord[] {
  const out: Coord[] = [];
  for (let c = 0; c < board.size; c += 1) out.push({ r, c });
  return out;
}

export function countFilled(board: Board): number {
  let total = 0;
  for (const row of board.cells) for (const cell of row) if (isBlocking(cell)) total += 1;
  return total;
}

export function countKind(board: Board, kind: Cell['kind']): number {
  let total = 0;
  for (const row of board.cells) for (const cell of row) if (cell.kind === kind) total += 1;
  return total;
}

export function emptyCoords(board: Board): Coord[] {
  const out: Coord[] = [];
  for (let r = 0; r < board.size; r += 1) {
    for (let c = 0; c < board.size; c += 1) {
      if (board.cells[r][c].kind === 'empty') out.push({ r, c });
    }
  }
  return out;
}

export function filledCoords(board: Board): Coord[] {
  const out: Coord[] = [];
  for (let r = 0; r < board.size; r += 1) {
    for (let c = 0; c < board.size; c += 1) {
      if (isFilled(board.cells[r][c])) out.push({ r, c });
    }
  }
  return out;
}

/** Espalha corrupção em células vazias, preservando espaço mínimo jogável. */
export function spawnCorruption(board: Board, count: number, rng: Rng, minEmpty = 12): Coord[] {
  const empties = emptyCoords(board);
  const allowed = Math.max(0, Math.min(count, empties.length - minEmpty));
  const chosen = rng.shuffle(empties).slice(0, allowed);
  for (const coord of chosen) {
    board.cells[coord.r][coord.c] = { kind: 'corrupt', color: 3 };
  }
  return chosen;
}

export function freezeCells(board: Board, count: number, rng: Rng, maxFrozen = 14): Coord[] {
  const empties = emptyCoords(board);
  const existing = countKind(board, 'frozen');
  const budget = Math.max(0, Math.min(count, maxFrozen - existing, empties.length));
  const chosen = rng.shuffle(empties).slice(0, budget);
  for (const coord of chosen) {
    board.cells[coord.r][coord.c] = { kind: 'frozen', color: 4 };
  }
  return chosen;
}

export function plantBombs(board: Board, count: number, rng: Rng, timer = 4, maxBombs = 4): Coord[] {
  const empties = emptyCoords(board);
  const existing = countKind(board, 'bomb');
  const budget = Math.max(0, Math.min(count, maxBombs - existing, empties.length));
  const chosen = rng.shuffle(empties).slice(0, budget);
  for (const coord of chosen) {
    board.cells[coord.r][coord.c] = { kind: 'bomb', color: 5, timer };
  }
  return chosen;
}

export interface BombExplosion {
  exploded: Coord[];
  corrupted: Coord[];
}

/** Conta o tempo das bombas; as que chegam a zero explodem em corrupção local. */
export function tickBombs(board: Board): BombExplosion {
  const exploded: Coord[] = [];
  const corrupted: Coord[] = [];
  for (let r = 0; r < board.size; r += 1) {
    for (let c = 0; c < board.size; c += 1) {
      const cell = board.cells[r][c] as Cell;
      if (cell.kind !== 'bomb') continue;
      const timer = (cell.timer ?? 0) - 1;
      if (timer > 0) {
        board.cells[r][c] = { ...cell, timer };
        continue;
      }
      board.cells[r][c] = emptyCell();
      exploded.push({ r, c });
      const targets = [
        { r: r - 1, c },
        { r: r + 1, c },
        { r, c: c - 1 },
        { r, c: c + 1 },
      ];
      for (const target of targets) {
        if (!inBounds(board, target.r, target.c)) continue;
        const neighbor = board.cells[target.r][target.c] as Cell;
        if (neighbor.kind === 'empty' || neighbor.kind === 'frozen') {
          board.cells[target.r][target.c] = { kind: 'corrupt', color: 3 };
          corrupted.push(target);
        }
      }
    }
  }
  return { exploded, corrupted };
}

/** Rei da Gravidade: blocos caem para o fundo das colunas. */
export function applyGravity(board: Board): Coord[] {
  const shifted: Coord[] = [];
  for (let c = 0; c < board.size; c += 1) {
    const stack: Cell[] = [];
    for (let r = board.size - 1; r >= 0; r -= 1) {
      const cell = board.cells[r][c] as Cell;
      if (isFilled(cell)) stack.push({ ...cell });
    }
    for (let r = board.size - 1, i = 0; r >= 0; r -= 1, i += 1) {
      const next = stack[i];
      const current = board.cells[r][c] as Cell;
      if (next) {
        if (current.kind !== next.kind) shifted.push({ r, c });
        board.cells[r][c] = next;
      } else if (current.kind !== 'empty') {
        board.cells[r][c] = emptyCell();
        shifted.push({ r, c });
      }
    }
  }
  return shifted;
}
