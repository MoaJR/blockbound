import type { Board, BossId, BossState, Coord, GameEvent } from './types';
import type { Rng } from './rng';
import { applyGravity, freezeCells, plantBombs, spawnCorruption, tickBombs } from './board';

export interface BossClearInfo {
  lines: number;
  cells: Coord[];
  corrupt: Coord[];
  frozen: Coord[];
  bombs: Coord[];
}

export interface BossContext {
  board: Board;
  boss: BossState;
  rng: Rng;
  stageNumber: number;
  movesMade: number;
  points: number;
  clear: BossClearInfo | null;
}

export interface BossTickResult {
  damage: number;
  events: GameEvent[];
}

export interface BossDef {
  id: BossId;
  name: string;
  epithet: string;
  rule: string;
  accent: 'ice' | 'corrupt' | 'gravity' | 'boom';
  hpBase: number;
  hpPerStage: number;
  startBoard: (board: Board, rng: Rng, stageNumber: number) => GameEvent[];
  afterMove: (ctx: BossContext) => BossTickResult;
}

export const BOSSES: BossDef[] = [
  {
    id: 'ice_king',
    name: 'Rei de Gelo',
    epithet: 'O Trono Congelado',
    rule: 'Células de gelo bloqueiam encaixes. Destrua linhas perto delas para derretê-las.',
    accent: 'ice',
    hpBase: 10,
    hpPerStage: 1.2,
    startBoard: (board, rng) => {
      const cells = freezeCells(board, 4, rng);
      return cells.length > 0 ? [{ type: 'spawn', cells, kind: 'frozen' }] : [];
    },
    afterMove: ({ board, rng, movesMade, clear }) => {
      const events: GameEvent[] = [];
      let damage = 0;
      if (clear) damage += clear.frozen.length * 2 + clear.lines;
      if (movesMade % 2 === 0) {
        const frozen = freezeCells(board, 2, rng);
        if (frozen.length > 0) events.push({ type: 'spawn', cells: frozen, kind: 'frozen' });
      }
      return { damage, events };
    },
  },
  {
    id: 'corruption_king',
    name: 'Rei da Corrupção',
    epithet: 'A Praga que Ri',
    rule: 'Células corrompidas se espalham a cada jogada. Complete as linhas que as contêm.',
    accent: 'corrupt',
    hpBase: 12,
    hpPerStage: 1.4,
    startBoard: (board, rng) => {
      const cells = spawnCorruption(board, 5, rng, 14);
      return cells.length > 0 ? [{ type: 'spawn', cells, kind: 'corrupt' }] : [];
    },
    afterMove: ({ board, rng, movesMade, clear }) => {
      const events: GameEvent[] = [];
      let damage = (clear?.corrupt.length ?? 0) * 2;
      if (clear && clear.lines >= 2) damage += 1;
      const spread = 1 + (movesMade % 3 === 0 ? 1 : 0);
      const cells = spawnCorruption(board, spread, rng, 12);
      if (cells.length > 0) events.push({ type: 'spawn', cells, kind: 'corrupt' });
      return { damage, events };
    },
  },
  {
    id: 'gravity_king',
    name: 'Rei da Gravidade',
    epithet: 'O Peso do Mundo',
    rule: 'Depois de cada limpeza os blocos caem. Cada linha destruída fere o rei.',
    accent: 'gravity',
    hpBase: 10,
    hpPerStage: 1.2,
    startBoard: () => [],
    afterMove: ({ board, clear }) => {
      const events: GameEvent[] = [];
      if (clear && clear.lines > 0) {
        const shifted = applyGravity(board);
        if (shifted.length > 0) events.push({ type: 'shift', cells: shifted });
      }
      const damage = (clear?.lines ?? 0) * 2 + (clear && clear.lines >= 3 ? 2 : 0);
      return { damage, events };
    },
  },
  {
    id: 'explosive_king',
    name: 'Rei Explosivo',
    epithet: 'O Último Pavio',
    rule: 'Bombas surgem a cada 3 jogadas. Limpe as linhas delas antes do estouro.',
    accent: 'boom',
    hpBase: 10,
    hpPerStage: 1.2,
    startBoard: (board, rng) => {
      const cells = plantBombs(board, 2, rng, 5);
      return cells.length > 0 ? [{ type: 'spawn', cells, kind: 'bomb' }] : [];
    },
    afterMove: ({ board, rng, movesMade, clear }) => {
      const events: GameEvent[] = [];
      const damage = (clear?.bombs.length ?? 0) * 3 + (clear?.lines ?? 0);
      if (movesMade % 3 === 0) {
        const cells = plantBombs(board, 1, rng, 4);
        if (cells.length > 0) events.push({ type: 'spawn', cells, kind: 'bomb' });
      }
      const boom = tickBombs(board);
      if (boom.exploded.length > 0) {
        events.push({ type: 'toast', text: 'Uma bomba estourou!', tone: 'bad' });
        if (boom.corrupted.length > 0) events.push({ type: 'spawn', cells: boom.corrupted, kind: 'corrupt' });
      }
      return { damage, events };
    },
  },
];

export const BOSS_MAP: Record<BossId, BossDef> = Object.fromEntries(
  BOSSES.map((boss) => [boss.id, boss]),
) as Record<BossId, BossDef>;

export function bossHpFor(boss: BossDef, stageNumber: number, isFinal: boolean): number {
  const raw = boss.hpBase + boss.hpPerStage * stageNumber;
  return Math.round(raw * (isFinal ? 1.25 : 1));
}

export function createBoss(id: BossId, stageNumber: number, isFinal: boolean): BossState {
  const def = BOSS_MAP[id];
  const hp = bossHpFor(def, stageNumber, isFinal);
  return { id, hp, maxHp: hp, tick: 0, phase: 0, name: def.name };
}

export function pickBoss(rng: Rng, stageNumber: number, exclude: BossId | null = null): BossDef {
  const pool = BOSSES.filter((boss) => boss.id !== exclude);
  const weights = pool.map((boss) => ({ item: boss, weight: 10 }));
  void stageNumber;
  return rng.weighted(weights) ?? (BOSSES[0] as BossDef);
}
