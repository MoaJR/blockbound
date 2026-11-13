/**
 * Núcleo de áudio do BLOCKBOUND.
 *
 * Um único AudioContext é compartilhado entre música e efeitos. Isso evita
 * contextos duplicados (especialmente no iOS/Safari), permite um compressor
 * global e mantém os volumes independentes de música e SFX.
 *
 * Nenhum som é criado antes do primeiro gesto legítimo do jogador.
 */

export interface AudioSettings {
  volume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface AudioGraph {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  compressor: DynamicsCompressorNode;
}

type AudioContextConstructor = typeof AudioContext;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

class AudioCore {
  private graph: AudioGraph | null = null;
  private settings: AudioSettings = {
    volume: 0.7,
    musicVolume: 0.72,
    sfxVolume: 0.9,
    muted: false,
  };
  private unlocked = false;

  configure(settings: AudioSettings): void {
    this.settings = {
      volume: clamp01(settings.volume),
      musicVolume: clamp01(settings.musicVolume),
      sfxVolume: clamp01(settings.sfxVolume),
      muted: Boolean(settings.muted),
    };
    this.applyVolumes();
  }

  private masterGainValue(): number {
    if (this.settings.muted) return 0;
    return Math.pow(this.settings.volume, 1.4);
  }

  private musicGainValue(): number {
    return Math.pow(this.settings.musicVolume, 1.2);
  }

  private sfxGainValue(): number {
    return Math.pow(this.settings.sfxVolume, 1.1);
  }

  private applyVolumes(): void {
    const graph = this.graph;
    if (!graph) return;
    const now = graph.ctx.currentTime;
    graph.master.gain.setTargetAtTime(this.masterGainValue(), now, 0.035);
    graph.music.gain.setTargetAtTime(this.musicGainValue(), now, 0.035);
    graph.sfx.gain.setTargetAtTime(this.sfxGainValue(), now, 0.02);
  }

  /** Cria o grafo no primeiro gesto do usuário. */
  ensure(): AudioGraph | null {
    if (typeof window === 'undefined') return null;
    if (this.graph) return this.graph;

    const Ctor: AudioContextConstructor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Ctor) return null;

    try {
      const ctx = new Ctor();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.knee.value = 22;
      compressor.ratio.value = 3.4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.26;

      const master = ctx.createGain();
      const music = ctx.createGain();
      const sfx = ctx.createGain();

      master.gain.value = this.masterGainValue();
      music.gain.value = this.musicGainValue();
      sfx.gain.value = this.sfxGainValue();

      music.connect(master);
      sfx.connect(master);
      master.connect(compressor);
      compressor.connect(ctx.destination);

      this.graph = { ctx, master, music, sfx, compressor };
      return this.graph;
    } catch {
      return null;
    }
  }

  /** Desbloqueia o áudio no primeiro gesto (pointerdown/keydown/touch). */
  unlock(): AudioGraph | null {
    const graph = this.ensure();
    if (!graph) return null;
    this.unlocked = true;
    if (graph.ctx.state !== 'running') {
      void graph.ctx.resume().catch(() => {
        /* iOS pode exigir novo gesto; tentamos novamente no próximo */
      });
    }
    return graph;
  }

  get(): AudioGraph | null {
    return this.graph;
  }

  isUnlocked(): boolean {
    return this.unlocked && this.graph !== null;
  }

  /** Suspende todo o áudio quando a aba fica oculta. */
  suspend(): void {
    const graph = this.graph;
    if (!graph) return;
    if (graph.ctx.state === 'running') {
      void graph.ctx.suspend().catch(() => {
        /* sem suporte em alguns estados */
      });
    }
  }

  /** Retoma após a aba voltar. Alguns browsers exigem novo gesto. */
  resume(): void {
    const graph = this.graph;
    if (!graph) return;
    if (graph.ctx.state === 'suspended') {
      void graph.ctx.resume().catch(() => {
        /* aguarda o próximo gesto */
      });
    }
  }

  dispose(): void {
    const graph = this.graph;
    this.graph = null;
    this.unlocked = false;
    if (!graph) return;
    try {
      graph.music.disconnect();
      graph.sfx.disconnect();
      graph.master.disconnect();
      graph.compressor.disconnect();
      void graph.ctx.close();
    } catch {
      /* ignore */
    }
  }
}

export const audioCore = new AudioCore();
