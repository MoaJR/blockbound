import type {
  MetaSnapshot,
  MetaState,
  MetaStats,
  PowerId,
  RunSummary,
  Settings,
  TalentDef,
  TalentId,
} from './types';
import { DEFAULT_UNLOCKED, RARITY_COST, RELIC_MAP } from './relics';
import { DEFAULT_POWERS, POWER_MAP } from './powers';
import { evaluateAchievements } from './achievements';
import type { AchievementDef } from './achievements';

export const META_VERSION = 1;

export const TALENTS: TalentDef[] = [
  {
    id: 'power_start',
    name: 'Mão Extra',
    desc: '+1 carga de Martelo em cada estágio.',
    maxLevel: 3,
    baseCost: 150,
  },
  {
    id: 'crystal_flow',
    name: 'Fluxo de Cristais',
    desc: '+8% de cristais ao final de cada run.',
    maxLevel: 3,
    baseCost: 180,
  },
  {
    id: 'extra_reroll',
    name: 'Sorte do Comerciante',
    desc: '+1 reroll de recompensa por estágio.',
    maxLevel: 2,
    baseCost: 260,
  },
  {
    id: 'vital_moves',
    name: 'Fôlego Extra',
    desc: '+1 de par em cada câmara (máximo 2) — mais bônus de eficiência.',
    maxLevel: 2,
    baseCost: 320,
  },
];

export function defaultStats(): MetaStats {
  return {
    runs: 0,
    wins: 0,
    bestScore: 0,
    bestStage: 0,
    bestCombo: 0,
    totalLines: 0,
    bestSimultaneous: 0,
    crystalsEarned: 0,
    totalRelicsFound: 0,
    bossesDefeated: 0,
    powersUsed: 0,
    corruptDestroyed: 0,
    bombsDefused: 0,
    playSeconds: 0,
  };
}

export function defaultSettings(): Settings {
  return {
    volume: 0.7,
    musicVolume: 0.72,
    sfxVolume: 0.9,
    muted: false,
    haptics: true,
    reducedMotion: false,
    quality: 'auto',
  };
}

export function defaultMeta(): MetaState {
  return {
    version: META_VERSION,
    crystals: 0,
    unlockedRelics: [...DEFAULT_UNLOCKED],
    unlockedPowers: [...DEFAULT_POWERS],
    talents: {},
    achievements: [],
    stats: defaultStats(),
    settings: defaultSettings(),
    seenIntro: false,
    lastRun: null,
  };
}

export function cloneMeta(meta: MetaState): MetaState {
  return {
    ...meta,
    unlockedRelics: [...meta.unlockedRelics],
    unlockedPowers: [...meta.unlockedPowers],
    talents: { ...meta.talents },
    achievements: [...meta.achievements],
    stats: { ...meta.stats },
    settings: { ...meta.settings },
    lastRun: meta.lastRun ? { ...meta.lastRun } : null,
  };
}

export function metaSnapshot(meta: MetaState): MetaSnapshot {
  return {
    unlockedRelics: [...meta.unlockedRelics],
    unlockedPowers: [...meta.unlockedPowers],
    talents: { ...meta.talents },
  };
}

export function talentLevel(meta: MetaState, id: TalentId): number {
  return meta.talents[id] ?? 0;
}

export function talentCost(talent: TalentDef, level: number): number {
  return Math.round(talent.baseCost * Math.pow(1.7, level));
}

export function relicUnlockCost(id: string): number {
  const relic = RELIC_MAP[id];
  return relic ? RARITY_COST[relic.rarity] : 0;
}

export function powerUnlockCost(id: PowerId): number {
  return POWER_MAP[id]?.unlockCost ?? 0;
}

export interface PurchaseResult {
  meta: MetaState;
  ok: boolean;
  reason?: string;
}

export function buyRelic(metaIn: MetaState, id: string): PurchaseResult {
  if (metaIn.unlockedRelics.includes(id)) return { meta: metaIn, ok: false, reason: 'Já desbloqueada.' };
  const cost = relicUnlockCost(id);
  if (cost <= 0) return { meta: metaIn, ok: false, reason: 'Relíquia desconhecida.' };
  if (metaIn.crystals < cost) return { meta: metaIn, ok: false, reason: 'Cristais insuficientes.' };
  const meta = cloneMeta(metaIn);
  meta.crystals -= cost;
  meta.unlockedRelics.push(id);
  return { meta, ok: true };
}

export function buyPower(metaIn: MetaState, id: PowerId): PurchaseResult {
  if (metaIn.unlockedPowers.includes(id)) return { meta: metaIn, ok: false, reason: 'Já desbloqueado.' };
  const cost = powerUnlockCost(id);
  if (cost <= 0) return { meta: metaIn, ok: false, reason: 'Poder desconhecido.' };
  if (metaIn.crystals < cost) return { meta: metaIn, ok: false, reason: 'Cristais insuficientes.' };
  const meta = cloneMeta(metaIn);
  meta.crystals -= cost;
  meta.unlockedPowers.push(id);
  return { meta, ok: true };
}

export function buyTalent(metaIn: MetaState, id: TalentId): PurchaseResult {
  const talent = TALENTS.find((entry) => entry.id === id);
  if (!talent) return { meta: metaIn, ok: false, reason: 'Talento desconhecido.' };
  const level = talentLevel(metaIn, id);
  if (level >= talent.maxLevel) return { meta: metaIn, ok: false, reason: 'Nível máximo.' };
  const cost = talentCost(talent, level);
  if (metaIn.crystals < cost) return { meta: metaIn, ok: false, reason: 'Cristais insuficientes.' };
  const meta = cloneMeta(metaIn);
  meta.crystals -= cost;
  meta.talents[id] = level + 1;
  return { meta, ok: true };
}

export function updateSettings(metaIn: MetaState, patch: Partial<Settings>): MetaState {
  const meta = cloneMeta(metaIn);
  meta.settings = { ...meta.settings, ...patch };
  return meta;
}

export interface RunRecord {
  meta: MetaState;
  crystals: number;
  achievements: AchievementDef[];
}

/** Aplica o resultado de uma run à metaprogressão e devolve as conquistas novas. */
export function recordRun(metaIn: MetaState, summary: RunSummary): RunRecord {
  const meta = cloneMeta(metaIn);
  const crystals = Math.max(0, Math.round(summary.crystals));
  meta.crystals += crystals;
  meta.stats.runs += 1;
  if (summary.won) meta.stats.wins += 1;
  meta.stats.bestScore = Math.max(meta.stats.bestScore, summary.score);
  meta.stats.bestStage = Math.max(meta.stats.bestStage, summary.stage);
  meta.stats.bestCombo = Math.max(meta.stats.bestCombo, summary.maxCombo);
  meta.stats.bestSimultaneous = Math.max(meta.stats.bestSimultaneous, summary.maxSimultaneous);
  meta.stats.totalLines += summary.lines;
  meta.stats.crystalsEarned += crystals;
  meta.stats.totalRelicsFound += summary.relics.length;
  meta.stats.bossesDefeated += summary.stats.bosses;
  meta.stats.powersUsed += summary.stats.powersUsed;
  meta.stats.corruptDestroyed += summary.stats.corruptDestroyed;
  meta.stats.bombsDefused += summary.stats.bombsDefused;
  meta.stats.playSeconds += summary.durationSeconds;
  meta.lastRun = { score: summary.score, stage: summary.stage, won: summary.won, at: Date.now() };

  const achievements = evaluateAchievements(meta, summary);
  let bonus = 0;
  for (const achievement of achievements) {
    meta.achievements.push(achievement.id);
    meta.crystals += achievement.crystals;
    meta.stats.crystalsEarned += achievement.crystals;
    bonus += achievement.crystals;
  }

  return { meta, crystals: crystals + bonus, achievements };
}
