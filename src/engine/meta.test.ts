import { describe, expect, it } from 'vitest';
import {
  TALENTS,
  buyPower,
  buyRelic,
  buyTalent,
  defaultMeta,
  defaultStats,
  metaSnapshot,
  recordRun,
  relicUnlockCost,
  talentCost,
  updateSettings,
} from './meta';
import { loadMeta, loadRun, saveMeta, saveRun } from '../persistence';
import { RELICS } from './relics';
import { DEFAULT_POWERS } from './powers';
import type { RunSummary } from './types';

function summary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    score: 5000,
    stage: 3,
    stageReached: 3,
    won: false,
    maxCombo: 9,
    maxSimultaneous: 2,
    lines: 20,
    relics: ['golden_crown'],
    crystals: 120,
    reason: 'moves',
    reasonLabel: 'Jogadas esgotadas',
    stats: {
      placements: 30,
      lines: 20,
      doubles: 2,
      maxCombo: 9,
      powersUsed: 1,
      corruptDestroyed: 4,
      bombsDefused: 1,
      frozenThawed: 2,
      bestDrop: 400,
      bosses: 0,
    },
    durationSeconds: 120,
    ...overrides,
  };
}

describe('metaprogressão', () => {
  it('começa com relíquias e poderes iniciais desbloqueados', () => {
    const meta = defaultMeta();
    expect(meta.unlockedRelics.length).toBeGreaterThan(8);
    for (const power of DEFAULT_POWERS) expect(meta.unlockedPowers).toContain(power);
    expect(meta.crystals).toBe(0);
    expect(meta.stats).toEqual(defaultStats());
  });

  it('desbloqueia relíquia pagando cristais', () => {
    const meta = { ...defaultMeta(), crystals: 5000 };
    const locked = RELICS.find((relic) => !meta.unlockedRelics.includes(relic.id));
    expect(locked).toBeDefined();
    const result = buyRelic(meta, locked?.id as string);
    expect(result.ok).toBe(true);
    expect(result.meta.unlockedRelics).toContain(locked?.id);
    expect(result.meta.crystals).toBeLessThan(meta.crystals);
    expect(result.meta.crystals).toBe(meta.crystals - relicUnlockCost(locked?.id as string));
  });

  it('não compra sem cristais', () => {
    const meta = defaultMeta();
    const locked = RELICS.find((relic) => !meta.unlockedRelics.includes(relic.id));
    const result = buyRelic(meta, locked?.id as string);
    expect(result.ok).toBe(false);
    expect(result.meta.crystals).toBe(0);
  });

  it('compra poder bloqueado', () => {
    const meta = { ...defaultMeta(), crystals: 1000 };
    const result = buyPower(meta, 'bomb');
    expect(result.ok).toBe(true);
    expect(result.meta.unlockedPowers).toContain('bomb');
  });

  it('sobe nível de talento com custo crescente', () => {
    const meta = { ...defaultMeta(), crystals: 5000 };
    const talent = TALENTS[0];
    if (!talent) throw new Error('talento ausente');
    const first = buyTalent(meta, talent.id);
    expect(first.ok).toBe(true);
    expect(first.meta.talents[talent.id]).toBe(1);
    const second = buyTalent(first.meta, talent.id);
    expect(second.ok).toBe(true);
    expect(second.meta.talents[talent.id]).toBe(2);
    const spent = meta.crystals - second.meta.crystals;
    expect(spent).toBe(talentCost(talent, 0) + talentCost(talent, 1));
  });

  it('registra run somando estatísticas e conquistas', () => {
    const record = recordRun(defaultMeta(), summary());
    expect(record.meta.stats.runs).toBe(1);
    expect(record.meta.stats.bestScore).toBe(5000);
    expect(record.meta.stats.bestStage).toBe(3);
    expect(record.meta.stats.bestCombo).toBe(9);
    expect(record.meta.stats.crystalsEarned).toBeGreaterThanOrEqual(120);
    expect(record.crystals).toBeGreaterThanOrEqual(120);
    expect(record.achievements.map((a) => a.id)).toContain('first_run');
    expect(record.meta.achievements).toContain('first_run');
  });

  it('concede conquista de vitória apenas uma vez', () => {
    const first = recordRun(defaultMeta(), summary({ won: true, stage: 8 }));
    expect(first.achievements.map((a) => a.id)).toContain('first_win');
    const second = recordRun(first.meta, summary({ won: true, stage: 8 }));
    expect(second.achievements.map((a) => a.id)).not.toContain('first_win');
    expect(second.meta.stats.wins).toBe(2);
  });

  it('atualiza configurações sem perder o resto', () => {
    const meta = updateSettings(defaultMeta(), { muted: true, volume: 0.3 });
    expect(meta.settings.muted).toBe(true);
    expect(meta.settings.volume).toBe(0.3);
    expect(meta.settings.haptics).toBe(true);
  });

  it('snapshot expõe apenas os desbloqueios', () => {
    const meta = defaultMeta();
    const snap = metaSnapshot(meta);
    expect(snap.unlockedRelics).toEqual(meta.unlockedRelics);
    expect(snap.unlockedPowers).toEqual(meta.unlockedPowers);
    expect(snap.talents).toEqual({});
  });
});

describe('persistência local', () => {
  it('não quebra quando o localStorage não existe (Node)', () => {
    const meta = loadMeta();
    expect(meta.version).toBe(1);
    expect(() => saveMeta(meta)).not.toThrow();
    expect(loadRun()).toBeNull();
    expect(() => saveRun(null)).not.toThrow();
  });
});
