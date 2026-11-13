/**
 * Biblioteca de efeitos sonoros originais do BLOCKBOUND.
 *
 * Cada som é uma pequena receita de síntese (osciladores, ruído filtrado,
 * envelopes e pan). Sons repetidos recebem variação de altura/ganho e têm
 * throttle próprio para nunca virarem metralhadoras.
 */

import type { Rarity } from '../engine/types';
import { audioCore } from './core';
import type { AudioSettings } from './core';
import { bass, bell, mallet, noise, pluck, sparkle, thump, tone } from './instruments';

export type SfxName =
  | 'place'
  | 'deny'
  | 'clear1'
  | 'clear2'
  | 'clear3'
  | 'clear4'
  | 'clearRow'
  | 'clearCol'
  | 'clearCross'
  | 'combo'
  | 'comboHigh'
  | 'multiplier'
  | 'power'
  | 'powerSelect'
  | 'hammer'
  | 'bomb'
  | 'drill'
  | 'shuffle'
  | 'convert'
  | 'wildcard'
  | 'relic'
  | 'relicLegendary'
  | 'reward'
  | 'rewardRare'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'uiSelect'
  | 'uiOpen'
  | 'uiClose'
  | 'toggle'
  | 'boss'
  | 'bossHit'
  | 'bossIntro'
  | 'bossDefeat'
  | 'star'
  | 'stageClear'
  | 'stageUp'
  | 'crystal'
  | 'fragment'
  | 'achievement'
  | 'energyReady'
  | 'buy'
  | 'select'
  | 'pick'
  | 'dragStart'
  | 'dragTick'
  | 'drop'
  | 'special'
  | 'prism'
  | 'tnt'
  | 'magic'
  | 'error';

const RARITY_INDEX: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const MIN_GAP: Partial<Record<SfxName, number>> = {
  dragTick: 0.09,
  click: 0.035,
  place: 0.04,
  select: 0.035,
  relic: 1,
  combo: 0.08,
  crystal: 0.06,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function variation(amount = 0.025): number {
  return 1 + (Math.random() * 2 - 1) * amount;
}

class SfxEngine {
  private settings: AudioSettings = {
    volume: 0.7,
    musicVolume: 0.72,
    sfxVolume: 0.9,
    muted: false,
  };
  private lastAt: Partial<Record<SfxName, number>> = {};

  configure(settings: AudioSettings): void {
    this.settings = { ...settings };
    audioCore.configure(settings);
  }

  unlock(): void {
    audioCore.unlock();
  }

  private ready(): { ctx: AudioContext; dest: AudioNode } | null {
    if (this.settings.muted || this.settings.volume <= 0 || this.settings.sfxVolume <= 0) return null;
    const graph = audioCore.isUnlocked() ? audioCore.get() : audioCore.unlock();
    if (!graph) return null;
    return { ctx: graph.ctx, dest: graph.sfx };
  }

  private allowed(name: SfxName, now: number): boolean {
    const gap = MIN_GAP[name] ?? 0.022;
    const last = this.lastAt[name] ?? -10;
    if (now - last < gap) return false;
    this.lastAt[name] = now;
    return true;
  }

  playRelic(rarity: Rarity): void {
    this.play('relic', RARITY_INDEX[rarity] ?? 0);
  }

  preview(): void {
    this.play('uiSelect');
  }

  play(name: SfxName, detail = 0): void {
    const graph = this.ready();
    if (!graph) return;
    const { ctx, dest } = graph;
    const now = ctx.currentTime;
    if (!this.allowed(name, now)) return;

    const t = now + 0.002;
    const panAlt = Math.random() > 0.5 ? 0.12 : -0.12;
    const pitch = variation();
    const level = clamp(detail, 0, 20);

    switch (name) {
      case 'select':
        tone({ ctx, dest, when: t, freq: 720 * pitch, dur: 0.05, type: 'sine', gain: 0.05 });
        break;
      case 'pick':
        pluck(ctx, dest, t, 520 * pitch, 0.08, 0.08);
        noise({ ctx, dest, when: t, dur: 0.035, gain: 0.025, type: 'highpass', freq: 2600 });
        break;
      case 'dragStart':
        noise({ ctx, dest, when: t, dur: 0.08, gain: 0.04, type: 'bandpass', freq: 550, slideTo: 1400 });
        pluck(ctx, dest, t, 420 * pitch, 0.06, 0.05);
        break;
      case 'dragTick':
        tone({ ctx, dest, when: t, freq: 1380 * pitch, dur: 0.018, type: 'sine', gain: 0.018 });
        break;
      case 'drop':
        noise({ ctx, dest, when: t, dur: 0.09, gain: 0.05, type: 'lowpass', freq: 900, slideTo: 300 });
        break;
      case 'place':
        thump(ctx, dest, t, 0.15);
        mallet(ctx, dest, t, 190 * pitch, 0.14, 0.12);
        break;
      case 'deny':
      case 'error':
        tone({ ctx, dest, when: t, freq: 165 * pitch, dur: 0.14, type: 'sawtooth', gain: 0.09, slideTo: 92 });
        tone({ ctx, dest, when: t + 0.04, freq: 138, dur: 0.12, type: 'square', gain: 0.045, slideTo: 78 });
        break;
      case 'clear1':
        mallet(ctx, dest, t, 784 * pitch, 0.18, 0.12, panAlt);
        sparkle(ctx, dest, t + 0.03, 1046 * pitch, 0.04);
        break;
      case 'clear2':
        [523, 659, 880].forEach((freq, index) =>
          mallet(ctx, dest, t + index * 0.045, freq * pitch, 0.2, 0.11, index % 2 ? -0.1 : 0.1),
        );
        noise({ ctx, dest, when: t, dur: 0.2, gain: 0.04, type: 'highpass', freq: 2200 });
        break;
      case 'clear3':
        [523, 659, 784, 1046, 1318].forEach((freq, index) =>
          mallet(ctx, dest, t + index * 0.04, freq * pitch, 0.24, 0.105, index % 2 ? -0.12 : 0.12),
        );
        thump(ctx, dest, t, 0.1);
        noise({ ctx, dest, when: t, dur: 0.3, gain: 0.06, type: 'highpass', freq: 3000 });
        break;
      case 'clear4':
        [392, 523, 659, 784, 1046, 1318, 1568].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.035, freq * pitch, 0.3, 0.09, index % 2 ? -0.15 : 0.15),
        );
        thump(ctx, dest, t, 0.18);
        noise({ ctx, dest, when: t, dur: 0.4, gain: 0.08, type: 'bandpass', freq: 2600 });
        break;
      case 'clearRow':
        [523, 659, 784, 1046].forEach((freq, index) =>
          pluck(ctx, dest, t + index * 0.035, freq * pitch, 0.18, 0.1, -0.22 + index * 0.08),
        );
        noise({ ctx, dest, when: t, dur: 0.22, gain: 0.05, type: 'bandpass', freq: 1800, slideTo: 4200 });
        break;
      case 'clearCol':
        [392, 523, 659, 784].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.045, freq * pitch, 0.24, 0.085, 0.22 - index * 0.08),
        );
        noise({ ctx, dest, when: t, dur: 0.25, gain: 0.04, type: 'highpass', freq: 900, slideTo: 3100 });
        break;
      case 'clearCross':
        [523, 784, 1046, 1318].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.03, freq * pitch, 0.28, 0.1, index % 2 ? 0.18 : -0.18),
        );
        [392, 523, 784].forEach((freq, index) =>
          mallet(ctx, dest, t + 0.08 + index * 0.05, freq * pitch, 0.22, 0.09),
        );
        thump(ctx, dest, t, 0.14);
        break;
      case 'combo':
      case 'comboHigh': {
        const base = [523, 587, 659, 784, 880, 1046, 1174, 1318];
        const start = Math.min(base.length - 3, Math.max(0, Math.floor(level) - 2));
        for (let index = 0; index < 4; index += 1) {
          const freq = base[(start + index) % base.length] ?? 523;
          mallet(ctx, dest, t + index * 0.045, freq * pitch, 0.22, 0.1, index % 2 ? -0.1 : 0.1);
        }
        if (name === 'comboHigh' || level >= 5) {
          sparkle(ctx, dest, t + 0.1, 1568 * pitch, 0.06);
          thump(ctx, dest, t, 0.08);
        }
        break;
      }
      case 'powerSelect':
        tone({ ctx, dest, when: t, freq: 880 * pitch, dur: 0.09, type: 'sine', gain: 0.06, slideTo: 1320 });
        break;
      case 'power':
        noise({ ctx, dest, when: t, dur: 0.22, gain: 0.07, type: 'bandpass', freq: 700, slideTo: 220 });
        thump(ctx, dest, t, 0.12);
        break;
      case 'hammer':
        thump(ctx, dest, t, 0.22);
        noise({ ctx, dest, when: t, dur: 0.14, gain: 0.09, type: 'bandpass', freq: 1300, q: 0.7 });
        break;
      case 'bomb':
        bass(ctx, dest, t, 72, 0.5, 0.24, 0);
        noise({ ctx, dest, when: t, dur: 0.5, gain: 0.14, type: 'lowpass', freq: 900, slideTo: 120 });
        noise({ ctx, dest, when: t + 0.12, dur: 0.2, gain: 0.06, type: 'highpass', freq: 2400 });
        break;
      case 'drill':
        tone({ ctx, dest, when: t, freq: 210, dur: 0.32, type: 'sawtooth', gain: 0.08, slideTo: 90 });
        noise({ ctx, dest, when: t, dur: 0.32, gain: 0.07, type: 'bandpass', freq: 1200, slideTo: 420 });
        break;
      case 'shuffle':
        noise({ ctx, dest, when: t, dur: 0.3, gain: 0.07, type: 'bandpass', freq: 400, slideTo: 3600 });
        [0, 0.06, 0.12].forEach((offset, index) =>
          pluck(ctx, dest, t + offset, (480 + index * 120) * pitch, 0.06, 0.05),
        );
        break;
      case 'convert':
      case 'magic':
        [523, 659, 784, 1046].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.04, freq * pitch, 0.35, 0.07, index % 2 ? 0.1 : -0.1),
        );
        noise({ ctx, dest, when: t, dur: 0.28, gain: 0.035, type: 'bandpass', freq: 2600, slideTo: 1200 });
        break;
      case 'wildcard':
        sparkle(ctx, dest, t, 880 * pitch, 0.07);
        tone({ ctx, dest, when: t, freq: 1320, dur: 0.2, type: 'sine', gain: 0.045, slideTo: 1760 });
        break;
      case 'special':
        [659, 880, 1174, 1568].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.035, freq * pitch, 0.32, 0.08, index % 2 ? 0.15 : -0.15),
        );
        break;
      case 'prism':
        [1046, 1318, 1568, 2093].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.03, freq * pitch, 0.28, 0.055, index % 2 ? 0.2 : -0.2),
        );
        break;
      case 'tnt':
        thump(ctx, dest, t, 0.18);
        noise({ ctx, dest, when: t, dur: 0.25, gain: 0.09, type: 'lowpass', freq: 700 });
        break;
      case 'relic': {
        const rarity = Math.round(clamp(detail, 0, 4));
        const notes = [523, 659, 784, 1046, 1318];
        const count = 2 + rarity;
        for (let index = 0; index < count; index += 1) {
          bell(
            ctx,
            dest,
            t + index * 0.055,
            (notes[index % notes.length] ?? 523) * pitch,
            0.36,
            0.075,
            index % 2 ? 0.15 : -0.15,
          );
        }
        if (rarity >= 3) {
          thump(ctx, dest, t, 0.1);
          sparkle(ctx, dest, t + 0.1, 1318 * pitch, 0.06);
        }
        break;
      }
      case 'multiplier':
        [659, 880].forEach((freq, index) =>
          tone({
            ctx,
            dest,
            when: t + index * 0.05,
            freq: freq * pitch,
            dur: 0.1,
            type: 'triangle',
            gain: 0.06,
          }),
        );
        break;
      case 'relicLegendary':
        this.play('relic', 4);
        bass(ctx, dest, t, 98, 0.6, 0.14, 0);
        noise({ ctx, dest, when: t, dur: 0.5, gain: 0.04, type: 'highpass', freq: 3200 });
        break;
      case 'reward':
      case 'rewardRare': {
        const notes = name === 'rewardRare' ? [659, 880, 1046, 1318, 1568] : [659, 880, 1174];
        notes.forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.055, freq * pitch, 0.32, 0.075, index % 2 ? 0.12 : -0.12),
        );
        break;
      }
      case 'victory':
        [523, 659, 784, 1046, 1318, 1568].forEach((freq, index) =>
          mallet(ctx, dest, t + index * 0.11, freq * pitch, 0.4, 0.13, index % 2 ? -0.15 : 0.15),
        );
        bass(ctx, dest, t + 0.3, 131, 1.1, 0.12, 0);
        noise({ ctx, dest, when: t, dur: 0.8, gain: 0.035, type: 'highpass', freq: 3200 });
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.17, freq * pitch, 0.5, 0.1, index % 2 ? 0.1 : -0.1),
        );
        bass(ctx, dest, t, 98, 1.4, 0.12, 0);
        break;
      case 'click':
        tone({ ctx, dest, when: t, freq: 560 * pitch, dur: 0.032, type: 'sine', gain: 0.04 });
        break;
      case 'uiSelect':
        tone({ ctx, dest, when: t, freq: 760 * pitch, dur: 0.055, type: 'sine', gain: 0.045 });
        break;
      case 'uiOpen':
        tone({ ctx, dest, when: t, freq: 440, dur: 0.12, type: 'sine', gain: 0.045, slideTo: 660 });
        break;
      case 'uiClose':
        tone({ ctx, dest, when: t, freq: 660, dur: 0.12, type: 'sine', gain: 0.04, slideTo: 440 });
        break;
      case 'toggle':
        tone({ ctx, dest, when: t, freq: 620 * pitch, dur: 0.05, type: 'triangle', gain: 0.04 });
        break;
      case 'boss':
        tone({ ctx, dest, when: t, freq: 78, dur: 0.6, type: 'sine', gain: 0.16, slideTo: 42 });
        noise({ ctx, dest, when: t, dur: 0.5, gain: 0.07, type: 'lowpass', freq: 300 });
        break;
      case 'bossHit':
        thump(ctx, dest, t, 0.13);
        noise({ ctx, dest, when: t, dur: 0.1, gain: 0.05, type: 'bandpass', freq: 900 });
        break;
      case 'bossIntro':
        bass(ctx, dest, t, 55, 1.4, 0.14, 0);
        bell(ctx, dest, t + 0.2, 196, 1.2, 0.08, -0.1);
        bell(ctx, dest, t + 0.45, 233, 1, 0.06, 0.1);
        noise({ ctx, dest, when: t, dur: 1.2, gain: 0.035, type: 'lowpass', freq: 240 });
        break;
      case 'bossDefeat':
        thump(ctx, dest, t, 0.2);
        noise({ ctx, dest, when: t, dur: 0.7, gain: 0.12, type: 'lowpass', freq: 1200, slideTo: 120 });
        [392, 330, 262, 196].forEach((freq, index) =>
          bell(ctx, dest, t + 0.1 + index * 0.12, freq, 0.5, 0.075),
        );
        break;
      case 'star':
        [1046, 1318, 1568].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.05, freq * pitch, 0.26, 0.06, index % 2 ? 0.1 : -0.1),
        );
        break;
      case 'stageClear':
        [523, 659, 784, 1046].forEach((freq, index) =>
          mallet(ctx, dest, t + index * 0.08, freq * pitch, 0.28, 0.11),
        );
        noise({ ctx, dest, when: t, dur: 0.4, gain: 0.035, type: 'highpass', freq: 3600 });
        break;
      case 'stageUp':
        [440, 554, 659, 880].forEach((freq, index) =>
          pluck(ctx, dest, t + index * 0.06, freq * pitch, 0.18, 0.08),
        );
        break;
      case 'crystal':
        tone({ ctx, dest, when: t, freq: 1320 * pitch, dur: 0.09, type: 'sine', gain: 0.065 });
        tone({ ctx, dest, when: t + 0.06, freq: 1760 * pitch, dur: 0.12, type: 'sine', gain: 0.05 });
        break;
      case 'fragment':
        tone({ ctx, dest, when: t, freq: 988 * pitch, dur: 0.1, type: 'triangle', gain: 0.06 });
        tone({ ctx, dest, when: t + 0.07, freq: 1318 * pitch, dur: 0.16, type: 'sine', gain: 0.045 });
        break;
      case 'achievement':
        [784, 988, 1174].forEach((freq, index) =>
          bell(ctx, dest, t + index * 0.07, freq * pitch, 0.38, 0.08),
        );
        sparkle(ctx, dest, t + 0.12, 1568, 0.05);
        break;
      case 'energyReady':
        [523, 659, 784, 1046].forEach((freq, index) =>
          tone({
            ctx,
            dest,
            when: t + index * 0.065,
            freq: freq * pitch,
            dur: 0.16,
            type: 'triangle',
            gain: 0.065,
          }),
        );
        break;
      case 'buy':
        [1046, 1318].forEach((freq, index) =>
          tone({
            ctx,
            dest,
            when: t + index * 0.05,
            freq: freq * pitch,
            dur: 0.1,
            type: 'sine',
            gain: 0.06,
          }),
        );
        break;
      default:
        break;
    }
  }
}

export const sfx = new SfxEngine();

let hapticsEnabled = true;

export function setHaptics(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export function haptic(pattern: number | number[]): void {
  if (!hapticsEnabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sem suporte */
  }
}
