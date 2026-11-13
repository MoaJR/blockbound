import { m as motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { DURATION, EASE } from '../motion/tokens';

export type ScreenVariant = 'menu' | 'run' | 'reward' | 'result' | 'secondary';

const PRESETS: Record<
  ScreenVariant,
  {
    initial: Record<string, number>;
    animate: Record<string, number>;
    exit: Record<string, number>;
    duration: number;
  }
> = {
  menu: {
    initial: { opacity: 0, y: 20, scale: 0.992 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -14, scale: 0.996 },
    duration: DURATION.base,
  },
  run: {
    initial: { opacity: 0, y: 10, scale: 0.995 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8 },
    duration: DURATION.fast,
  },
  reward: {
    initial: { opacity: 0, y: 24, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 10, scale: 0.99 },
    duration: DURATION.slow,
  },
  result: {
    initial: { opacity: 0, scale: 0.97, y: 16 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 1.01 },
    duration: 0.44,
  },
  secondary: {
    initial: { opacity: 0, x: 18 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -14 },
    duration: DURATION.base,
  },
};

export interface ScreenTransitionProps {
  children: ReactNode;
  className?: string;
  variant?: ScreenVariant;
}

export function ScreenTransition({
  children,
  className = '',
  variant = 'menu',
}: ScreenTransitionProps) {
  const preset = PRESETS[variant];
  return (
    <motion.div
      className={`screen screen-transition screen-transition--${variant} ${className}`}
      data-screen-variant={variant}
      initial={preset.initial}
      animate={preset.animate}
      exit={preset.exit}
      transition={{ duration: preset.duration, ease: EASE.out }}
    >
      {children}
    </motion.div>
  );
}
