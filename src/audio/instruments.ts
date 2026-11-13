/**
 * Instrumentos sintetizados usados pela trilha e pelos efeitos.
 *
 * Todos os nós são agendados com tempo absoluto do AudioContext e têm
 * `onended` para desconectar a cadeia — nada fica vivo depois do som.
 */

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const cached = noiseBuffers.get(ctx);
  if (cached) return cached;
  const length = Math.floor(ctx.sampleRate * 0.8);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  noiseBuffers.set(ctx, buffer);
  return buffer;
}

export interface ToneOptions {
  ctx: AudioContext;
  dest: AudioNode;
  when: number;
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  detune?: number;
  pan?: number;
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterQ?: number;
  slideTo?: number;
  vibrato?: { rate: number; depth: number };
}

function cleanup(...nodes: AudioNode[]): void {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      /* já desconectado */
    }
  }
}

export function tone(options: ToneOptions): void {
  const {
    ctx,
    dest,
    when,
    freq,
    dur,
    type = 'sine',
    gain = 0.12,
    attack = 0.008,
    release = 0.12,
    detune = 0,
    pan = 0,
    filterType,
    filterFreq,
    filterQ = 0.9,
    slideTo,
    vibrato,
  } = options;
  if (dur <= 0 || gain <= 0) return;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  let filter: BiquadFilterNode | null = null;

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), when);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), when + dur);
  }
  osc.detune.value = detune;

  if (vibrato) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = vibrato.rate;
    lfoGain.gain.value = vibrato.depth;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(when);
    lfo.stop(when + dur + release + 0.05);
    lfo.onended = () => cleanup(lfo, lfoGain);
  }

  if (filterType && filterFreq) {
    filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, when);
    filter.Q.value = filterQ;
  }

  const peak = Math.max(0.0002, gain);
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(peak, when + Math.max(0.001, attack));
  env.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    if (filter) {
      osc.connect(filter);
      filter.connect(env);
    } else {
      osc.connect(env);
    }
    env.connect(panner);
    panner.connect(dest);
  } else if (filter) {
    osc.connect(filter);
    filter.connect(env);
    env.connect(dest);
  } else {
    osc.connect(env);
    env.connect(dest);
  }

  osc.start(when);
  osc.stop(when + dur + release + 0.05);
  osc.onended = () => cleanup(osc, env, ...(filter ? [filter] : []), ...(panner ? [panner] : []));
}

export interface NoiseOptions {
  ctx: AudioContext;
  dest: AudioNode;
  when: number;
  dur: number;
  gain?: number;
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
  attack?: number;
  pan?: number;
  slideTo?: number;
}

export function noise(options: NoiseOptions): void {
  const {
    ctx,
    dest,
    when,
    dur,
    gain = 0.08,
    type = 'bandpass',
    freq = 1200,
    q = 0.9,
    attack = 0.005,
    pan = 0,
    slideTo,
  } = options;
  if (dur <= 0 || gain <= 0) return;

  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

  src.buffer = noiseBuffer(ctx);
  filter.type = type;
  filter.frequency.setValueAtTime(Math.max(40, freq), when);
  filter.Q.value = q;
  if (slideTo) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), when + dur);
  }

  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(Math.max(0.0002, gain), when + Math.max(0.001, attack));
  env.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  src.connect(filter);
  filter.connect(env);
  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    env.connect(panner);
    panner.connect(dest);
  } else {
    env.connect(dest);
  }

  src.start(when);
  src.stop(when + dur + 0.04);
  src.onended = () => cleanup(src, filter, env, ...(panner ? [panner] : []));
}

/** Marimba / mallet digital: fundamental + harmônico curto. */
export function mallet(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freq: number,
  dur: number,
  gain = 0.14,
  pan = 0,
): void {
  tone({ ctx, dest, when, freq, dur, type: 'sine', gain, attack: 0.004, pan });
  tone({
    ctx,
    dest,
    when,
    freq: freq * 2.01,
    dur: dur * 0.55,
    type: 'triangle',
    gain: gain * 0.28,
    attack: 0.003,
    pan,
  });
}

/** Sino mágico com parciais inarmônicos. */
export function bell(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freq: number,
  dur: number,
  gain = 0.1,
  pan = 0,
): void {
  const partials = [
    { ratio: 1, level: 1 },
    { ratio: 2.01, level: 0.35 },
    { ratio: 3.03, level: 0.18 },
    { ratio: 4.72, level: 0.09 },
  ];
  for (const partial of partials) {
    tone({
      ctx,
      dest,
      when,
      freq: freq * partial.ratio,
      dur: dur * (1 - partial.ratio * 0.07),
      type: 'sine',
      gain: gain * partial.level,
      attack: 0.004,
      pan,
    });
  }
}

/** Pluck de síntese suave para arpejos. */
export function pluck(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freq: number,
  dur: number,
  gain = 0.1,
  pan = 0,
): void {
  tone({
    ctx,
    dest,
    when,
    freq,
    dur,
    type: 'triangle',
    gain,
    attack: 0.004,
    filterType: 'lowpass',
    filterFreq: Math.min(5200, freq * 8),
    filterQ: 1.6,
    pan,
  });
}

/** Pad atmosférico: vozes detunadas com ataque lento. */
export function pad(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freqs: number[],
  dur: number,
  gain = 0.08,
  pan = 0,
): void {
  for (const [index, freq] of freqs.entries()) {
    tone({
      ctx,
      dest,
      when,
      freq,
      dur,
      type: index % 2 === 0 ? 'sawtooth' : 'triangle',
      gain: gain / Math.max(1, freqs.length * 0.72),
      attack: Math.min(1.2, dur * 0.22),
      release: Math.min(1.4, dur * 0.3),
      detune: (index - (freqs.length - 1) / 2) * 5,
      filterType: 'lowpass',
      filterFreq: 1200 + index * 180,
      filterQ: 0.7,
      pan: pan + (index - (freqs.length - 1) / 2) * 0.06,
    });
  }
}

/** Baixo eletrônico suave: sub senoidal + corpo triangular. */
export function bass(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freq: number,
  dur: number,
  gain = 0.2,
  pan = 0,
): void {
  tone({
    ctx,
    dest,
    when,
    freq: freq / 2,
    dur,
    type: 'sine',
    gain: gain * 0.8,
    attack: 0.006,
    pan,
  });
  tone({
    ctx,
    dest,
    when,
    freq,
    dur: Math.min(dur, 0.55),
    type: 'triangle',
    gain: gain * 0.42,
    attack: 0.005,
    filterType: 'lowpass',
    filterFreq: 520,
    filterQ: 1.1,
    pan,
  });
}

export function kick(ctx: AudioContext, dest: AudioNode, when: number, gain = 0.18): void {
  tone({ ctx, dest, when, freq: 145, dur: 0.2, type: 'sine', gain, attack: 0.002, slideTo: 46 });
  noise({ ctx, dest, when, dur: 0.035, gain: gain * 0.24, type: 'highpass', freq: 2400 });
}

export function snare(ctx: AudioContext, dest: AudioNode, when: number, gain = 0.11): void {
  noise({ ctx, dest, when, dur: 0.14, gain, type: 'bandpass', freq: 1900, q: 0.8 });
  tone({ ctx, dest, when, freq: 190, dur: 0.09, type: 'triangle', gain: gain * 0.35, slideTo: 150 });
}

export function hat(ctx: AudioContext, dest: AudioNode, when: number, gain = 0.045): void {
  noise({ ctx, dest, when, dur: 0.045, gain, type: 'highpass', freq: 7200, q: 0.7 });
}

export function tom(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freq = 130,
  gain = 0.13,
): void {
  tone({ ctx, dest, when, freq, dur: 0.22, type: 'sine', gain, slideTo: freq * 0.62 });
}

export function shaker(ctx: AudioContext, dest: AudioNode, when: number, gain = 0.035): void {
  noise({ ctx, dest, when, dur: 0.055, gain, type: 'bandpass', freq: 5200, q: 1.2 });
}

/** Impacto curto, usado em encaixes e botões pesados. */
export function thump(ctx: AudioContext, dest: AudioNode, when: number, gain = 0.2): void {
  tone({ ctx, dest, when, freq: 120, dur: 0.14, type: 'sine', gain, attack: 0.002, slideTo: 54 });
  noise({ ctx, dest, when, dur: 0.08, gain: gain * 0.35, type: 'lowpass', freq: 700 });
}

export function sparkle(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  baseFreq: number,
  gain = 0.06,
): void {
  [1, 1.5, 2.25].forEach((ratio, index) => {
    bell(ctx, dest, when + index * 0.035, baseFreq * ratio, 0.35, gain * (1 - index * 0.18));
  });
}
