/**
 * Controle central de qualidade visual.
 *
 * `auto` parte da capacidade observada do dispositivo e pode rebaixar
 * suavemente para econômica se o frame time ficar alto por alguns segundos.
 * O rebaixamento nunca acontece no meio de uma animação crítica e não volta
 * a subir durante a sessão, evitando mudanças bruscas.
 */

import type { VisualQuality } from '../engine/types';

export type QualityLevel = 'high' | 'low';

let setting: VisualQuality = 'auto';
let effective: QualityLevel = 'high';
let reduced = false;
let samples = 0;
let sampleTotal = 0;
let lockedDowngrade = false;

const listeners = new Set<(level: QualityLevel) => void>();

function deviceGuess(): QualityLevel {
  if (typeof navigator === 'undefined') return 'high';
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency ?? 8) <= 4) return 'low';
  if ((nav.deviceMemory ?? 8) <= 4) return 'low';
  return 'high';
}

function apply(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.quality = effective;
  }
  for (const listener of listeners) listener(effective);
}

export function configureQuality(quality: VisualQuality, reducedMotion: boolean): void {
  setting = quality;
  reduced = reducedMotion;
  samples = 0;
  sampleTotal = 0;
  if (quality === 'auto') {
    effective = deviceGuess();
    lockedDowngrade = false;
  } else {
    effective = quality === 'economy' ? 'low' : 'high';
    lockedDowngrade = quality === 'economy';
  }
  apply();
}

/** Chamado por um observador de frame (apenas em modo auto). */
export function reportFrame(durationMs: number): void {
  if (setting !== 'auto' || reduced || lockedDowngrade) return;
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 120) return;
  samples += 1;
  sampleTotal += durationMs;
  if (samples < 120) return;
  const average = sampleTotal / samples;
  samples = 0;
  sampleTotal = 0;
  if (average > 22 && effective !== 'low') {
    effective = 'low';
    lockedDowngrade = true;
    apply();
  }
}

export function getQualityLevel(): QualityLevel {
  return effective;
}

export function getQualitySetting(): VisualQuality {
  return setting;
}

export function isReducedMotion(): boolean {
  return reduced;
}

export function particleScale(): number {
  if (reduced) return 0;
  return effective === 'low' ? 0.48 : 1;
}

export function maxParticles(): number {
  if (reduced) return 0;
  return effective === 'low' ? 180 : 420;
}

export function dprCap(): number {
  return effective === 'low' ? 1.25 : 2;
}

export function subscribeQuality(listener: (level: QualityLevel) => void): () => void {
  listeners.add(listener);
  listener(effective);
  return () => {
    listeners.delete(listener);
  };
}
