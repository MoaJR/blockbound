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

  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const screen = (() => {
    if (api.view === 'run' && api.run) {
      return (
        <ScreenTransition key="run">
          <RunScreen api={api} reducedMotion={reduced} />
        </ScreenTransition>
      );
    }
    if (api.view === 'reward' && api.run) {
      return (
        <ScreenTransition key="reward">
          <RewardScreen api={api} />
        </ScreenTransition>
      );
    }
    if (api.view === 'result' && api.summary) {
      return (
        <ScreenTransition key="result">
          <ResultScreen api={api} />
        </ScreenTransition>
      );
    }
    if (api.view === 'collection') {
      return (
        <ScreenTransition key="collection">
          <CollectionScreen api={api} />
        </ScreenTransition>
      );
    }
    if (api.view === 'achievements') {
      return (
        <ScreenTransition key="achievements">
          <AchievementsScreen api={api} />
        </ScreenTransition>
      );
    }
    if (api.view === 'stats') {
      return (
        <ScreenTransition key="stats">
          <StatsScreen api={api} />
        </ScreenTransition>
      );
    }
    return (
      <ScreenTransition key="menu">
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
