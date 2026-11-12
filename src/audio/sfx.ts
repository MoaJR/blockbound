export type SfxName =
  | 'place'
  | 'deny'
  | 'clear1'
  | 'clear2'
  | 'clear3'
  | 'combo'
  | 'power'
  | 'relic'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'boss'
  | 'star'
  | 'stageClear'
  | 'reward'
  | 'crystal';

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.7;
  private muted = false;
  private lastAt: Partial<Record<SfxName, number>> = {};

  configure(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.gainValue(), this.ctx.currentTime, 0.02);
    }
  }

  private gainValue(): number {
    if (this.muted) return 0;
    return Math.pow(this.volume, 1.5) * 0.42;
  }

  unlock(): void {
    this.ensure();
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.gainValue();
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    when = 0,
    slideTo?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0004, gain), t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  private noise(dur: number, gain: number, freq: number, when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0004, gain), t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name: SfxName, detail = 0): void {
    const ctx = this.ensure();
    if (!ctx || this.muted || this.volume <= 0) return;
    const now = ctx.currentTime;
    const last = this.lastAt[name] ?? 0;
    if (now - last < 0.03) return;
    this.lastAt[name] = now;

    switch (name) {
      case 'place':
        this.tone(340, 0.09, 'triangle', 0.16, 0, 205);
        this.noise(0.05, 0.05, 1500);
        break;
      case 'deny':
        this.tone(150, 0.16, 'sawtooth', 0.1, 0, 88);
        break;
      case 'clear1':
        this.tone(660, 0.12, 'triangle', 0.13);
        this.tone(990, 0.16, 'sine', 0.09, 0.05);
        break;
      case 'clear2':
        [523, 659, 880].forEach((freq, index) =>
          this.tone(freq, 0.16, 'triangle', 0.12, index * 0.05),
        );
        this.noise(0.18, 0.05, 2600, 0.02);
        break;
      case 'clear3':
        [523, 659, 784, 1046, 1318].forEach((freq, index) =>
          this.tone(freq, 0.2, 'triangle', 0.11, index * 0.045),
        );
        this.noise(0.3, 0.08, 3200, 0.03);
        break;
      case 'combo':
        this.tone(360 + Math.min(12, detail) * 55, 0.14, 'square', 0.09, 0, 520);
        break;
      case 'power':
        this.tone(780, 0.26, 'sawtooth', 0.1, 0, 120);
        this.noise(0.24, 0.09, 700);
        break;
      case 'relic':
        [880, 1174, 1320].forEach((freq, index) => this.tone(freq, 0.22, 'sine', 0.1, index * 0.07));
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((freq, index) =>
          this.tone(freq, 0.32, 'triangle', 0.14, index * 0.12),
        );
        this.tone(261, 0.9, 'sine', 0.1, 0.4);
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((freq, index) =>
          this.tone(freq, 0.34, 'triangle', 0.12, index * 0.16),
        );
        break;
      case 'click':
        this.tone(540, 0.04, 'sine', 0.06);
        break;
      case 'boss':
        this.tone(72, 0.6, 'sine', 0.15, 0, 42);
        this.noise(0.5, 0.09, 220);
        break;
      case 'star':
        [1046, 1318, 1568].forEach((freq, index) =>
          this.tone(freq, 0.14, 'sine', 0.09, index * 0.05),
        );
        break;
      case 'stageClear':
        [523, 659, 784].forEach((freq, index) =>
          this.tone(freq, 0.24, 'triangle', 0.12, index * 0.08),
        );
        this.noise(0.4, 0.05, 3600, 0.05);
        break;
      case 'reward':
        [659, 880, 1174].forEach((freq, index) => this.tone(freq, 0.2, 'sine', 0.1, index * 0.06));
        break;
      case 'crystal':
        this.tone(1320, 0.1, 'sine', 0.08);
        this.tone(1760, 0.12, 'sine', 0.06, 0.06);
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
