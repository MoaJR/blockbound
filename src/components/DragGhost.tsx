import type { CSSProperties, RefObject } from 'react';
import type { Piece } from '../engine/types';
import { shapeBounds } from '../engine/pieces';
import { PieceShape } from './PieceShape';

export interface DragGhostProps {
  piece: Piece;
  cellSize: number;
  /** Posição inicial do canto superior esquerdo (px de viewport). */
  x: number;
  y: number;
  over: boolean;
  invalid: boolean;
  ghostRef: RefObject<HTMLDivElement | null>;
}

/**
 * Peça arrastada: acompanha o ponteiro livremente (sem snap). A posição é
 * escrita imperativamente pelo pai via `ghostRef` dentro de um rAF; React só
 * define o transform inicial — nenhuma transição CSS é aplicada durante o arraste.
 */
export function DragGhost({ piece, cellSize, x, y, over, invalid, ghostRef }: DragGhostProps) {
  const { h, w } = shapeBounds(piece.cells);
  const style = {
    transform: `translate3d(${x}px, ${y}px, 0)`,
    '--ghost-cell': `${cellSize}px`,
    width: `${w * cellSize}px`,
    height: `${h * cellSize}px`,
  } as CSSProperties;

  return (
    <div
      ref={ghostRef}
      className={`drag-ghost ${invalid ? 'is-invalid' : ''} ${over ? 'is-over' : ''}`}
      style={style}
      aria-hidden="true"
    >
      <PieceShape piece={piece} cellSize={cellSize} ghost />
    </div>
  );
}
