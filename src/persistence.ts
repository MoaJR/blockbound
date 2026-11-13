import { BOARD_SIZE, RUN_VERSION, TRAY_SIZE } from './engine/types';
import type { MetaState, RunState } from './engine/types';
import { META_VERSION, defaultMeta, defaultSettings, defaultStats } from './engine/meta';
import { DEFAULT_UNLOCKED } from './engine/relics';
import { DEFAULT_POWERS, POWER_ORDER, defaultPowerLevels } from './engine/powers';
import { energyMaxFor, initialEnergy } from './engine/progression';
import { deriveMods } from './engine/relics';

const META_KEY = 'blockbound.meta.v1';
const RUN_KEY = 'blockbound.run.v1';

let cachedStorage: Storage | null | undefined;

function storage(): Storage | null {
  if (cachedStorage !== undefined) return cachedStorage;
  try {
    const probe = '__blockbound_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    cachedStorage = window.localStorage;
  } catch {
    cachedStorage = null;
  }
  return cachedStorage;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeMeta(raw: unknown): MetaState {
  const base = defaultMeta();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<MetaState>;
  const stats = (data.stats ?? {}) as Record<string, unknown>;
  const settings = (data.settings ?? {}) as Record<string, unknown>;
  const meta: MetaState = {
    version: META_VERSION,
    crystals: Math.max(0, Math.floor(num(data.crystals, 0))),
    unlockedRelics: Array.isArray(data.unlockedRelics)
      ? data.unlockedRelics.filter((id): id is string => typeof id === 'string')
      : [...base.unlockedRelics],
    unlockedPowers: Array.isArray(data.unlockedPowers)
      ? data.unlockedPowers.filter((id): id is MetaState['unlockedPowers'][number] =>
          [...DEFAULT_POWERS, 'bomb', 'drill', 'convert'].includes(
            id as MetaState['unlockedPowers'][number],
          ),
        )
      : [...base.unlockedPowers],
    talents: typeof data.talents === 'object' && data.talents ? { ...data.talents } : {},
    achievements: Array.isArray(data.achievements)
      ? data.achievements.filter((id): id is string => typeof id === 'string')
      : [],
    stats: {
      ...defaultStats(),
      runs: num(stats.runs, 0),
      wins: num(stats.wins, 0),
      bestScore: num(stats.bestScore, 0),
      bestStage: num(stats.bestStage, 0),
      bestCombo: num(stats.bestCombo, 0),
      totalLines: num(stats.totalLines, 0),
      bestSimultaneous: num(stats.bestSimultaneous, 0),
      crystalsEarned: num(stats.crystalsEarned, 0),
      totalRelicsFound: num(stats.totalRelicsFound, 0),
      bossesDefeated: num(stats.bossesDefeated, 0),
      powersUsed: num(stats.powersUsed, 0),
      corruptDestroyed: num(stats.corruptDestroyed, 0),
      bombsDefused: num(stats.bombsDefused, 0),
      playSeconds: num(stats.playSeconds, 0),
    },
    settings: {
      ...defaultSettings(),
      volume: Math.min(1, Math.max(0, num(settings.volume, 0.7))),
      musicVolume: Math.min(1, Math.max(0, num(settings.musicVolume, 0.72))),
      sfxVolume: Math.min(1, Math.max(0, num(settings.sfxVolume, 0.9))),
      muted: Boolean(settings.muted),
      haptics: settings.haptics === undefined ? true : Boolean(settings.haptics),
      reducedMotion: Boolean(settings.reducedMotion),
      quality:
        settings.quality === 'high' || settings.quality === 'economy'
          ? settings.quality
          : 'auto',
    },
    seenIntro: Boolean(data.seenIntro),
    lastRun:
      data.lastRun && typeof data.lastRun === 'object'
        ? {
            score: num(data.lastRun.score, 0),
            stage: num(data.lastRun.stage, 0),
            won: Boolean(data.lastRun.won),
            at: num(data.lastRun.at, 0),
          }
        : null,
  };

  for (const id of DEFAULT_UNLOCKED) {
    if (!meta.unlockedRelics.includes(id)) meta.unlockedRelics.push(id);
  }
  for (const id of DEFAULT_POWERS) {
    if (!meta.unlockedPowers.includes(id)) meta.unlockedPowers.push(id);
  }
  return meta;
}

export function loadMeta(): MetaState {
  const store = storage();
  if (!store) return defaultMeta();
  try {
    const raw = store.getItem(META_KEY);
    if (!raw) return defaultMeta();
    return sanitizeMeta(JSON.parse(raw));
  } catch {
    try {
      store.removeItem(META_KEY);
    } catch {
      /* ignora */
    }
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* quota cheia: segue o jogo sem persistir */
  }
}

function isRunState(raw: unknown): raw is RunState {
  if (!raw || typeof raw !== 'object') return false;
  const run = raw as Partial<RunState>;
  if (run.version !== 1 && run.version !== RUN_VERSION) return false;
  if (!run.board || !Array.isArray(run.board.cells) || run.board.cells.length !== BOARD_SIZE) {
    return false;
  }
  if (!run.stage || typeof run.stage !== 'object' || !Array.isArray(run.stage.objectives)) {
    return false;
  }
  if (!Array.isArray(run.tray) || run.tray.length !== TRAY_SIZE) return false;
  if (run.status !== 'playing' && run.status !== 'stageClear') return false;
  return typeof run.score === 'number' && Array.isArray(run.relics);
}

/**
 * Hidrata saves anteriores à progressão in-run (v1 → v2) sem perder a run.
 * Campos novos recebem valores neutros e o teto de energia é recalculado.
 */
function migrateRun(raw: RunState): RunState {
  const run = raw;
  const levels = { ...defaultPowerLevels(), ...(run.powerLevels ?? {}) };
  for (const id of POWER_ORDER) {
    if (!levels[id] || levels[id] < 1) levels[id] = 1;
  }
  run.powerLevels = levels;
  run.fragments = typeof run.fragments === 'number' ? run.fragments : 0;
  run.pendingEvent = run.pendingEvent ?? null;
  run.eventMoves = typeof run.eventMoves === 'number' ? run.eventMoves : 0;
  run.eventsThisStage = typeof run.eventsThisStage === 'number' ? run.eventsThisStage : 0;
  if (!run.energy) {
    run.energy = initialEnergy(deriveMods(run.relics, run.talents, run.stage.modifier));
  } else {
    run.energy.max = energyMaxFor(deriveMods(run.relics, run.talents, run.stage.modifier));
    run.energy.value = Math.max(0, Math.min(run.energy.max, run.energy.value ?? 0));
    run.energy.pending = run.energy.pending ?? 0;
    run.energy.earned = run.energy.earned ?? 0;
    run.energy.claimed = run.energy.claimed ?? 0;
    run.energy.offer = run.energy.offer ?? null;
  }
  run.version = RUN_VERSION;
  return run;
}

export function loadRun(): RunState | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRunState(parsed)) {
      store.removeItem(RUN_KEY);
      return null;
    }
    return migrateRun(parsed);
  } catch {
    try {
      store.removeItem(RUN_KEY);
    } catch {
      /* ignora */
    }
    return null;
  }
}

export function saveRun(run: RunState | null): void {
  const store = storage();
  if (!store) return;
  try {
    if (!run || (run.status !== 'playing' && run.status !== 'stageClear')) {
      store.removeItem(RUN_KEY);
      return;
    }
    store.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* ignora falhas de quota */
  }
}

export function clearRun(): void {
  saveRun(null);
}

export function hasStoredRun(): boolean {
  return loadRun() !== null;
}
