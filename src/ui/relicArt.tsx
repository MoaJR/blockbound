import type { CSSProperties } from 'react';
import type { Rarity } from '../engine/types';
import type { RelicIcon } from '../engine/relics';
import { Icon } from './icons';
import type { IconName } from './icons';

const ICON_MAP: Record<RelicIcon, IconName> = {
  crown: 'crown',
  seal: 'seal',
  hourglass: 'hourglass',
  glove: 'hand',
  map: 'map',
  charm: 'gem',
  purse: 'chest',
  lens: 'eye',
  crystal: 'crystal',
  core: 'prism',
  combo: 'bolt',
  bomb: 'bomb',
  clover: 'leaf',
  compass: 'compass',
  boots: 'boot',
  mirror: 'mirror',
  flame: 'flame',
  clock: 'clock',
  eye: 'eye',
  chain: 'chain',
  coin: 'coin',
  drill: 'drill',
  gem: 'gem',
  sun: 'sun',
  scepter: 'wand',
  glass: 'hourglass',
  phoenix: 'bird',
  sword: 'sword',
  link: 'link',
  void: 'hole',
  titan: 'titan',
  chest: 'chest',
  table: 'grid',
  spiral: 'spiral',
};

export function relicIconName(icon: RelicIcon): IconName {
  return ICON_MAP[icon] ?? 'gem';
}

export interface RelicArtProps {
  icon: RelicIcon;
  rarity: Rarity;
  size?: number;
  locked?: boolean;
  className?: string;
}

export function RelicArt({ icon, rarity, size = 36, locked = false, className = '' }: RelicArtProps) {
  const style = { '--art-size': `${size}px` } as CSSProperties;
  return (
    <span className={`relic-art rarity-${rarity} ${locked ? 'is-locked' : ''} ${className}`} style={style}>
      <span className="relic-art__glow" aria-hidden="true" />
      <Icon name={relicIconName(icon)} size={Math.round(size * 0.56)} />
    </span>
  );
}
