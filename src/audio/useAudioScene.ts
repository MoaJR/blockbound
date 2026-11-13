import { useEffect } from 'react';
import type { GameApi } from '../hooks/useGame';
import { isStuck } from '../engine/run';
import { configureQuality } from '../fx/quality';
import { audioCore } from './core';
import { music } from './music/engine';
import type { MusicScene } from './music/themes';
import { sfx } from './sfx';

function sceneFor(api: GameApi): MusicScene {
  if (api.view === 'result') return api.summary?.won ? 'victory' : 'defeat';
  if (api.view === 'reward') return 'reward';
  if (api.view === 'run' && api.run) {
    const stage = api.run.stage;
    if (stage.boss) return 'boss';
    if (stage.index >= 5) return 'advanced';
    return 'gameplay';
  }
  return 'menu';
}

function intensityFor(api: GameApi, scene: MusicScene): number {
  const run = api.run;
  if (!run || api.view === 'menu' || api.view === 'collection' || api.view === 'achievements' || api.view === 'stats') {
    return scene === 'victory' ? 3 : 2;
  }
  if (scene === 'boss') return 2 + (run.stage.boss && run.stage.boss.phase > 0 ? 1 : 0);
  if (scene === 'advanced') return 2;
  if (scene === 'gameplay') return run.stage.index >= 2 ? 2 : 1;
  if (scene === 'reward') return 2;
  if (scene === 'victory') return 3;
  if (scene === 'defeat') return 1;
  return 2;
}

function tensionFor(api: GameApi): boolean {
  const run = api.run;
  if (!run || run.status !== 'playing') return false;
  const boss = run.stage.boss;
  if (run.stage.movesLeft <= 3) return true;
  if (run.combo >= 5) return true;
  if (boss && boss.maxHp > 0 && boss.hp / boss.maxHp <= 0.3) return true;
  return isStuck(run);
}

/**
 * Liga o estado do jogo à trilha adaptativa.
 *
 * A cena é idempotente: abrir configurações/pausa não reinicia a música, só
 * aplica duck. O primeiro gesto do usuário desbloqueia o AudioContext.
 */
export function useAudioScene(api: GameApi): void {
  const settings = api.meta.settings;

  useEffect(() => {
    sfx.configure({
      volume: settings.volume,
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      muted: settings.muted,
    });
    configureQuality(settings.quality, settings.reducedMotion);
  }, [
    settings.volume,
    settings.musicVolume,
    settings.sfxVolume,
    settings.muted,
    settings.quality,
    settings.reducedMotion,
  ]);

  useEffect(() => {
    const unlock = () => {
      const graph = audioCore.unlock();
      if (graph) {
        music.unlock();
        document.documentElement.dataset.audio = 'on';
      }
    };
    document.documentElement.dataset.audio = 'off';
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const scene = sceneFor(api);
  useEffect(() => {
    document.documentElement.dataset.musicTheme = scene;
    music.play(scene);
  }, [scene]);

  useEffect(() => {
    music.setIntensity(intensityFor(api, scene));
    music.setTension(tensionFor(api));
  }, [api, scene]);

  useEffect(() => {
    music.setDuck(api.paused || api.settingsOpen);
  }, [api.paused, api.settingsOpen]);

  useEffect(() => {
    const onVisibility = () => music.setAppActive(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
