import { useEffect, useRef, useState } from 'react';

export interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
  suffix?: string;
}

export function AnimatedNumber({ value, className, duration = 340, suffix = '' }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || duration <= 0) {
      current.current = value;
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const diff = value - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + diff * eased);
      current.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={className}>
      {display.toLocaleString('pt-BR')}
      {suffix}
    </span>
  );
}
