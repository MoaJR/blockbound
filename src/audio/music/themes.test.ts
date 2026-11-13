import { describe, expect, it } from 'vitest';
import { LAYER_IDS, MOTIF_DEGREES, THEMES, totalSteps } from './themes';
import type { NoteHit } from './themes';

function checkNotes(label: string, themeId: string, notes: NoteHit[], steps: number) {
  for (const note of notes) {
    expect(note.step, `${themeId}/${label} step`).toBeGreaterThanOrEqual(0);
    expect(note.step, `${themeId}/${label} step`).toBeLessThan(steps);
    expect(note.dur, `${themeId}/${label} dur`).toBeGreaterThan(0);
    expect(note.midi, `${themeId}/${label} midi`).toBeGreaterThanOrEqual(24);
    expect(note.midi, `${themeId}/${label} midi`).toBeLessThanOrEqual(100);
  }
}

describe('composições originais', () => {
  it('define os sete temas do jogo com loops íntegros', () => {
    expect(Object.keys(THEMES)).toHaveLength(7);
    for (const theme of Object.values(THEMES)) {
      const steps = totalSteps(theme);
      expect(theme.bpm).toBeGreaterThanOrEqual(60);
      expect(theme.bpm).toBeLessThanOrEqual(140);
      expect(theme.chords).toHaveLength(theme.bars);
      expect(theme.pad).toHaveLength(theme.bars);
      checkNotes('bass', theme.id, theme.bass, steps);
      checkNotes('arp', theme.id, theme.arp, steps);
      checkNotes('melody', theme.id, theme.melody, steps);
      checkNotes('bells', theme.id, theme.bells, steps);
      checkNotes('tension', theme.id, theme.tension, steps);
      checkNotes('intro', theme.id, theme.intro, steps);
      for (const hit of theme.perc) {
        expect(hit.step).toBeGreaterThanOrEqual(0);
        expect(hit.step).toBeLessThan(steps);
      }
      for (const hit of theme.introPerc) {
        expect(hit.step).toBeGreaterThanOrEqual(0);
        expect(hit.step).toBeLessThan(steps);
      }
    }
  });

  it('mantém a identidade motívica e camadas completas', () => {
    expect(MOTIF_DEGREES).toHaveLength(8);
    for (const theme of Object.values(THEMES)) {
      for (const layer of LAYER_IDS) {
        expect(theme.layerGain[layer], `${theme.id}/${layer} gain`).toBeGreaterThanOrEqual(0);
        expect(theme.layerThreshold[layer], `${theme.id}/${layer} threshold`).toBeGreaterThanOrEqual(0);
        expect(theme.layerThreshold[layer], `${theme.id}/${layer} threshold`).toBeLessThanOrEqual(3);
      }
      expect(theme.melody.length, `${theme.id} melody`).toBeGreaterThan(0);
      expect(theme.bass.length, `${theme.id} bass`).toBeGreaterThan(0);
    }
  });

  it('mantém o motivo principal consonante com a tônica', () => {
    expect(MOTIF_DEGREES[0]).toBe(0);
    expect(MOTIF_DEGREES).toContain(3);
    expect(MOTIF_DEGREES).toContain(7);
    expect(Math.max(...MOTIF_DEGREES)).toBeLessThanOrEqual(14);
  });
});
