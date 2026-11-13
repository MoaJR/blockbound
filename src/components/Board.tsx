import { memo } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Board as BoardModel, Cell, Coord, PowerId } from '../engine/types';
import type { PreviewInfo } from '../engine/preview';
import { Icon } from '../ui/icons';

export interface BoardPopup {
  id: number;
  r: number;
  c: number;
  text: string;
  tone: 'gold' | 'cyan' | 'violet' | 'red';
}

export interface BoardFlash {
  id: number;
  rows: number[];
  cols: number[];
  cells: Coord[];
  lines: number;
  cross: boolean;
  tone: 'gold' | 'cyan' | 'violet' | 'red';
}

export interface BoardPlacement {
  id: number;
  r: number;
  c: number;
  color: number;
  delay: number;
}

export interface BoardPowerFx {
  id: number;
  power: PowerId;
  r: number;
  c: number;
  cells: Coord[];
  rows: number[];
  cols: number[];
}

export interface BoardProps {
  board: BoardModel;
  preview: PreviewInfo | null;
  cursor: Coord | null;
  flashes: BoardFlash[];
  popups: BoardPopup[];
  placements: BoardPlacement[];
  powerFx: BoardPowerFx[];
  targeting: boolean;
  disabled: boolean;
  boardRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: () => void;
  bossAccent?: string | null;
}

const KIND_LABEL: Record<Cell['kind'], string> = {
  empty: 'vazio',
  block: 'bloco',
  corrupt: 'corrompido',
  frozen: 'congelado',
  bomb: 'bomba',
};

const CellView = memo(function CellView({
  cell,
  r,
  c,
}: {
  cell: Cell;
  r: number;
  c: number;
}) {
  return (
    <div
      className={`cell cell--${cell.kind}`}
      role="gridcell"
      aria-label={`linha ${r + 1}, coluna ${c + 1}: ${KIND_LABEL[cell.kind]}`}
    >
      <span className="cell__bed" aria-hidden="true" />
      {cell.kind === 'block' && <span className={`block block--c${cell.color}`} aria-hidden="true" />}
      {cell.kind === 'corrupt' && (
        <span className="hazard hazard--corrupt" aria-hidden="true">
          <Icon name="virus" size={18} />
        </span>
      )}
      {cell.kind === 'frozen' && (
        <span className="hazard hazard--frozen" aria-hidden="true">
          <Icon name="crystal" size={18} />
        </span>
      )}
      {cell.kind === 'bomb' && (
        <span className="hazard hazard--bomb" aria-hidden="true">
          <Icon name="bomb" size={18} />
          <span className="hazard__timer">{cell.timer ?? 0}</span>
        </span>
      )}
    </div>
  );
});

function posStyle(r: number, c: number, size: number) {
  return {
    left: `calc(100% / ${size} * ${c})`,
    top: `calc(100% / ${size} * ${r})`,
  };
}

function inBoard({ r, c }: Coord, size: number): boolean {
  return r >= 0 && c >= 0 && r < size && c < size;
}

export function Board({
  board,
  preview,
  cursor,
  flashes,
  popups,
  placements,
  powerFx,
  targeting,
  disabled,
  boardRef,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  bossAccent = null,
}: BoardProps) {
  const size = board.size;
  const valid = Boolean(preview?.valid);
  const lines = preview?.lines ?? 0;
  const intensity = lines >= 3 ? 'is-heavy' : lines >= 2 ? 'is-multi' : '';
  const blocked = preview?.blocked.filter((coord) => inBoard(coord, size)) ?? [];

  return (
    <div
      className={`board ${targeting ? 'is-targeting' : ''} ${disabled ? 'is-disabled' : ''} ${
        bossAccent ? `board--boss-${bossAccent}` : ''
      }`}
      ref={boardRef}
      role="grid"
      aria-label="Tabuleiro 9 por 9"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <span className="board__aura" aria-hidden="true" />
      {/* Moldura decorativa: fica ATRÁS e POR FORA da matriz — as peças nunca são
          recortadas e o acabamento arredondado externo é preservado. */}
      <span className="board__skin" aria-hidden="true" />
      <div className="board__grid">
        {board.cells.map((row, r) =>
          row.map((cell, c) => <CellView key={`${r}-${c}`} cell={cell} r={r} c={c} />),
        )}
      </div>

      {/* Linhas e colunas que serão destruídas (atualiza a cada âncora). */}
      {valid &&
        preview?.rows.map((r) => (
          <span
            key={`pr-${r}`}
            className={`line-hint line-hint--row ${intensity}`}
            style={{ top: `calc(100% / ${size} * ${r})` }}
            aria-hidden="true"
          />
        ))}
      {valid &&
        preview?.cols.map((c) => (
          <span
            key={`pc-${c}`}
            className={`line-hint line-hint--col ${intensity}`}
            style={{ left: `calc(100% / ${size} * ${c})` }}
            aria-hidden="true"
          />
        ))}

      {/* Células que serão removidas: dourado = já ocupadas, ciano = preenchidas pela peça. */}
      {valid &&
        preview?.boardCleared.map(({ r, c }) => (
          <span
            key={`cb-${r}-${c}`}
            className={`preview-clear preview-clear--board ${intensity}`}
            style={posStyle(r, c, size)}
            aria-hidden="true"
          />
        ))}
      {valid &&
        preview?.pieceCleared.map(({ r, c }) => (
          <span
            key={`cp-${r}-${c}`}
            className={`preview-clear preview-clear--piece ${intensity}`}
            style={posStyle(r, c, size)}
            aria-hidden="true"
          />
        ))}
      {valid &&
        preview?.crossCells.map(({ r, c }) => (
          <span
            key={`cx-${r}-${c}`}
            className="preview-clear preview-clear--cross"
            style={posStyle(r, c, size)}
            aria-hidden="true"
          />
        ))}

      {/* Footprint fantasma da peça / conflitos. */}
      {valid &&
        preview?.cells.map(({ r, c }) => (
          <span
            key={`p-${r}-${c}`}
            className="preview-cell preview-cell--good"
            style={posStyle(r, c, size)}
            aria-hidden="true"
          />
        ))}
      {!valid &&
        blocked.map(({ r, c }) => (
          <span
            key={`i-${r}-${c}`}
            className="preview-cell preview-cell--bad"
            style={posStyle(r, c, size)}
            aria-hidden="true"
          />
        ))}

      {placements.map((placement) => (
        <span
          key={`pl-${placement.id}-${placement.r}-${placement.c}`}
          className={`place-impact place-impact--c${placement.color}`}
          style={{ ...posStyle(placement.r, placement.c, size), animationDelay: `${placement.delay}ms` }}
          aria-hidden="true"
        />
      ))}

      {flashes.map((flash) => (
        <span
          key={`f-${flash.id}`}
          className={`flash-group flash-group--tier-${Math.min(4, Math.max(1, flash.lines))} ${
            flash.cross ? 'is-cross' : ''
          } flash-group--${flash.tone}`}
          aria-hidden="true"
        >
          {flash.cells.map((cell, index) => (
            <span
              key={`sc-${cell.r}-${cell.c}-${index}`}
              className={`shock-cell shock-cell--${flash.tone}`}
              style={{ ...posStyle(cell.r, cell.c, size), animationDelay: `${Math.min(170, index * 7)}ms` }}
            />
          ))}
          {flash.rows.map((r) => (
            <span
              key={`fr-${r}`}
              className="flash-line flash-line--row"
              style={{ top: `calc(100% / ${size} * ${r})` }}
            />
          ))}
          {flash.cols.map((c) => (
            <span
              key={`fc-${c}`}
              className="flash-line flash-line--col"
              style={{ left: `calc(100% / ${size} * ${c})` }}
            />
          ))}
          {flash.lines >= 2 && <span className={`shock-ring shock-ring--${flash.tone}`} />}
        </span>
      ))}

      {powerFx.map((fx) =>
        fx.power === 'drill' ? (
          <span key={`pf-${fx.id}`} className="power-fx-group" aria-hidden="true">
            {fx.rows.map((r) => (
              <span
                key={`dr-${r}`}
                className="power-beam power-beam--row"
                style={{ top: `calc(100% / ${size} * ${r})` }}
              />
            ))}
            {fx.cols.map((c) => (
              <span
                key={`dc-${c}`}
                className="power-beam power-beam--col"
                style={{ left: `calc(100% / ${size} * ${c})` }}
              />
            ))}
          </span>
        ) : (
          <span
            key={`pf-${fx.id}`}
            className={`power-ring power-ring--${fx.power}`}
            style={{
              left: `calc(100% / ${size} * (${fx.c} + 0.5))`,
              top: `calc(100% / ${size} * (${fx.r} + 0.5))`,
            }}
            aria-hidden="true"
          />
        ),
      )}

      {cursor && (
        <span
          className="cursor"
          style={{
            left: `calc(100% / ${size} * ${cursor.c})`,
            top: `calc(100% / ${size} * ${cursor.r})`,
          }}
          aria-hidden="true"
        />
      )}

      <canvas ref={canvasRef} className="board__fx" aria-hidden="true" />

      {popups.map((popup) => (
        <span
          key={popup.id}
          className={`popup popup--${popup.tone}`}
          style={{
            left: `calc(100% / ${size} * (${popup.c} + 0.5))`,
            top: `calc(100% / ${size} * (${popup.r} + 0.5))`,
          }}
          aria-hidden="true"
        >
          {popup.text}
        </span>
      ))}
    </div>
  );
}
