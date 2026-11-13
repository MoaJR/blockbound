import { useCallback, useEffect, useRef, useState } from 'react';
import type { AchievementDef } from '../engine/achievements';
import type {
  GameEvent,
  MetaState,
  PowerId,
  RunState,
  RunSummary,
  ScreenId,
  Settings,
  TalentId,
} from '../engine/types';
import type { ActionResult } from '../engine/run';
import {
  abandonRun,
  chooseReward,
  claimEnergyReward,
  createRun,
  placePiece,
  recallLastPiece,
  rerollRewards,
  resolveStageEvent,
  runSummary,
  usePower,
} from '../engine/run';
import {
  buyPower,
  buyRelic,
  buyTalent,
  defaultMeta,
  metaSnapshot,
  recordRun,
  updateSettings,
} from '../engine/meta';
import { relicById } from '../engine/relics';
import { randomSeed } from '../engine/rng';
import { clearRun, loadMeta, loadRun, saveMeta, saveRun } from '../persistence';
import { haptic, setHaptics, sfx } from '../audio/sfx';
import { emitFx } from '../fx/fxBus';
import type { ToastItem } from '../components/ToastStack';

let toastSeq = 0;

export interface GameApi {
  meta: MetaState;
  run: RunState | null;
  view: ScreenId;
  summary: RunSummary | null;
  newAchievements: AchievementDef[];
  toasts: ToastItem[];
  paused: boolean;
  settingsOpen: boolean;
  hasSave: boolean;
  startRun: () => void;
  continueRun: () => void;
  goto: (view: ScreenId) => void;
  goMenu: () => void;
  place: (trayIndex: number, row: number, col: number) => void;
  power: (id: PowerId, target?: { r: number; c: number }) => void;
  recall: () => void;
  claimEnergy: (choiceId: string) => void;
  resolveEvent: (optionId: string | null) => void;
  pickReward: (relicId: string) => void;
  reroll: () => void;
  abandon: () => void;
  setPaused: (paused: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
  patchSettings: (patch: Partial<Settings>) => void;
  purchaseRelic: (id: string) => void;
  purchasePower: (id: PowerId) => void;
  purchaseTalent: (id: TalentId) => void;
  resetProgress: () => void;
  dismissToast: (id: number) => void;
}

export function useGame(): GameApi {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta());
  const [run, setRun] = useState<RunState | null>(() => loadRun());
  const [view, setView] = useState<ScreenId>('menu');
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [newAchievements, setNewAchievements] = useState<AchievementDef[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const metaRef = useRef(meta);
  const runRef = useRef(run);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    saveMeta(meta);
    setHaptics(meta.settings.haptics);
  }, [meta]);

  useEffect(() => {
    saveRun(run);
  }, [run]);

  useEffect(() => {
    const list = timers.current;
    return () => {
      for (const timer of list) window.clearTimeout(timer);
    };
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((text: string, tone: ToastItem['tone'] = 'info') => {
    toastSeq += 1;
    const id = toastSeq;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
    timers.current.push(timer);
  }, []);

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      for (const event of events) {
        switch (event.type) {
          case 'invalid':
            sfx.play('deny');
            haptic(35);
            pushToast(event.reason, 'bad');
            break;
          case 'place':
            sfx.play('place');
            if (event.special === 'prism') sfx.play('prism');
            else if (event.special === 'tnt') sfx.play('tnt');
            else if (event.special === 'star') sfx.play('star');
            haptic(10);
            break;
          case 'clear': {
            const cross = event.rows.length > 0 && event.cols.length > 0;
            if (cross) sfx.play('clearCross');
            else if (event.lines >= 4) sfx.play('clear4');
            else if (event.lines >= 3) sfx.play('clear3');
            else if (event.lines === 2) sfx.play('clear2');
            else if (event.rows.length > 0) sfx.play('clearRow');
            else sfx.play('clearCol');
            if (event.corrupt > 0 || event.bombs > 0 || event.frozen > 0) sfx.play('special');
            haptic(event.lines >= 2 ? [14, 26, 16] : 12);
            break;
          }
          case 'combo':
            if (event.level >= 5) sfx.play('comboHigh', event.level);
            else if (event.level >= 2) sfx.play('combo', event.level);
            if (event.multiplier >= 2 && event.level >= 3) sfx.play('multiplier');
            break;
          case 'power':
            sfx.play(
              event.power === 'bomb'
                ? 'bomb'
                : event.power === 'hammer'
                  ? 'hammer'
                  : event.power === 'drill'
                    ? 'drill'
                    : event.power === 'shuffle'
                      ? 'shuffle'
                      : event.power === 'convert'
                        ? 'convert'
                        : event.power === 'wildcard'
                          ? 'wildcard'
                          : 'power',
            );
            haptic(18);
            break;
          case 'boss':
            sfx.play('bossHit');
            haptic(24);
            break;
          case 'stageClear':
            if (runRef.current?.stage.isBoss) sfx.play('bossDefeat');
            else sfx.play('stageClear');
            break;
          case 'victory':
            sfx.play('victory');
            haptic([30, 60, 30, 60, 90]);
            break;
          case 'gameOver':
            sfx.play('defeat');
            haptic(140);
            break;
          case 'relic': {
            const relic = relicById(event.id);
            if (relic) sfx.playRelic(relic.rarity);
            break;
          }
          case 'rescue':
            sfx.play('star');
            break;
          case 'extraMove':
            sfx.play('crystal');
            break;
          case 'energy':
            break;
          case 'energyReady':
            sfx.play('energyReady');
            haptic(16);
            break;
          case 'rewardClaimed':
            sfx.play(
              event.kind === 'crystals'
                ? 'crystal'
                : event.kind === 'fragments'
                  ? 'fragment'
                  : event.kind === 'power_up' || event.kind === 'new_power'
                    ? 'star'
                    : 'reward',
            );
            haptic(20);
            break;
          case 'powerUp':
            sfx.play('star');
            haptic([10, 18, 12]);
            break;
          case 'powerGranted':
            sfx.play('star');
            break;
          case 'stageEvent':
            sfx.play('reward');
            break;
          case 'fragment':
            sfx.play('fragment');
            break;
          case 'toast':
            pushToast(event.text, event.tone ?? 'info');
            break;
          case 'mission':
            sfx.play('stageUp');
            pushToast(event.text, 'info');
            break;
          default:
            break;
        }
      }
      emitFx(events);
    },
    [pushToast],
  );

  const finalize = useCallback((state: RunState) => {
    const result = runSummary(state);
    const record = recordRun(metaRef.current, result);
    metaRef.current = record.meta;
    setMeta(record.meta);
    setSummary({ ...result, crystals: record.crystals });
    setNewAchievements(record.achievements);
    if (record.achievements.length > 0) {
      window.setTimeout(() => sfx.play('achievement'), 450);
    }
    setRun(null);
    runRef.current = null;
    clearRun();
    setPaused(false);
    setToasts([]);
    setView('result');
  }, []);

  const applyResult = useCallback(
    (result: ActionResult) => {
      handleEvents(result.events);
      if (!result.ok) return;
      const next = result.state;
      if (next.status === 'gameOver' || next.status === 'victory') {
        finalize(next);
        return;
      }
      setRun(next);
      runRef.current = next;
      if (next.status === 'stageClear') setView('reward');
    },
    [finalize, handleEvents],
  );

  const startRun = useCallback(() => {
    const created = createRun(metaSnapshot(metaRef.current), randomSeed());
    setRun(created.state);
    runRef.current = created.state;
    setSummary(null);
    setNewAchievements([]);
    setToasts([]);
    setPaused(false);
    setView('run');
    sfx.play('stageUp');
    handleEvents(created.events);
  }, [handleEvents]);

  const continueRun = useCallback(() => {
    const current = runRef.current;
    if (!current) {
      pushToast('Nenhuma run salva encontrada.', 'bad');
      return;
    }
    sfx.play('uiOpen');
    setView(current.status === 'stageClear' ? 'reward' : 'run');
    setPaused(false);
  }, [pushToast]);

  const goto = useCallback((next: ScreenId) => {
    setPaused(false);
    setSettingsOpen(false);
    setToasts([]);
    setView(next);
  }, []);

  const goMenu = useCallback(() => {
    setPaused(false);
    setSettingsOpen(false);
    setToasts([]);
    setView('menu');
  }, []);

  const place = useCallback(
    (trayIndex: number, row: number, col: number) => {
      const current = runRef.current;
      if (!current) return;
      applyResult(placePiece(current, trayIndex, row, col));
    },
    [applyResult],
  );

  const power = useCallback(
    (id: PowerId, target?: { r: number; c: number }) => {
      const current = runRef.current;
      if (!current) return;
      applyResult(usePower(current, id, target));
    },
    [applyResult],
  );

  const recall = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    applyResult(recallLastPiece(current));
  }, [applyResult]);

  const claimEnergy = useCallback(
    (choiceId: string) => {
      const current = runRef.current;
      if (!current) return;
      const result = claimEnergyReward(current, choiceId);
      if (!result.ok) {
        sfx.play('deny');
        if (result.reason) pushToast(result.reason, 'bad');
        return;
      }
      handleEvents(result.events);
      setRun(result.state);
      runRef.current = result.state;
    },
    [handleEvents, pushToast],
  );

  const resolveEvent = useCallback(
    (optionId: string | null) => {
      const current = runRef.current;
      if (!current) return;
      const result = resolveStageEvent(current, optionId);
      if (!result.ok) {
        sfx.play('deny');
        if (result.reason) pushToast(result.reason, 'bad');
        return;
      }
      handleEvents(result.events);
      setRun(result.state);
      runRef.current = result.state;
    },
    [handleEvents, pushToast],
  );

  const pickReward = useCallback(
    (relicId: string) => {
      const current = runRef.current;
      if (!current) return;
      const result = chooseReward(current, relicId);
      handleEvents(result.events);
      if (!result.ok) return;
      const relic = relicById(relicId);
      if (relic) pushToast(`${relic.name} equipada!`, 'gold');
      setRun(result.state);
      runRef.current = result.state;
      setView(result.state.status === 'stageClear' ? 'reward' : 'run');
    },
    [handleEvents, pushToast],
  );

  const reroll = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const result = rerollRewards(current);
    if (!result.ok) {
      sfx.play('deny');
      if (result.reason) pushToast(result.reason, 'bad');
      return;
    }
    sfx.play('reward');
    setRun(result.state);
    runRef.current = result.state;
  }, [pushToast]);

  const abandon = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    applyResult(abandonRun(current));
  }, [applyResult]);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setMeta((prev) => updateSettings(prev, patch));
  }, []);

  const purchaseRelic = useCallback(
    (id: string) => {
      const result = buyRelic(metaRef.current, id);
      if (!result.ok) {
        sfx.play('deny');
        if (result.reason) pushToast(result.reason, 'bad');
        return;
      }
      metaRef.current = result.meta;
      setMeta(result.meta);
      sfx.play('buy');
      const relic = relicById(id);
      pushToast(`${relic?.name ?? 'Relíquia'} desbloqueada!`, 'gold');
    },
    [pushToast],
  );

  const purchasePower = useCallback(
    (id: PowerId) => {
      const result = buyPower(metaRef.current, id);
      if (!result.ok) {
        sfx.play('deny');
        if (result.reason) pushToast(result.reason, 'bad');
        return;
      }
      metaRef.current = result.meta;
      setMeta(result.meta);
      sfx.play('buy');
      pushToast('Poder desbloqueado!', 'gold');
    },
    [pushToast],
  );

  const purchaseTalent = useCallback(
    (id: TalentId) => {
      const result = buyTalent(metaRef.current, id);
      if (!result.ok) {
        sfx.play('deny');
        if (result.reason) pushToast(result.reason, 'bad');
        return;
      }
      metaRef.current = result.meta;
      setMeta(result.meta);
      sfx.play('buy');
      pushToast('Talento aprimorado!', 'gold');
    },
    [pushToast],
  );

  const resetProgress = useCallback(() => {
    const fresh = defaultMeta();
    metaRef.current = fresh;
    setMeta(fresh);
    setRun(null);
    runRef.current = null;
    clearRun();
    setSummary(null);
    setNewAchievements([]);
    setSettingsOpen(false);
    setView('menu');
    pushToast('Progresso zerado.', 'info');
  }, [pushToast]);

  return {
    meta,
    run,
    view,
    summary,
    newAchievements,
    toasts,
    paused,
    settingsOpen,
    hasSave: run !== null && (run.status === 'playing' || run.status === 'stageClear'),
    startRun,
    continueRun,
    goto,
    goMenu,
    place,
    power,
    recall,
    claimEnergy,
    resolveEvent,
    pickReward,
    reroll,
    abandon,
    setPaused,
    openSettings,
    closeSettings,
    patchSettings,
    purchaseRelic,
    purchasePower,
    purchaseTalent,
    resetProgress,
    dismissToast,
  };
}
