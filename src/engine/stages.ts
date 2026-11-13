import type {
  Board,
  BossId,
  GameEvent,
  ModifierDef,
  ModifierId,
  Objective,
  ObjectiveKind,
  PowerId,
  RunMods,
  StageState,
} from './types';
import type { Rng } from './rng';
import { createBoard, freezeCells, spawnCorruption } from './board';
import { BOSS_MAP, createBoss, pickBoss } from './bosses';
import { createObjective } from './objectives';
import { POWER_ORDER, emptyCharges } from './powers';

export const MODIFIERS: ModifierDef[] = [
  { id: 'precise', name: 'Estágio Preciso', desc: 'Sem poderes e sem peças especiais.', tone: 'bad' },
  { id: 'no_powers', name: 'Silêncio Arcano', desc: 'Todos os poderes ficam desativados.', tone: 'bad' },
  { id: 'heavy', name: 'Gravidade Pesada', desc: 'Peças maiores aparecem com muito mais frequência.', tone: 'bad' },
  { id: 'frozen_start', name: 'Verniz de Gelo', desc: 'O tabuleiro começa com 4 células congeladas.', tone: 'wild' },
  { id: 'corrupt_start', name: 'Semente Corrompida', desc: 'O tabuleiro começa com 4 células corrompidas.', tone: 'wild' },
  { id: 'low_moves', name: 'Par Curto', desc: '3 jogadas de par a menos, mas +15% de pontos.', tone: 'wild' },
  { id: 'prism_rain', name: 'Chuva de Prismas', desc: 'Peças especiais aparecem com o dobro de chance.', tone: 'good' },
  { id: 'combo_hunger', name: 'Fome de Combo', desc: 'O combo cresce mais rápido neste estágio.', tone: 'good' },
];

export const MODIFIER_MAP: Record<ModifierId, ModifierDef> = Object.fromEntries(
  MODIFIERS.map((modifier) => [modifier.id, modifier]),
) as Record<ModifierId, ModifierDef>;

export const STAGE_TITLES = [
  'Primeiro Fragmento',
  'Fenda Aberta',
  'Câmara dos Ecos',
  'Trono do Meio',
  'Véu de Cristal',
  'Abismo Lento',
  'Coração Antigo',
  'Última Fronteira',
];

/**
 * Par de jogadas por câmara. Não é um limite: passar do par entra em
 * prorrogação (pressão no tabuleiro) e zera o bônus de eficiência.
 */
const PAR_BY_STAGE = [30, 34, 38, 42, 46, 50, 54, 58];

const PRIMARY_WEIGHTS: { kind: ObjectiveKind; weight: number }[] = [
  { kind: 'score', weight: 34 },
  { kind: 'lines', weight: 34 },
  { kind: 'double', weight: 14 },
  { kind: 'corrupt', weight: 12 },
  { kind: 'combo', weight: 8 },
];

export function stageTitle(index: number): string {
  return STAGE_TITLES[index] ?? `Estágio ${index + 1}`;
}

interface ObjectiveScale {
  score: number;
  lines: number;
  double: number;
  survive: number;
  corrupt: number;
  combo: number;
}

function objectiveScale(index: number): ObjectiveScale {
  return {
    score: 1200 + index * 300,
    lines: 7 + Math.round(index * 1.4),
    double: 2 + Math.floor(index / 2),
    survive: 12 + index * 2,
    corrupt: 5 + index,
    combo: 5 + Math.floor(index / 2),
  };
}

function makeObjective(kind: ObjectiveKind, index: number, rng: Rng, factor = 1): Objective {
  const scale = objectiveScale(index);
  if (kind === 'score') {
    const jitter = 0.92 + rng.next() * 0.22;
    const target = Math.round((scale.score * jitter * factor) / 50) * 50;
    return createObjective('score', target);
  }
  if (kind === 'lines') return createObjective('lines', Math.round(scale.lines * factor));
  if (kind === 'double') return createObjective('double', Math.max(1, Math.round(scale.double * factor)));
  if (kind === 'survive') return createObjective('survive', Math.round(scale.survive * factor));
  if (kind === 'corrupt') return createObjective('corrupt', Math.round(scale.corrupt * factor));
  if (kind === 'combo') return createObjective('combo', Math.round(scale.combo * factor));
  return createObjective('score', Math.round(scale.score * factor));
}

export interface StageBuildParams {
  index: number;
  rng: Rng;
  mods: RunMods;
  unlockedPowers: PowerId[];
  previousBoss: BossId | null;
  avoidModifier: ModifierId | null;
}

export interface StageBuild {
  stage: StageState;
  board: Board;
  events: GameEvent[];
}

function pickModifier(rng: Rng, index: number, avoid: ModifierId | null): ModifierId | null {
  if (index < 2) return null;
  if (!rng.chance(Math.min(0.85, 0.45 + index * 0.07))) return null;
  const pool = MODIFIERS.filter((modifier) => modifier.id !== avoid);
  return rng.weighted(pool.map((modifier) => ({ item: modifier.id, weight: 10 })));
}

export function buildStage(params: StageBuildParams): StageBuild {
  const { index, rng, mods, unlockedPowers, previousBoss, avoidModifier } = params;
  const stageNumber = index + 1;
  const isBoss = index === 3 || index === 7;
  const isFinal = index === 7;
  const board = createBoard();
  const events: GameEvent[] = [];

  let modifier: ModifierId | null = null;
  if (!isBoss) modifier = pickModifier(rng, index, avoidModifier);

  const objectives: Objective[] = [];
  let boss: StageState['boss'] = null;

  if (isBoss) {
    const def = pickBoss(rng, stageNumber, isFinal ? previousBoss : null);
    boss = createBoss(def.id, stageNumber, isFinal);
    objectives.push(createObjective('boss', boss.maxHp));
    events.push(...BOSS_MAP[def.id].startBoard(board, rng, stageNumber));
  } else {
    let primary: ObjectiveKind;
    if (index === 0) primary = 'score';
    else if (index === 1) primary = 'lines';
    else if (index === 2) primary = rng.chance(0.5) ? 'double' : 'corrupt';
    else {
      const pool = PRIMARY_WEIGHTS.filter((entry) => entry.kind !== 'combo' || index >= 4);
      primary =
        rng.weighted(pool.map((entry) => ({ item: entry.kind, weight: entry.weight }))) ?? 'score';
    }
    objectives.push(makeObjective(primary, index, rng));
    if (index >= 4 && rng.chance(0.45)) {
      const secondaryKind: ObjectiveKind = primary === 'score' ? 'lines' : 'score';
      objectives.push(makeObjective(secondaryKind, index, rng, 0.5));
    }
    if (modifier === 'frozen_start') {
      const cells = freezeCells(board, 4, rng);
      events.push({ type: 'spawn', cells, kind: 'frozen' });
    }
    if (modifier === 'corrupt_start') {
      const cells = spawnCorruption(board, 4, rng, 20);
      events.push({ type: 'spawn', cells, kind: 'corrupt' });
    }
  }

  let moves = PAR_BY_STAGE[index] ?? 30;
  if (isBoss) moves = Math.max(moves, 42);
  moves += mods.extraMoves;
  if (modifier === 'low_moves') moves -= 3;
  moves = Math.max(18, moves);

  const powersOff = modifier === 'precise' || modifier === 'no_powers';
  const charges = emptyCharges();
  for (const power of POWER_ORDER) {
    if (powersOff) {
      charges[power] = 0;
      continue;
    }
    const unlocked = unlockedPowers.includes(power);
    // Poderes conquistados na run (ou desbloqueados na meta) começam o estágio com 1 carga.
    const starter = unlocked ? 1 : 0;
    const relicBonus = mods.baseCharges[power] ?? 0;
    let value = starter + relicBonus;
    if (mods.masterTable && unlocked) value += 1;
    charges[power] = Math.max(0, value);
  }

  const stage: StageState = {
    index,
    number: stageNumber,
    objectives,
    movesLeft: moves,
    movesTotal: moves,
    modifier,
    charges,
    isBoss,
    isFinal,
    boss,
  };

  return { stage, board, events };
}
