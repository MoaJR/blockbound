import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Piece } from '../engine/types';
import { shapeBounds } from '../engine/pieces';
import { PieceShape } from './PieceShape';

export interface PieceTrayProps {
  tray: (Piece | null)[];
  selected: number | null;
  draggingIndex: number | null;
  disabled: boolean;
  onPointerDown: (index: number, event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove?: (index: number, event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (index: number, event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel?: (index: number, event: ReactPointerEvent<HTMLElement>) => void;
  onKeySelect?: (index: number) => void;
  shuffleKey?: number;
}

function pieceCellSize(piece: Piece, card: { w: number; h: number }): number {
  const { h, w } = shapeBounds(piece.cells);
  const span = Math.max(h, w, 1);
  // A largura E a altura do card limitam o desenho: assim nenhuma peça é
  // recortada pelo `overflow: hidden` do card (inclusive as de 5 células).
  const available = Math.max(24, Math.min(card.w - 14, card.h - 10));
  return Math.max(8, Math.min(30, Math.floor(available / span)));
}

export function PieceTray({
  tray,
  selected,
  draggingIndex,
  disabled,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeySelect,
  shuffleKey = 0,
}: PieceTrayProps) {
  const trayRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ w: 112, h: 84 });

  useLayoutEffect(() => {
    const element = trayRef.current;
    if (!element) return;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      const card = element.querySelector('.tray__card') as HTMLElement | null;
      const height = card?.getBoundingClientRect().height ?? 0;
      const next = {
        w: Math.max(40, (width - 30) / 3),
        h: height > 0 ? height : 64,
      };
      setCardSize((prev) =>
        Math.abs(prev.w - next.w) < 0.5 && Math.abs(prev.h - next.h) < 0.5 ? prev : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="tray" role="list" aria-label="Peças disponíveis" ref={trayRef}>
      {tray.map((piece, index) => {
        const isDragging = draggingIndex === index;
        const isSelected = selected === index;
        const size = piece ? pieceCellSize(piece, cardSize) : 16;
        return (
          <div className="tray__slot" role="listitem" key={`${piece?.id ?? `empty-${index}`}-${shuffleKey}`}>
            {piece ? (
              <button
                type="button"
                className={`tray__card ${isSelected ? 'is-selected' : ''} ${
                  isDragging ? 'is-dragging' : ''
                } ${piece.special ? `tray__card--${piece.special}` : ''}`}
                data-tray-index={index}
                data-sfx="none"
                aria-label={`Peça ${index + 1}${isSelected ? ', selecionada' : ''}`}
                aria-pressed={isSelected}
                disabled={disabled}
                onPointerDown={(event) => onPointerDown(index, event)}
                onPointerMove={(event) => onPointerMove?.(index, event)}
                onPointerUp={(event) => onPointerUp?.(index, event)}
                onPointerCancel={(event) => onPointerCancel?.(index, event)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onKeySelect?.(index);
                  }
                }}
              >
                <span className="tray__num" aria-hidden="true">{index + 1}</span>
                <PieceShape piece={piece} cellSize={size} />
                {piece.special && (
                  <span className="tray__badge">
                    {piece.special === 'prism' ? 'PRISMA' : piece.special === 'star' ? 'ESTRELA' : 'TNT'}
                  </span>
                )}
              </button>
            ) : (
              <span className="tray__card tray__card--used" aria-hidden="true">
                <span className="tray__used-mark" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
