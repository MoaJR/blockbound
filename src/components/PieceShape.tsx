import type { CSSProperties } from 'react';
import type { Piece } from '../engine/types';
import { shapeBounds } from '../engine/pieces';
import { Icon } from '../ui/icons';

export interface PieceShapeProps {
  piece: Piece;
  cellSize: number;
  ghost?: boolean;
  className?: string;
}

export function PieceShape({ piece, cellSize, ghost = false, className = '' }: PieceShapeProps) {
  const { h, w } = shapeBounds(piece.cells);
  const style = {
    '--pc': `${cellSize}px`,
    gridTemplateColumns: `repeat(${w}, var(--pc))`,
    gridTemplateRows: `repeat(${h}, var(--pc))`,
    width: `calc(var(--pc) * ${w})`,
    height: `calc(var(--pc) * ${h})`,
  } as CSSProperties;

  const occupied = new Set(piece.cells.map((cell) => `${cell.r}:${cell.c}`));

  return (
    <span
      className={`piece-shape ${piece.special ? `piece-shape--${piece.special}` : ''} ${ghost ? 'is-ghost' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {Array.from({ length: h }).map((_, r) =>
        Array.from({ length: w }).map((__, c) => {
          const filled = occupied.has(`${r}:${c}`);
          return (
            <span
              key={`${r}:${c}`}
              className={filled ? `block block--c${piece.color}` : 'piece-shape__hole'}
            >
              {filled && piece.special === 'prism' && (
                <Icon name="prism" size={cellSize * 0.62} className="block__glyph" />
              )}
              {filled && piece.special === 'star' && (
                <Icon name="star" size={cellSize * 0.6} className="block__glyph" />
              )}
              {filled && piece.special === 'tnt' && (
                <Icon name="bomb" size={cellSize * 0.6} className="block__glyph" />
              )}
            </span>
          );
        }),
      )}
    </span>
  );
}
