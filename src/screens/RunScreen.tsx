import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, m as motion } from 'framer-motion';
import type { Coord, GameEvent, PowerId } from '../engine/types';
import { shapeBounds, trayHasPlacement } from '../engine/pieces';
import { getMods, isStuck, usablePowers } from '../engine/run';
import { previewPlacement } from '../engine/preview';
import type { PreviewInfo } from '../engine/preview';
import { anchorFromCell, resolveDrop } from '../engine/placement';
import { stageTitle } from '../engine/stages';
import { POWER_MAP } from '../engine/powers';
import type { GameApi } from '../hooks/useGame';
import { Board } from '../components/Board';
import type { BoardFlash, BoardPopup } from '../components/Board';
import { PieceTray } from '../components/PieceTray';
import { DragGhost } from '../components/DragGhost';
import { ObjectivePanel } from '../components/ObjectivePanel';
import { BossBar } from '../components/BossBar';
import { RelicRail } from '../components/RelicRail';
import { PowerBar } from '../components/PowerBar';
import { EnergyBar } from '../components/EnergyBar';
import { ProgressionPanel } from '../components/ProgressionPanel';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';
import { ParticleField } from '../fx/particles';
import { subscribeFx } from '../fx/fxBus';
import { sfx } from '../audio/sfx';

const CELL_COLORS = ['#25c8ec', '#8a5bff', '#ffc857', '#4ade80', '#ff5f9e', '#4a90ff'];

const EVENT_ICON: Record<string, IconName> = {
  chest: 'chest',
  portal: 'spiral',
  merchant: 'coin',
  sanctuary: 'sun',
  fragment: 'bolt',
};

interface DragVisual {
  index: number;
  originX: number;
  originY: number;
  over: boolean;
  invalid: boolean;
}

interface DragSession {
  index: number;
  pointerId: number;
  grabX: number;
  grabY: number;
  lift: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  inside: boolean;
  over: boolean;
}

type ActivePanel = 'energy' | 'event' | null;

let popupSeq = 0;
let flashSeq = 0;

export interface RunScreenProps {
  api: GameApi;
  reducedMotion: boolean;
}

function cellFromEvent(
  boardEl: HTMLDivElement | null,
  clientX: number,
  clientY: number,
): { cell: number; r: number; c: number } | null {
  if (!boardEl) return null;
  const rect = boardEl.getBoundingClientRect();
  const cell = rect.width / 9;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  const c = Math.max(0, Math.min(8, Math.floor(x / cell)));
  const r = Math.max(0, Math.min(8, Math.floor(y / cell)));
  return { cell, r, c };
}

export function RunScreen({ api, reducedMotion }: RunScreenProps) {
  const run = api.run;
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<Coord | null>(null);
  const [drag, setDrag] = useState<DragVisual | null>(null);
  const [dragAnchor, setDragAnchor] = useState<Coord | null>(null);
  const [hover, setHover] = useState<Coord | null>(null);
  const [cursor, setCursor] = useState<Coord>({ r: 4, c: 4 });
  const [targeting, setTargeting] = useState<PowerId | null>(null);
  const [boardSize, setBoardSize] = useState(320);
  const [flashes, setFlashes] = useState<BoardFlash[]>([]);
  const [popups, setPopups] = useState<BoardPopup[]>([]);
  const [denyTick, setDenyTick] = useState(0);
  const [panel, setPanel] = useState<ActivePanel>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<ParticleField | null>(null);
  const dragSession = useRef<DragSession | null>(null);
  const ghostPos = useRef<{ x: number; y: number } | null>(null);
  const dragRaf = useRef(0);
  const dragAnchorRef = useRef<Coord | null>(null);
  const timersRef = useRef<number[]>([]);

  const boardWidth = boardSize >= 180 ? boardSize : 320;
  const cellSize = boardWidth / 9;
  const mods = useMemo(() => (run ? getMods(run) : null), [run]);

  useEffect(() => {
    return () => {
      if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
      dragRaf.current = 0;
    };
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const measure = () => {
      const rect = slot.getBoundingClientRect();
      const size = Math.max(200, Math.min(rect.width, rect.height, 640));
      setBoardSize(Math.floor(size));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    window.addEventListener('orientationchange', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = new ParticleField(canvas);
    fieldRef.current = field;
    return () => {
      field.destroy();
      fieldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.setReduced(reducedMotion);
    field.setSize(boardWidth, boardWidth, Math.min(2, window.devicePixelRatio || 1));
  }, [boardWidth, reducedMotion]);

  const addPopup = useCallback((r: number, c: number, text: string, tone: BoardPopup['tone']) => {
    popupSeq += 1;
    const id = popupSeq;
    setPopups((prev) => [...prev.slice(-5), { id, r, c, text, tone }]);
    const timer = window.setTimeout(() => {
      setPopups((prev) => prev.filter((popup) => popup.id !== id));
    }, 850);
    timersRef.current.push(timer);
  }, []);

  const addFlash = useCallback((rows: number[], cols: number[]) => {
    flashSeq += 1;
    const id = flashSeq;
    setFlashes((prev) => [...prev, { id, rows, cols }]);
    const timer = window.setTimeout(() => {
      setFlashes((prev) => prev.filter((flash) => flash.id !== id));
    }, 420);
    timersRef.current.push(timer);
  }, []);

  useEffect(() => {
    return subscribeFx((events: GameEvent[]) => {
      const field = fieldRef.current;
      if (!field) return;
      for (const event of events) {
        if (event.type === 'clear') {
          addFlash(event.rows, event.cols);
          const step = event.cells.length > 40 ? 2 : 1;
          for (let i = 0; i < event.cells.length; i += step) {
            const cell = event.cells[i];
            if (!cell) continue;
            field.burst({
              x: (cell.c + 0.5) * cellSize,
              y: (cell.r + 0.5) * cellSize,
              color: CELL_COLORS[(cell.r + cell.c) % CELL_COLORS.length] ?? '#9be8ff',
              count: 3,
              power: 0.9,
              size: 4,
            });
          }
          const anchor = event.cells[Math.floor(event.cells.length / 2)];
          if (anchor) addPopup(anchor.r, anchor.c, `+${event.points}`, event.lines >= 2 ? 'gold' : 'cyan');
          if (event.lines >= 2) {
            field.burst({
              x: boardWidth / 2,
              y: boardWidth / 2,
              color: '#ffc857',
              count: 24,
              power: 1.8,
              shape: 'spark',
            });
          }
        }
        if (event.type === 'place') {
          for (const cell of event.cells) {
            field.burst({
              x: (cell.c + 0.5) * cellSize,
              y: (cell.r + 0.5) * cellSize,
              color: CELL_COLORS[event.color] ?? '#9be8ff',
              count: 2,
              power: 0.5,
              size: 3,
            });
          }
        }
        if (event.type === 'power' && event.cells.length > 0) {
          for (const cell of event.cells) {
            field.burst({
              x: (cell.c + 0.5) * cellSize,
              y: (cell.r + 0.5) * cellSize,
              color: '#c9a6ff',
              count: 4,
              power: 1.1,
            });
          }
        }
        if (event.type === 'spawn' && event.cells.length > 0) {
          const color =
            event.kind === 'frozen' ? '#9fe8ff' : event.kind === 'corrupt' ? '#b06bff' : '#ff8a3d';
          for (const cell of event.cells) {
            field.burst({
              x: (cell.c + 0.5) * cellSize,
              y: (cell.r + 0.5) * cellSize,
              color,
              count: 6,
              power: 1,
            });
          }
        }
        if (event.type === 'rescue') {
          field.burst({
            x: boardWidth / 2,
            y: boardWidth / 2,
            color: '#ffd98a',
            count: 26,
            power: 2,
            shape: 'spark',
          });
        }
        if (event.type === 'boss' && event.damage > 0) {
          addPopup(1, 4, `-${event.damage}`, 'violet');
        }
        if (event.type === 'score' && event.amount > 0) {
          if (event.at) {
            const linePoints = event.breakdown?.line ?? 0;
            if (linePoints === 0) addPopup(event.at.r, event.at.c, `+${event.amount}`, 'cyan');
          } else {
            addPopup(0, 4, `+${event.amount}`, 'gold');
          }
        }
      }
    });
  }, [addFlash, addPopup, boardWidth, cellSize]);

  const blocked = useMemo(() => {
    if (!run || run.status !== 'playing') return false;
    if (trayHasPlacement(run.board, run.tray, run.wildcardArmed)) return false;
    return !isStuck(run);
  }, [run]);

  const preview: PreviewInfo | null = useMemo(() => {
    if (!run || targeting) return null;
    if (dragAnchor && drag) {
      return previewPlacement(run, drag.index, dragAnchor.r, dragAnchor.c);
    }
    if (selected !== null && pending) {
      return previewPlacement(run, selected, pending.r, pending.c);
    }
    if (selected !== null && hover) {
      const piece = run.tray[selected];
      if (!piece) return null;
      const anchor = anchorFromCell(piece, hover);
      return previewPlacement(run, selected, anchor.r, anchor.c);
    }
    return null;
  }, [drag, dragAnchor, hover, pending, run, selected, targeting]);

  const deny = () => {
    sfx.play('deny');
    setDenyTick((tick) => tick + 1);
  };

  const tryPlace = (index: number, anchor: Coord) => {
    if (!run) return;
    const piece = run.tray[index];
    if (!piece) {
      deny();
      return;
    }
    // Mesma validação do preview: nada de caminho paralelo para confirmar.
    if (!previewPlacement(run, index, anchor.r, anchor.c).valid) {
      deny();
      return;
    }
    api.place(index, anchor.r, anchor.c);
    setSelected(null);
    setPending(null);
    setHover(null);
    setDragAnchor(null);
  };

  /** Escreve a posição visual do ghost direto no DOM (coalescido por rAF). */
  const scheduleGhostWrite = useCallback(() => {
    if (dragRaf.current) return;
    dragRaf.current = requestAnimationFrame(() => {
      dragRaf.current = 0;
      const pos = ghostPos.current;
      const el = ghostRef.current;
      if (!pos || !el) return;
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    });
  }, []);

  const beginPiecePointer = (index: number, event: ReactPointerEvent<HTMLElement>) => {
    if (!run || run.status !== 'playing' || api.paused) return;
    const piece = run.tray[index];
    if (!piece || targeting) return;
    event.preventDefault();
    sfx.unlock();

    const card = event.currentTarget;
    const shapeEl = card.querySelector('.piece-shape') as HTMLElement | null;
    const rect = (shapeEl ?? card).getBoundingClientRect();
    const fx =
      rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0.5;
    const fy =
      rect.height > 0 ? Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) : 0.5;

    const boardRect = boardRef.current?.getBoundingClientRect();
    const cell = boardRect && boardRect.width > 0 ? boardRect.width / 9 : cellSize;
    const { h, w } = shapeBounds(piece.cells);

    // Offset de pega estável: a peça mantém a mesma distância do dedo/cursor.
    const grabX = fx * w * cell;
    const grabY = fy * h * cell;
    const lift = event.pointerType === 'touch' ? cell * 1.1 : 0;
    const originX = event.clientX - grabX;
    const originY = event.clientY - grabY - lift;

    dragSession.current = {
      index,
      pointerId: event.pointerId,
      grabX,
      grabY,
      lift,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      inside: false,
      over: false,
    };
    ghostPos.current = { x: originX, y: originY };
    dragAnchorRef.current = null;
    try {
      card.setPointerCapture(event.pointerId);
    } catch {
      /* alguns browsers antigos não suportam capture em botões */
    }
    setSelected(null);
    setPending(null);
    setHover(null);
    setDragAnchor(null);
    setDrag({ index, originX, originY, over: false, invalid: false });
  };

  const movePiecePointer = (index: number, event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current;
    if (!session || session.index !== index || event.pointerId !== session.pointerId) return;
    if (event.cancelable) event.preventDefault();

    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.moved && Math.hypot(dx, dy) > 6) session.moved = true;
    session.lastX = event.clientX;
    session.lastY = event.clientY;

    // Posição visual livre, escrita no DOM via rAF (sem estado React por pixel).
    const x = event.clientX - session.grabX;
    const y = event.clientY - session.grabY - session.lift;
    ghostPos.current = { x, y };
    scheduleGhostWrite();

    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect || boardRect.width <= 0 || !run) return;
    const cell = boardRect.width / 9;
    const inside =
      event.clientX >= boardRect.left - cell * 0.75 &&
      event.clientX <= boardRect.right + cell * 0.75 &&
      event.clientY >= boardRect.top - cell * 0.75 &&
      event.clientY <= boardRect.bottom + cell * 0.75;
    session.inside = inside;

    if (!inside) {
      if (dragAnchorRef.current) {
        dragAnchorRef.current = null;
        setDragAnchor(null);
      }
      setDrag((prev) =>
        prev && (prev.over || prev.invalid) ? { ...prev, over: false, invalid: false } : prev,
      );
      return;
    }

    const piece = run.tray[index];
    if (!piece) return;
    const drop = resolveDrop(
      run.board,
      piece,
      { row: (y - boardRect.top) / cell, col: (x - boardRect.left) / cell },
      { allowHazard: run.wildcardArmed },
    );
    const current = dragAnchorRef.current;
    if (!current || current.r !== drop.anchor.r || current.c !== drop.anchor.c) {
      dragAnchorRef.current = drop.anchor;
      setDragAnchor(drop.anchor);
    }
    setDrag((prev) => {
      if (!prev) return prev;
      const over = true;
      const invalid = !drop.valid;
      if (prev.over === over && prev.invalid === invalid) return prev;
      return { ...prev, over, invalid };
    });
  };

  const endPiecePointer = (index: number, event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current;
    if (!session || session.index !== index || event.pointerId !== session.pointerId) return;
    dragSession.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* capture já liberado */
    }

    const wasMoved = session.moved;
    let anchor: Coord | null = null;
    let valid = false;
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (run && boardRect && boardRect.width > 0 && session.inside) {
      const piece = run.tray[index];
      const cell = boardRect.width / 9;
      const gx = session.lastX - session.grabX;
      const gy = session.lastY - session.grabY - session.lift;
      if (piece) {
        const drop = resolveDrop(
          run.board,
          piece,
          { row: (gy - boardRect.top) / cell, col: (gx - boardRect.left) / cell },
          { allowHazard: run.wildcardArmed },
        );
        anchor = drop.anchor;
        valid = drop.valid;
      }
    }

    dragAnchorRef.current = null;
    ghostPos.current = null;
    setDrag(null);
    setDragAnchor(null);

    if (!wasMoved) {
      setSelected((prev) => (prev === index ? null : index));
      setPending(null);
      setHover(null);
      sfx.play('click');
      return;
    }
    if (anchor && valid) {
      tryPlace(index, anchor);
      return;
    }
    if (session.inside) deny();
  };

  const cancelPiecePointer = () => {
    dragSession.current = null;
    dragAnchorRef.current = null;
    ghostPos.current = null;
    setDrag(null);
    setDragAnchor(null);
  };

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!run || run.status !== 'playing' || api.paused) return;
    const info = cellFromEvent(boardRef.current, event.clientX, event.clientY);
    if (targeting) {
      if (info) {
        api.power(targeting, { r: info.r, c: info.c });
        setTargeting(null);
      }
      return;
    }
    if (event.pointerType === 'mouse') setHover(info ? { r: info.r, c: info.c } : null);
    if (selected === null || !info) return;
    const piece = run.tray[selected];
    if (!piece) {
      setSelected(null);
      return;
    }
    if (event.pointerType !== 'mouse') event.preventDefault();
    const anchor = anchorFromCell(piece, info);
    if (pending && pending.r === anchor.r && pending.c === anchor.c) {
      tryPlace(selected, anchor);
      return;
    }
    setPending(anchor);
    setCursor({ r: info.r, c: info.c });
    sfx.play('click');
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (targeting || api.paused) return;
    if (event.pointerType !== 'mouse') return;
    const info = cellFromEvent(boardRef.current, event.clientX, event.clientY);
    setHover(info ? { r: info.r, c: info.c } : null);
  };

  const confirmPending = () => {
    if (selected === null || !pending) return;
    tryPlace(selected, pending);
  };

  const handlePower = (id: PowerId) => {
    if (!run || run.status !== 'playing' || api.paused) return;
    const def = POWER_MAP[id];
    if (!def) return;
    if ((run.stage.charges[id] ?? 0) <= 0) {
      deny();
      return;
    }
    if (def.target === 'none') {
      api.power(id);
      setTargeting(null);
      setSelected(null);
      setPending(null);
      return;
    }
    setTargeting((prev) => (prev === id ? null : id));
    setSelected(null);
    setPending(null);
    setHover(null);
    sfx.play('click');
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!run || run.status !== 'playing') return;
      if (api.paused || api.settingsOpen) return;
      const key = event.key;
      if (key === 'Escape') {
        if (targeting) setTargeting(null);
        else if (selected !== null) {
          setSelected(null);
          setPending(null);
        } else api.setPaused(true);
        return;
      }
      if (key === '1' || key === '2' || key === '3') {
        const index = Number(key) - 1;
        if (run.tray[index]) {
          setSelected((prev) => (prev === index ? null : index));
          setPending(null);
          sfx.play('click');
        }
        return;
      }
      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        event.preventDefault();
        setCursor((prev) => {
          if (key === 'ArrowUp') return { r: Math.max(0, prev.r - 1), c: prev.c };
          if (key === 'ArrowDown') return { r: Math.min(8, prev.r + 1), c: prev.c };
          if (key === 'ArrowLeft') return { r: prev.r, c: Math.max(0, prev.c - 1) };
          return { r: prev.r, c: Math.min(8, prev.c + 1) };
        });
        return;
      }
      if (key === 'Enter' && selected !== null) {
        event.preventDefault();
        const piece = run.tray[selected];
        if (!piece) return;
        tryPlace(selected, anchorFromCell(piece, cursor));
        return;
      }
      if (key.toLowerCase() === 'r') api.recall();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, cursor, run, selected, targeting]);

  useEffect(() => {
    if (denyTick === 0) return;
    const element = boardRef.current;
    if (!element) return;
    element.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 180, easing: 'ease-out' },
    );
  }, [denyTick]);

  if (!run) return null;

  const stage = run.stage;
  const boss = stage.boss;
  const powers = usablePowers(run);
  const multiplier = mods ? Math.min(1 + mods.comboStep * run.combo, mods.comboCap) : 1;
  const draggingPiece = drag ? run.tray[drag.index] : null;
  const selectedPiece = selected !== null ? run.tray[selected] : null;

  return (
    <div
      className="run-screen screen"
      onContextMenu={(event) => event.preventDefault()}
    >
      <header className="hud">
        <div className="hud__left">
          <button type="button" className="icon-btn" aria-label="Pausar" onClick={() => api.setPaused(true)}>
            <Icon name="pause" size={20} />
          </button>
          <div className="hud__stage">
            <span className="hud__stage-label">
              ESTÁGIO {stage.number}
              <em>/8</em>
            </span>
            <span className="hud__stage-name">{stageTitle(stage.index)}</span>
          </div>
        </div>

        <div className="hud__score">
          <span className="hud__score-label">PONTOS</span>
          <span className="hud__score-line">
            <AnimatedNumber value={run.score} className="hud__score-value" />
            <AnimatePresence initial={false}>
              {run.combo > 1 && (
                <motion.em
                  key={run.combo}
                  className="hud__combo"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  title={`Combo ${run.combo}`}
                >
                  ×{multiplier.toFixed(2)}
                </motion.em>
              )}
            </AnimatePresence>
          </span>
        </div>

        <div className="hud__right">
          <span className="chip chip--gold hud__crystals">
            <Icon name="crystal" size={14} />
            {api.meta.crystals}
          </span>
          <button type="button" className="icon-btn" aria-label="Configurações" onClick={api.openSettings}>
            <Icon name="gear" size={19} />
          </button>
        </div>
      </header>

      {boss && (
        <div className="run__boss">
          <BossBar boss={boss} />
        </div>
      )}

      <div className="run__body">
        <div className="area-relics">
          <RelicRail relics={run.relics} />
        </div>

        <div className="area-objectives">
          <EnergyBar
            energy={run.energy}
            crystals={run.crystals}
            fragments={run.fragments}
            disabled={run.status !== 'playing'}
            onOpenReward={() => setPanel('energy')}
          />
          {run.pendingEvent && (
            <button
              type="button"
              className="event-chip"
              onClick={() => {
                setPanel('event');
                sfx.play('click');
              }}
            >
              <span className="event-chip__icon">
                <Icon name={EVENT_ICON[run.pendingEvent.kind] ?? 'chest'} size={16} />
              </span>
              <span className="event-chip__body">
                <strong>{run.pendingEvent.title}</strong>
                <em>{run.pendingEvent.desc}</em>
              </span>
              <span className="event-chip__cta">Abrir</span>
            </button>
          )}
          <ObjectivePanel
            objectives={stage.objectives}
            modifier={stage.modifier}
            movesLeft={stage.movesLeft}
            movesTotal={stage.movesTotal}
          />
        </div>

        <div className="area-board">
          <div className="board-slot" ref={slotRef}>
            <div className="board-frame" style={{ width: boardWidth, height: boardWidth }}>
              <Board
                board={run.board}
                preview={preview}
                cursor={selected !== null ? cursor : null}
                flashes={flashes}
                popups={popups}
                targeting={targeting !== null}
                disabled={run.status !== 'playing'}
                boardRef={boardRef}
                canvasRef={canvasRef}
                onPointerDown={onBoardPointerDown}
                onPointerMove={onBoardPointerMove}
                onPointerLeave={() => setHover(null)}
                bossAccent={boss ? BOSS_ACCENT[boss.id] : null}
              />
            </div>

            <AnimatePresence>
              {preview?.valid && preview.score && (dragAnchor || pending || (selected !== null && hover)) && (
                <motion.div
                  key="predict"
                  className={`board-predict ${preview.lines >= 3 ? 'is-heavy' : preview.lines >= 2 ? 'is-combo' : ''}`}
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                >
                  <span className="board-predict__score">
                    +{preview.score.total.toLocaleString('pt-BR')}
                  </span>
                  {preview.label && <span className="board-predict__label">{preview.label}</span>}
                  {preview.energy > 0 && (
                    <span className="board-predict__energy">
                      <Icon name="bolt" size={12} /> +{preview.energy}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {targeting && (
                <motion.div
                  className="board-hint board-hint--target"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Icon name="target" size={15} />
                  {POWER_MAP[targeting].name}: toque em um alvo
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => setTargeting(null)}>
                    Cancelar
                  </button>
                </motion.div>
              )}
              {blocked && !targeting && (
                <motion.div
                  className="board-hint board-hint--alert"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Icon name="bolt" size={15} />
                  Sem encaixes! Use um poder ou reorganize.
                </motion.div>
              )}
              {mods?.glassLens && !targeting && preview?.valid && preview.lines > 0 && preview.score && (
                <motion.div
                  className="board-hint board-hint--lens"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Icon name="eye" size={14} />
                  Base {preview.score.place} · Linhas {preview.score.line} · ×
                  {preview.score.comboMult.toFixed(2)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="area-powers">
          <PowerBar
            powers={powers}
            armed={run.wildcardArmed}
            targeting={targeting}
            recallAvailable={Boolean(mods?.canRecall)}
            recallUsed={run.recallUsed}
            disabled={run.status !== 'playing'}
            onUse={handlePower}
            onRecall={() => api.recall()}
          />
        </div>

        <div className="area-tray" style={{ maxWidth: boardWidth }}>
          <div className="tray-hint-slot">
            <AnimatePresence>
              {selectedPiece && (
                <motion.div
                  className="tray-hint"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                >
                <span className="tray-hint__text">
                  {pending ? 'Toque de novo para confirmar' : 'Toque no tabuleiro para posicionar'}
                </span>
                {pending && (
                  <button type="button" className="btn btn--primary btn--sm" onClick={confirmPending}>
                    <Icon name="check" size={15} /> Colocar
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setSelected(null);
                    setPending(null);
                    setHover(null);
                  }}
                >
                  Cancelar
                </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <PieceTray
            tray={run.tray}
            selected={selected}
            draggingIndex={drag?.index ?? null}
            disabled={run.status !== 'playing'}
            onPointerDown={beginPiecePointer}
            onPointerMove={movePiecePointer}
            onPointerUp={endPiecePointer}
            onPointerCancel={cancelPiecePointer}
            onKeySelect={(index) => setSelected((prev) => (prev === index ? null : index))}
          />
        </div>
      </div>

      {drag && draggingPiece && (
        <DragGhost
          piece={draggingPiece}
          x={drag.originX}
          y={drag.originY}
          cellSize={cellSize}
          over={drag.over}
          invalid={drag.invalid}
          ghostRef={ghostRef}
        />
      )}

      <AnimatePresence>
        {panel === 'energy' && run.energy.offer && (
          <ProgressionPanel
            key="energy-panel"
            title="Recompensa de Energia"
            subtitle={
              run.energy.pending > 1
                ? `Você ainda tem ${run.energy.pending} recompensas para escolher.`
                : 'A barra encheu: escolha uma habilidade ou recurso.'
            }
            options={run.energy.offer}
            crystals={run.crystals}
            fragments={run.fragments}
            dismissable={false}
            onPick={(id) => {
              api.claimEnergy(id);
              setPanel(null);
            }}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'event' && run.pendingEvent && (
          <ProgressionPanel
            key="event-panel"
            title={run.pendingEvent.title}
            subtitle={run.pendingEvent.desc}
            options={run.pendingEvent.options}
            crystals={run.crystals}
            fragments={run.fragments}
            dismissable
            onPick={(id) => {
              api.resolveEvent(id);
              setPanel(null);
            }}
            onClose={() => {
              api.resolveEvent(null);
              setPanel(null);
            }}
          />
        )}
      </AnimatePresence>

      <div className="sr-only" aria-live="polite">
        {run.score} pontos. Estágio {stage.number}. {stage.movesLeft} jogadas restantes.
      </div>
    </div>
  );
}

const BOSS_ACCENT: Record<string, string> = {
  ice_king: 'ice',
  corruption_king: 'corrupt',
  gravity_king: 'gravity',
  explosive_king: 'boom',
};

