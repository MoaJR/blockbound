/**
 * Motor de trilha adaptativa.
 *
 * Cada tema é um `ThemePlayer` com camadas independentes. A troca de tema cria
 * um novo player e faz crossfade no barramento de música; a camada de tensão e
 * a intensidade podem mudar sem reiniciar a composição.
 */

import { audioCore } from '../core';
import { bass, bell, hat, kick, mallet, pad, pluck, shaker, snare, tone, tom } from '../instruments';
import { frequency, hashStep } from './theory';
import type { ChordHit, MusicScene, NoteHit, PercHit, ThemeSpec } from './themes';
import { LAYER_IDS, THEMES, totalSteps } from './themes';

type LayerId = (typeof LAYER_IDS)[number];

interface LayerBus {
  gain: GainNode;
}

function noteMap(hits: NoteHit[]): Map<number, NoteHit[]> {
  const map = new Map<number, NoteHit[]>();
  for (const hit of hits) {
    const list = map.get(hit.step);
    if (list) list.push(hit);
    else map.set(hit.step, [hit]);
  }
  return map;
}

function chordMap(hits: ChordHit[]): Map<number, ChordHit[]> {
  const map = new Map<number, ChordHit[]>();
  for (const hit of hits) {
    const list = map.get(hit.step);
    if (list) list.push(hit);
    else map.set(hit.step, [hit]);
  }
  return map;
}

function percMap(hits: PercHit[]): Map<number, PercHit[]> {
  const map = new Map<number, PercHit[]>();
  for (const hit of hits) {
    const list = map.get(hit.step);
    if (list) list.push(hit);
    else map.set(hit.step, [hit]);
  }
  return map;
}

class ThemePlayer {
  readonly spec: ThemeSpec;
  private ctx: AudioContext;
  private out: GainNode;
  private layers = new Map<LayerId, LayerBus>();
  private notes = new Map<LayerId, Map<number, NoteHit[]>>();
  private pads: Map<number, ChordHit[]>;
  private perc: Map<number, PercHit[]>;
  private intro: Map<number, NoteHit[]>;
  private introPerc: Map<number, PercHit[]>;
  private total: number;
  private stepSeconds: number;
  private timer = 0;
  private nextStepTime = 0;
  private step = 0;
  private intensity = 2;
  private tension = false;
  private disposed = false;
  private scheduledSteps = 0;
  private readonly lookahead = 0.22;

  constructor(ctx: AudioContext, out: AudioNode, spec: ThemeSpec) {
    this.ctx = ctx;
    this.spec = spec;
    this.total = totalSteps(spec);
    this.stepSeconds = 60 / spec.bpm / 4;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(out);

    for (const id of LAYER_IDS) {
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(this.out);
      this.layers.set(id, { gain });
    }

    this.pads = chordMap(spec.pad);
    this.perc = percMap(spec.perc);
    this.intro = noteMap(spec.intro);
    this.introPerc = percMap(spec.introPerc);
    this.notes.set('bass', noteMap(spec.bass));
    this.notes.set('arp', noteMap(spec.arp));
    this.notes.set('melody', noteMap(spec.melody));
    this.notes.set('bells', noteMap(spec.bells));
    this.notes.set('tension', noteMap(spec.tension));
  }

  start(): void {
    if (this.disposed || this.timer) return;
    this.nextStepTime = this.ctx.currentTime + 0.12;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    if (this.nextStepTime < now - 0.25) {
      // O contexto ficou suspenso: retoma do ponto atual, sem reiniciar a faixa.
      this.nextStepTime = now + 0.05;
    }
    while (this.nextStepTime < now + this.lookahead) {
      this.schedule(this.step, this.nextStepTime);
      this.nextStepTime += this.stepSeconds;
      this.step += 1;
      this.scheduledSteps += 1;
    }
  }

  private layerGain(id: LayerId): GainNode | null {
    return this.layers.get(id)?.gain ?? null;
  }

  private schedule(step: number, when: number): void {
    const local = step % this.total;
    const loop = Math.floor(step / this.total);

    const padHits = this.pads.get(local);
    if (padHits) {
      const dest = this.layerGain('pad');
      if (dest) {
        for (const hit of padHits) {
          pad(this.ctx, dest, when, hit.midis.map(frequency), hit.dur * this.stepSeconds, 0.22);
        }
      }
    }

    const bassHits = this.notes.get('bass')?.get(local);
    if (bassHits) {
      const dest = this.layerGain('bass');
      if (dest) {
        for (const hit of bassHits) {
          bass(
            this.ctx,
            dest,
            when + this.jitter(step, 1),
            frequency(hit.midi),
            hit.dur * this.stepSeconds,
            0.24 * (hit.vel ?? 1),
            hit.pan ?? 0,
          );
        }
      }
    }

    const arpHits = this.notes.get('arp')?.get(local);
    if (arpHits) {
      const dest = this.layerGain('arp');
      if (dest) {
        for (const hit of arpHits) {
          pluck(
            this.ctx,
            dest,
            when + this.jitter(step, 2),
            frequency(hit.midi),
            hit.dur * this.stepSeconds,
            0.13 * (hit.vel ?? 1),
            hit.pan ?? 0,
          );
        }
      }
    }

    const melodyHits = this.notes.get('melody')?.get(local);
    if (melodyHits) {
      const dest = this.layerGain('melody');
      if (dest) {
        for (const hit of melodyHits) {
          const dur = hit.dur * this.stepSeconds;
          const hz = frequency(hit.midi);
          const gain = 0.2 * (hit.vel ?? 1);
          const pan = hit.pan ?? 0;
          if (this.spec.lead === 'mallet') mallet(this.ctx, dest, when, hz, dur, gain, pan);
          else if (this.spec.lead === 'bell') bell(this.ctx, dest, when, hz, dur, gain * 0.8, pan);
          else if (this.spec.lead === 'synth') {
            tone({
              ctx: this.ctx,
              dest,
              when,
              freq: hz,
              dur,
              type: 'sawtooth',
              gain: gain * 0.46,
              attack: 0.02,
              filterType: 'lowpass',
              filterFreq: 1600,
              filterQ: 2.4,
              pan,
              vibrato: { rate: 5.2, depth: 3.8 },
            });
          } else {
            pluck(this.ctx, dest, when, hz, dur, gain, pan);
          }
        }
      }
    }

    const bellHits = this.notes.get('bells')?.get(local);
    if (bellHits) {
      const dest = this.layerGain('bells');
      if (dest) {
        for (const hit of bellHits) {
          bell(
            this.ctx,
            dest,
            when + this.jitter(step, 3),
            frequency(hit.midi),
            hit.dur * this.stepSeconds,
            0.11 * (hit.vel ?? 1),
            hit.pan ?? 0,
          );
        }
      }
    }

    const tensionHits = this.notes.get('tension')?.get(local);
    if (tensionHits) {
      const dest = this.layerGain('tension');
      if (dest) {
        for (const hit of tensionHits) {
          tone({
            ctx: this.ctx,
            dest,
            when,
            freq: frequency(hit.midi),
            dur: hit.dur * this.stepSeconds,
            type: 'sawtooth',
            gain: 0.055 * (hit.vel ?? 1),
            attack: 0.12,
            filterType: 'lowpass',
            filterFreq: 780,
            filterQ: 3.2,
            pan: 0.14,
          });
        }
      }
    }

    const percHits = this.perc.get(local);
    if (percHits) {
      const dest = this.layerGain('perc');
      if (dest) {
        for (const hit of percHits) this.playPerc(hit, dest, when);
      }
    }

    if (loop === 0) {
      const introHits = this.intro.get(local);
      if (introHits) {
        const dest = this.layerGain('melody');
        if (dest) {
          for (const hit of introHits) {
            bell(
              this.ctx,
              dest,
              when,
              frequency(hit.midi),
              hit.dur * this.stepSeconds,
              0.16 * (hit.vel ?? 1),
              0,
            );
          }
        }
      }
      const introPerc = this.introPerc.get(local);
      if (introPerc) {
        const dest = this.layerGain('perc');
        if (dest) {
          for (const hit of introPerc) this.playPerc(hit, dest, when);
        }
      }
    }
  }

  private playPerc(hit: PercHit, dest: AudioNode, when: number): void {
    const gain = hit.vel ?? 1;
    if (hit.kind === 'kick') kick(this.ctx, dest, when, 0.22 * gain);
    else if (hit.kind === 'snare') snare(this.ctx, dest, when, 0.13 * gain);
    else if (hit.kind === 'hat') hat(this.ctx, dest, when, 0.05 * gain);
    else if (hit.kind === 'tom') tom(this.ctx, dest, when, 128, 0.15 * gain);
    else shaker(this.ctx, dest, when, 0.04 * gain);
  }

  private jitter(step: number, salt: number): number {
    return ((hashStep(step, salt) % 7) - 3) * 0.0011;
  }

  get debugSteps(): number {
    return this.scheduledSteps;
  }

  get debugLayers(): number {
    return this.layers.size;
  }

  setIntensity(value: number, ramp = 0.9): void {
    this.intensity = Math.max(0, Math.min(3, value));
    for (const id of LAYER_IDS) {
      const layer = this.layers.get(id);
      if (!layer) continue;
      const threshold = this.spec.layerThreshold[id] ?? 0;
      let target = Math.max(0, this.spec.layerGain[id] ?? 0);
      if (this.intensity < threshold) target = 0;
      if (id === 'tension') target = this.tension ? target : 0;
      layer.gain.gain.setTargetAtTime(Math.max(0.0001, target), this.ctx.currentTime, ramp);
    }
  }

  setTension(on: boolean, ramp = 1.1): void {
    this.tension = on;
    const layer = this.layers.get('tension');
    if (!layer) return;
    const base = this.spec.layerGain.tension ?? 0;
    const target = on ? Math.max(0.0001, base) : 0.0001;
    layer.gain.gain.setTargetAtTime(target, this.ctx.currentTime, ramp);
  }

  fadeIn(seconds: number): void {
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.out.gain.setTargetAtTime(1, this.ctx.currentTime, Math.max(0.05, seconds * 0.45));
  }

  fadeOut(seconds: number): void {
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, Math.max(0.05, seconds * 0.4));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
    try {
      for (const layer of this.layers.values()) layer.gain.disconnect();
      this.out.disconnect();
    } catch {
      /* já desconectado */
    }
  }
}

const CROSSFADE: Record<MusicScene, number> = {
  menu: 1.6,
  gameplay: 1.6,
  advanced: 1.8,
  boss: 2.2,
  reward: 1.4,
  victory: 1.2,
  defeat: 1.8,
};

class MusicEngine {
  private active: ThemePlayer | null = null;
  private fading = new Set<{ player: ThemePlayer; timer: number }>();
  private started = false;
  private scene: MusicScene = 'menu';
  private intensity = 2;
  private tension = false;
  private ducked = false;
  private appActive = true;
  private mix: GainNode | null = null;
  private suspendTimer = 0;

  private ensureMix(): GainNode | null {
    if (this.mix) return this.mix;
    const graph = audioCore.get();
    if (!graph) return null;
    const mix = graph.ctx.createGain();
    mix.gain.value = this.mixTarget();
    mix.connect(graph.music);
    this.mix = mix;
    return mix;
  }

  private mixTarget(): number {
    if (!this.appActive) return 0.0001;
    return this.ducked ? 0.34 : 1;
  }

  private applyMix(ramp = 0.18): void {
    const mix = this.mix;
    if (!mix) return;
    const ctx = audioCore.get()?.ctx;
    if (!ctx) return;
    mix.gain.setTargetAtTime(Math.max(0.0001, this.mixTarget()), ctx.currentTime, ramp);
  }

  unlock(): void {
    const graph = audioCore.unlock();
    if (!graph) return;
    this.started = true;
    this.ensureMix();
    if (!this.active) this.switchTo(this.scene, CROSSFADE[this.scene]);
    else this.applyMix();
  }

  play(scene: MusicScene, crossfade?: number): void {
    this.scene = scene;
    if (!this.started || !audioCore.isUnlocked()) return;
    if (this.active?.spec.id === scene) {
      this.active.setIntensity(this.intensity);
      this.active.setTension(this.tension);
      return;
    }
    this.switchTo(scene, crossfade ?? CROSSFADE[scene]);
  }

  private switchTo(scene: MusicScene, crossfade: number): void {
    const graph = audioCore.get();
    const mix = this.ensureMix();
    if (!graph || !mix) return;

    const spec = THEMES[scene];
    if (!spec) return;
    const next = new ThemePlayer(graph.ctx, mix, spec);
    next.setIntensity(this.intensity);
    next.setTension(this.tension);
    next.start();
    next.fadeIn(crossfade);

    const previous = this.active;
    this.active = next;

    if (previous) {
      previous.fadeOut(crossfade);
      const timer = window.setTimeout(() => {
        previous.dispose();
      }, (crossfade + 0.8) * 1000);
      const entry = { player: previous, timer };
      this.fading.add(entry);
      window.setTimeout(() => {
        window.clearTimeout(timer);
        this.fading.delete(entry);
      }, (crossfade + 1.3) * 1000);
    }
  }

  setIntensity(value: number): void {
    const next = Math.max(0, Math.min(3, value));
    if (next === this.intensity) return;
    this.intensity = next;
    this.active?.setIntensity(next);
  }

  setTension(on: boolean): void {
    if (on === this.tension) return;
    this.tension = on;
    this.active?.setTension(on);
  }

  setDuck(on: boolean): void {
    if (on === this.ducked) return;
    this.ducked = on;
    this.applyMix();
  }

  setAppActive(active: boolean): void {
    if (active === this.appActive) return;
    this.appActive = active;
    this.applyMix(active ? 0.25 : 0.5);
    if (active) {
      if (this.suspendTimer) window.clearTimeout(this.suspendTimer);
      this.suspendTimer = 0;
      audioCore.resume();
    } else {
      if (this.suspendTimer) window.clearTimeout(this.suspendTimer);
      this.suspendTimer = window.setTimeout(() => {
        this.suspendTimer = 0;
        audioCore.suspend();
      }, 650);
    }
  }

  get current(): MusicScene {
    return this.scene;
  }

  get isStarted(): boolean {
    return this.started;
  }

  get debugState(): {
    scene: MusicScene;
    started: boolean;
    intensity: number;
    tension: boolean;
    ducked: boolean;
    steps: number;
    layers: number;
  } {
    return {
      scene: this.scene,
      started: this.started,
      intensity: this.intensity,
      tension: this.tension,
      ducked: this.ducked,
      steps: this.active ? this.active.debugSteps : 0,
      layers: this.active ? this.active.debugLayers : 0,
    };
  }

  dispose(): void {
    if (this.suspendTimer) window.clearTimeout(this.suspendTimer);
    this.suspendTimer = 0;
    this.active?.dispose();
    this.active = null;
    for (const entry of this.fading) {
      window.clearTimeout(entry.timer);
      entry.player.dispose();
    }
    this.fading.clear();
    try {
      this.mix?.disconnect();
    } catch {
      /* ignore */
    }
    this.mix = null;
    this.started = false;
  }
}

export const music = new MusicEngine();

if (typeof window !== 'undefined') {
  (window as unknown as { __blockboundMusic?: { getState: () => unknown } }).__blockboundMusic = {
    getState: () => music.debugState,
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => music.dispose());
}
