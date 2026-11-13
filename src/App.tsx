import { useEffect, useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import { useGame } from './hooks/useGame';
import { ScreenTransition } from './components/ScreenTransition';
import { ToastStack } from './components/ToastStack';
import { MainMenu } from './screens/MainMenu';
import { RunScreen } from './screens/RunScreen';
import { RewardScreen } from './screens/RewardScreen';
import { ResultScreen } from './screens/ResultScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsModal } from './screens/SettingsModal';
import { PauseOverlay } from './screens/PauseOverlay';
import { useAudioScene } from './audio/useAudioScene';
import { sfx } from './audio/sfx';

function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export default function App() {
  const api = useGame();
  const systemReduced = useSystemReducedMotion();
  const reduced = api.meta.settings.reducedMotion || systemReduced;

  useAudioScene(api);

  useEffect(() => {
    const shouldPlay = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      const button = target.closest('button, [role="button"]');
      if (!button) return false;
      if (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') return false;
      if (button.closest('[data-sfx="none"]')) return false;
      return true;
    };

    const onPointer = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (shouldPlay(event.target)) sfx.play('click');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (shouldPlay(document.activeElement)) sfx.play('click');
    };

    document.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const screen = (() => {
    if (api.view === 'run' && api.run) {
      return (
        <ScreenTransition key="run" variant="run">
          <RunScreen api={api} reducedMotion={reduced} />
        </ScreenTransition>
      );
    }
    if (api.view === 'reward' && api.run) {
      return (
        <ScreenTransition key="reward" variant="reward">
          <RewardScreen api={api} />
        </ScreenTransition>
      );
    }
    if (api.view === 'result' && api.summary) {
      return (
        <ScreenTransition key="result" variant="result">
          <ResultScreen api={api} />
        </ScreenTransition>
      );
    }
    if (api.view === 'collection') {
      return (
        <ScreenTransition key="collection" variant="secondary">
          <CollectionScreen api={api} />
        </ScreenTransition>
      );
    }
    if (api.view === 'achievements') {
      return (
        <ScreenTransition key="achievements" variant="secondary">
          <AchievementsScreen api={api} />
        </ScreenTransition>
      );
    }
    if (api.view === 'stats') {
      return (
        <ScreenTransition key="stats" variant="secondary">
          <StatsScreen api={api} />
        </ScreenTransition>
      );
    }
    return (
      <ScreenTransition key="menu" variant="menu">
        <MainMenu api={api} />
      </ScreenTransition>
    );
  })();

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <LazyMotion features={domAnimation} strict>
        <div className={`app ${reduced ? 'reduce-motion' : ''}`}>
          <AnimatePresence mode="wait" initial={false}>
            {screen}
          </AnimatePresence>

          <AnimatePresence>
            {api.paused && api.run && api.view === 'run' && (
              <PauseOverlay key="pause" api={api} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {api.settingsOpen && <SettingsModal key="settings" api={api} />}
          </AnimatePresence>

          <ToastStack
            toasts={api.toasts}
            onDismiss={api.dismissToast}
            placement={api.view === 'run' ? 'raised' : 'top'}
          />
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}
