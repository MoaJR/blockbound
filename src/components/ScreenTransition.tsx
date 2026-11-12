import { m as motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface ScreenTransitionProps {
  children: ReactNode;
  className?: string;
}

export function ScreenTransition({ children, className = '' }: ScreenTransitionProps) {
  return (
    <motion.div
      className={`screen screen-transition ${className}`}
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -14, scale: 0.995 }}
      transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
