import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'bolt'
  | 'rows'
  | 'cross'
  | 'shield'
  | 'virus'
  | 'flame'
  | 'skull'
  | 'target'
  | 'hammer'
  | 'bomb'
  | 'shuffle'
  | 'drill'
  | 'convert'
  | 'wildcard'
  | 'pause'
  | 'play'
  | 'gear'
  | 'trophy'
  | 'chart'
  | 'collection'
  | 'back'
  | 'close'
  | 'check'
  | 'star'
  | 'clock'
  | 'crystal'
  | 'refresh'
  | 'lock'
  | 'sound'
  | 'mute'
  | 'home'
  | 'stone'
  | 'flag'
  | 'titan'
  | 'prism'
  | 'feather'
  | 'chest'
  | 'crown'
  | 'gem'
  | 'hand'
  | 'map'
  | 'eye'
  | 'leaf'
  | 'compass'
  | 'boot'
  | 'mirror'
  | 'chain'
  | 'coin'
  | 'sun'
  | 'wand'
  | 'hourglass'
  | 'bird'
  | 'sword'
  | 'link'
  | 'hole'
  | 'spiral'
  | 'grid'
  | 'seal'
  | 'armor';

const GLYPHS: Record<IconName, ReactNode> = {
  bolt: <path d="M13 2 4.5 13.5H11l-1.5 8.5L20 10h-6.5L13 2Z" />,
  rows: (
    <>
      <rect x="3" y="5" width="18" height="3.4" rx="1.4" />
      <rect x="3" y="10.3" width="18" height="3.4" rx="1.4" />
      <rect x="3" y="15.6" width="18" height="3.4" rx="1.4" />
    </>
  ),
  cross: (
    <>
      <rect x="9.4" y="3" width="5.2" height="18" rx="2.2" />
      <rect x="3" y="9.4" width="18" height="5.2" rx="2.2" />
    </>
  ),
  shield: <path d="M12 2.5 20 5.5v6.6c0 4.9-3.4 8.2-8 9.9-4.6-1.7-8-5-8-9.9V5.5l8-3Z" />,
  virus: (
    <>
      <circle cx="12" cy="12" r="5.2" />
      <path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1" />
    </>
  ),
  flame: <path d="M12 2.5c3.4 4 1.2 5.7 2.8 8 .9 1.3 2.2 1.4 2.2 3.7 0 3.3-2.5 5.8-5 5.8s-5-2.4-5-5.6c0-2.6 1.6-3.6 2.4-5.6.7-1.8.5-3.2 2.6-6.3Z" />,
  skull: (
    <>
      <path d="M12 2.8c-4.8 0-7.6 3-7.6 7.2 0 2.4 1 4 2.4 5v2.4c0 1 .8 1.8 1.8 1.8h.9V22h5v-2.8h.9c1 0 1.8-.8 1.8-1.8V15c1.4-1 2.4-2.6 2.4-5 0-4.2-2.8-7.2-7.6-7.2Z" />
      <circle cx="9.2" cy="10.4" r="1.7" fill="#0a1734" />
      <circle cx="14.8" cy="10.4" r="1.7" fill="#0a1734" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.6" opacity="0.55" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  hammer: (
    <>
      <path d="M4 19.8 13.4 10.4l2.2 2.2L6.2 22 4 19.8Z" />
      <path d="M12.6 5.4 15 3l6 6-2.4 2.4-6-6Z" />
      <path d="M11 9.2 14.8 13l-2 2-3.8-3.8 2-2Z" />
    </>
  ),
  bomb: (
    <>
      <circle cx="11" cy="14" r="7" />
      <path d="M15.8 8.4 18 6.2M17 3.4l.4 2.6 2.6.4" />
    </>
  ),
  shuffle: (
    <>
      <path d="M4 7h4l9 10h3M4 17h4l9-10h3" />
      <path d="M17.6 4.4 20 7l-2.4 2.6M17.6 14.4 20 17l-2.4 2.6" />
    </>
  ),
  drill: (
    <>
      <path d="M12 2.6 17 9H7l5-6.4Z" />
      <path d="M10 9v4.6M14 9v4.6M12 13.6V21" />
    </>
  ),
  convert: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
      <path d="M14 6.5h5M16.5 4v5M5 16.5h5M7.5 14v5" />
    </>
  ),
  wildcard: <path d="M12 3 14.4 9.2 21 9.6l-5 4.2 1.7 6.4L12 16.7 6.3 20.2 8 13.8 3 9.6l6.6-.4L12 3Z" />,
  pause: (
    <>
      <rect x="6.5" y="4" width="4" height="16" rx="1.6" />
      <rect x="13.5" y="4" width="4" height="16" rx="1.6" />
    </>
  ),
  play: <path d="M7 4.2 20 12 7 19.8V4.2Z" />,
  gear: (
    <>
      <path d="M4 7h8M18 7h2M4 17h2M12 17h8" />
      <circle cx="15" cy="7" r="2.4" />
      <circle cx="9" cy="17" r="2.4" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" />
      <path d="M7 4.6H4.4V7a3.6 3.6 0 0 0 3.6 3.6M17 4.6h2.6V7a3.6 3.6 0 0 1-3.6 3.6M12 13v5M8 21h8" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <rect x="5.4" y="12" width="3.4" height="6" rx="1.2" />
      <rect x="10.6" y="7.6" width="3.4" height="10.4" rx="1.2" />
      <rect x="15.8" y="4.4" width="3.4" height="13.6" rx="1.2" />
    </>
  ),
  collection: (
    <>
      <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="2" />
      <rect x="13.4" y="3.4" width="7.2" height="7.2" rx="2" />
      <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="2" />
      <rect x="13.4" y="13.4" width="7.2" height="7.2" rx="2" />
    </>
  ),
  back: <path d="M10 4 3 12l7 8M3 12h18" />,
  close: <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />,
  check: <path d="M4 12.5 9.4 18 20 6.5" />,
  star: <path d="M12 2.6 15 9l7 .7-5.3 4.7 1.5 6.9L12 17.8 5.8 21.3l1.5-6.9L2 9.7 9 9l3-6.4Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 6.6V12l3.8 2.4" />
    </>
  ),
  crystal: <path d="M12 2.4 20 9l-8 12.6L4 9l8-6.6Z" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 3.6V9h-5.4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.6" y="10" width="14.8" height="11" rx="3" />
      <path d="M8 10V7.6a4 4 0 0 1 8 0V10" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.6L12 5.4v13.2L7.6 14.5H4v-5Z" />
      <path d="M16 8.6a4.8 4.8 0 0 1 0 6.8M18.8 6a8.4 8.4 0 0 1 0 12" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5h3.6L12 5.4v13.2L7.6 14.5H4v-5Z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  home: <path d="M4 11.4 12 4l8 7.4V20H4v-8.6Z" />,
  stone: <path d="M6 6h6l6 4-2 9H8L4 13l2-7Z" />,
  flag: (
    <>
      <path d="M6 3v18" />
      <path d="M6 4.4h11l-2 4 2 4H6" />
    </>
  ),
  titan: (
    <>
      <path d="M3 8.4 7.6 12 12 5.4 16.4 12 21 8.4l-2 9.6H5l-2-9.6Z" />
      <path d="M6.6 20.4h10.8" />
    </>
  ),
  prism: (
    <>
      <path d="M12 2.6 21 9l-9 12.4L3 9l9-6.4Z" />
      <path d="M3 9h18M12 2.6V21.4" opacity="0.55" />
    </>
  ),
  feather: (
    <>
      <path d="M19.4 4.6c-6.6.4-11 3.6-11 8.4 0 2 1 3.6 2.6 4.4 4.4-1.2 7.6-5 8.4-12.8Z" />
      <path d="M4.6 20.4 15 10" />
    </>
  ),
  chest: (
    <>
      <rect x="3.4" y="9" width="17.2" height="11.4" rx="2.6" />
      <path d="M3.4 12.6h17.2M10 12.6h4M12 12.6v4.4" />
      <path d="M5.6 9V7.2a3 3 0 0 1 3-3h6.8a3 3 0 0 1 3 3V9" />
    </>
  ),
  crown: (
    <>
      <path d="M3 6.6 6.6 14l5.4-8 5.4 8L21 6.6 19.4 19H4.6L3 6.6Z" />
      <path d="M4.6 19h14.8" />
    </>
  ),
  gem: <path d="M8 3.4h8l4 5.2L12 21 4 8.6l4-5.2Z" />,
  hand: (
    <>
      <path d="M8 12.4V6.6a1.6 1.6 0 0 1 3.2 0v5M11.2 11.4V5a1.6 1.6 0 0 1 3.2 0v6.4M14.4 11.6V6.8a1.6 1.6 0 0 1 3.2 0v8.4c0 3.6-2.4 6.2-5.8 6.2-2.4 0-3.8-1-5-2.8L4 14.4c-.7-1.1-.3-2.2.8-2.8 1-.5 2 0 2.6 1l.6 1.1" />
    </>
  ),
  map: (
    <>
      <path d="M3 6.4 9 4l6 2.4L21 4v13.6L15 20l-6-2.4L3 20V6.4Z" />
      <path d="M9 4v13.6M15 6.4V20" opacity="0.6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.6 12S6 6.2 12 6.2 21.4 12 21.4 12 18 17.8 12 17.8 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  leaf: <path d="M20 4C10.6 4 4.4 8 4.4 14.4c0 2.4 1.2 4.4 3 5.4C14 19 19 12.4 20 4Z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M15.4 8.6 13.6 13.6 8.6 15.4l1.8-5 5-1.8Z" />
    </>
  ),
  boot: <path d="M7 3.4h4.4v8.2l6.2 3.4c1.6.9 2.4 2 2.4 3.6v2H4.4v-8.4L7 10.4V3.4Z" />,
  mirror: (
    <>
      <ellipse cx="12" cy="9.4" rx="6" ry="6.8" />
      <path d="M12 16.2v5.2M8.6 21.4h6.8" />
    </>
  ),
  chain: (
    <>
      <rect x="2.6" y="9.4" width="10" height="5.2" rx="2.6" />
      <rect x="11.4" y="9.4" width="10" height="5.2" rx="2.6" />
      <path d="M12 8.4v7.2" opacity="0.5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4v9.2M9.4 10h5.2M9.4 14h5.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.6" />
      <path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.6 4.6l2.2 2.2M17.2 17.2l2.2 2.2M19.4 4.6l-2.2 2.2M6.8 17.2l-2.2 2.2" />
    </>
  ),
  wand: (
    <>
      <path d="M4 20 15.4 8.6l2.4 2.4L6.4 22.4 4 20Z" />
      <path d="M17.4 2.6l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1 1-2.6Z" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 2.6h12M6 21.4h12M7 2.6v3.8c0 2.4 5 4.6 5 5.6s-5 3.2-5 5.6v3.8M17 2.6v3.8c0 2.4-5 4.6-5 5.6s5 3.2 5 5.6v3.8" />
    </>
  ),
  bird: (
    <>
      <path d="M4 17.6c4 .8 7.2-.6 9.4-3.4 1.8-2.2 2-5.4 6.6-6.6-1.2 3.4 1 4.2 1 6.4 0 4.6-4 8-9 8-3.4 0-6.2-1.6-8-4.4Z" />
      <path d="M13 6.4c0-2 1.4-3.6 3.4-4-.4 1.6.4 2.6 1.4 3.4" />
    </>
  ),
  sword: (
    <>
      <path d="M14.6 2.6h6.8v6.8L11 20 4 13 14.6 2.6Z" />
      <path d="M3 21l4-4M6.6 14.4l3 3" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.4 4.4 0 0 0 6.2 0l2.4-2.4a4.4 4.4 0 0 0-6.2-6.2L11 6.8" />
      <path d="M14 10a4.4 4.4 0 0 0-6.2 0l-2.4 2.4a4.4 4.4 0 0 0 6.2 6.2L13 17.2" />
    </>
  ),
  hole: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="3.6" fill="#081633" />
    </>
  ),
  spiral: (
    <>
      <path d="M12 12c0-3 2.4-5.4 5.4-5.4S23 9 23 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" opacity="0.5" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" opacity="0.8" />
    </>
  ),
  seal: (
    <>
      <circle cx="12" cy="10" r="5.4" />
      <path d="M9 14.6 7.6 21l4.4-2 4.4 2-1.4-6.4" />
    </>
  ),
  armor: <path d="M12 2.6 20 5v7.4c0 4.6-3.4 7.8-8 9.4-4.6-1.6-8-4.8-8-9.4V5l8-2.4Z" />,
};

/** Ícones desenhados com traço (linhas abertas) precisam de stroke para aparecer. */
const STROKE_ICONS = new Set<IconName>([
  'gear',
  'target',
  'check',
  'close',
  'back',
  'sound',
  'mute',
  'refresh',
  'shuffle',
  'drill',
  'chain',
  'link',
  'sword',
  'hourglass',
  'compass',
  'eye',
  'map',
  'mirror',
  'sun',
  'wand',
  'virus',
  'flag',
  'seal',
  'feather',
  'bird',
  'spiral',
  'grid',
  'coin',
  'trophy',
  'clock',
  'lock',
  'crown',
  'titan',
  'chart',
  'skull',
  'bomb',
]);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  filled?: boolean;
}

export function Icon({ name, size = 22, filled = true, className, ...rest }: IconProps) {
  const stroked = filled && STROKE_ICONS.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill={filled && !stroked ? 'currentColor' : 'none'}
      stroke={stroked ? 'currentColor' : filled ? 'none' : 'currentColor'}
      strokeWidth={stroked ? 1.9 : filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {GLYPHS[name]}
    </svg>
  );
}
