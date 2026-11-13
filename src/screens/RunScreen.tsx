import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, m as motion } from 'framer-motion';
import type { Board as BoardModel, BossState, Coord, GameEvent, PowerId, SynergyTag } from '../engine/types';
import { shapeBounds, trayHasPlacement } from '../engine/pieces';
import { getMods, isStuck, usablePowers } from '../engine/run';
import { previewPlacement } from '../engine/preview';
import type { PreviewInfo } from '../engine/preview';
import { anchorFromCell, resolveDrop } from '../engine/placement';
import {
  cellProjection,
  dragGrabOffsets,
  ghostBox,
  ghostOrigin,
  rectsOverlap,
} from '../interaction/drag';
import { MODIFIER_MAP, stageTitle } from '../engine/stages';
import { POWER_MAP } from '../engine/powers';
import type { GameApi } from '../hooks/useGame';
import { Board } from '../components/Board';
import type { BoardFlash, BoardPlacement, BoardPopup, BoardPowerFx } from '../components/Board';
import { PieceTray } from '../components/PieceTray';
import { DragGhost } from '../components/DragGhost';
import { ObjectivePanel } from '../components/ObjectivePanel';
import { BossBar } from '../components/BossBar';
import { RelicRail } from '../components/RelicRail';
import { PowerBar } from '../components/PowerBar';
import { EnergyBar } from '../components/EnergyBar';
import { ProgressionPanel } from '../components/ProgressionPanel';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { BossIntro, ComboBanner, StageBanner } from '../components/GameEffects';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';
import { ParticleField } from '../fx/particles';
import { subscribeFx } from '../fx/fxBus';
import {
  clearParticleCount,
  clearTier,
  centroid,
  POWER_COLOR,
  rowsAndCols,
  shakeMagnitude,
} from '../fx/director';
import { dprCap, maxParticles, particleScale, reportFrame } from '../fx/quality';
import { useQualityLevel } from '../fx/useQuality';
import { sfx } from '../audio/sfx';

const CELL_COLORS = ['#25c8ec', '#8a5bff', '#ffc857', '#4ade80', '#ff5f9e', '#4a90ff'];

/** Moldura decorativa por fora da matriz (espelha `--board-skin` em board.css). */
const BOARD_SKIN = 6;

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
  /** Célula real do tabuleiro no início do arraste (ghost com blocos idênticos). */
  cell: number;
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
  moved: boolean;
  inside: boolean;
  over: boolean;
}

type ActivePanel = 'energy' | 'event' | null;

let popupSeq = 0;
let flashSeq = 0;
let effectSeq = 0;

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
  const [placements, setPlacements] = useState<BoardPlacement[]>([]);
  const [powerFx, setPowerFx] = useState<BoardPowerFx[]>([]);
  const [comboFx, setComboFx] = useState<{ id: number; level: number; multiplier: number } | null>(null);
  const [relicPulse, setRelicPulse] = useState<{ key: number; tags: SynergyTag[] } | null>(null);
  const [stageBanner, setStageBanner] = useState<{ id: number; number: number; title: string } | null>(null);
  const [bossIntro, setBossIntro] = useState<{ id: number; boss: BossState } | null>(null);
  const [bossHitTick, setBossHitTick] = useState(0);
  const [shuffleTick, setShuffleTick] = useState(0);
  const [denyTick, setDenyTick] = useState(0);
  const [panel, setPanel] = useState<ActivePanel>(null);
  const quality = useQualityLevel();

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
  const boardSnapshot = useRef<BoardModel | null>(null);
  const lastPlaceColor = useRef(0);
  const stageKeyRef = useRef(-1);
  const bossKeyRef = useRef<string | null>(null);

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
      // A moldura (`--board-skin`) cresce para fora: reservar o espaço dela aqui
      // garante que o conjunto nunca encoste nas bordas da tela.
      const size = Math.max(
        200,
        Math.min(rect.width - BOARD_SKIN * 2, rect.height - BOARD_SKIN * 2, 640),
      );
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
    boardSnapshot.current = run?.board ?? null;
  }, [run?.board]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.setReduced(reducedMotion);
    field.setQuality(particleScale(), maxParticles());
    field.setSize(boardWidth, boardWidth, Math.min(dprCap(), window.devicePixelRatio || 1));
  }, [boardWidth, reducedMotion, quality]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (!document.hidden) reportFrame(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    let timer = 0;
    timer = window.setTimeout(() => {
      const index = timersRef.current.indexOf(timer);
      if (index >= 0) timersRef.current.splice(index, 1);
      callback();
    }, delay);
    timersRef.current.push(timer);
    return timer;
  }, []);

  const addPopup = useCallback(
    (r: number, c: number, text: string, tone: BoardPopup['tone']) => {
      popupSeq += 1;
      const id = popupSeq;
      setPopups((prev) => [...prev.slice(-5), { id, r, c, text, tone }]);
      schedule(() => setPopups((prev) => prev.filter((popup) => popup.id !== id)), 900);
    },
    [schedule],
  );

  const addFlash = useCallback(
    (
      rows: number[],
      cols: number[],
      cells: Coord[],
      lines: number,
      cross: boolean,
      tone: BoardFlash['tone'],
    ) => {
      flashSeq += 1;
      const id = flashSeq;
      setFlashes((prev) => [...prev.slice(-3), { id, rows, cols, cells, lines, cross, tone }]);
      schedule(() => setFlashes((prev) => prev.filter((flash) => flash.id !== id)), 620);
    },
    [schedule],
  );

  const addPlacements = useCallback(
    (cells: Coord[], color: number) => {
      effectSeq += 1;
      const id = effectSeq;
      const entries = cells.map((cell, index) => ({
        id,
        r: cell.r,
        c: cell.c,
        color,
        delay: Math.min(150, index * 16),
      }));
      setPlacements((prev) => [...prev.slice(-36), ...entries]);
      schedule(() => setPlacements((prev) => prev.filter((entry) => entry.id !== id)), 420);
    },
    [schedule],
  );

  const addPowerFx = useCallback(
    (power: PowerId, cells: Coord[]) => {
      effectSeq += 1;
      const id = effectSeq;
      const center = centroid(cells);
      const { rows, cols } = rowsAndCols(cells);
      setPowerFx((prev) => [
        ...prev.slice(-2),
        {
          id,
          power,
          r: Math.round(center.r),
          c: Math.round(center.c),
          cells,
          rows,
          cols,
        },
      ]);
      schedule(() => setPowerFx((prev) => prev.filter((entry) => entry.id !== id)), 620);
    },
    [schedule],
  );

  const addComboFx = useCallback(
    (level: number, multiplier: number) => {
      effectSeq += 1;
      const id = effectSeq;
      setComboFx({ id, level, multiplier });
      schedule(() => setComboFx((current) => (current?.id === id ? null : current)), 1050);
    },
    [schedule],
  );

  const pulseRelics = useCallback(
    (tags: SynergyTag[]) => {
      effectSeq += 1;
      const key = effectSeq;
      setRelicPulse({ key, tags });
      schedule(() => setRelicPulse((current) => (current?.key === key ? null : current)), 720);
    },
    [schedule],
  );

  const shakeBoard = useCallback(
    (tier: number) => {
      if (reducedMotion) return;
      const element = boardRef.current;
      if (!element) return;
      const magnitude = shakeMagnitude(tier as 1 | 2 | 3 | 4) * (quality === 'low' ? 0.65 : 1);
      element.animate(
        [
          { transform: 'translate3d(0,0,0)' },
          { transform: `translate3d(${-magnitude}px, ${magnitude * 0.45}px, 0)` },
          { transform: `translate3d(${magnitude * 0.7}px, ${-magnitude * 0.4}px, 0)` },
          { transform: 'translate3d(0,0,0)' },
        ],
        { duration: 150 + tier * 40, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      );
    },
    [quality, reducedMotion],
  );

  useEffect(() => {
    return subscribeFx((events: GameEvent[]) => {
      const field = fieldRef.current;
      if (!field) return;

      const colorFor = (cell: Coord): string => {
        const snapshot = boardSnapshot.current?.cells[cell.r]?.[cell.c];
        if (snapshot?.kind === 'block') return CELL_COLORS[snapshot.color] ?? '#9be8ff';
        if (snapshot?.kind === 'frozen') return '#9fe8ff';
        if (snapshot?.kind === 'corrupt') return '#b06bff';
        if (snapshot?.kind === 'bomb') return '#ff8a3d';
        return CELL_COLORS[lastPlaceColor.current] ?? '#9be8ff';
      };

      for (const event of events) {
        if (event.type === 'place') {
          lastPlaceColor.current = event.color;
          addPlacements(event.cells, event.color);
          const color = CELL_COLORS[event.color] ?? '#9be8ff';
          for (const cell of event.cells) {
            field.burst({
              x: (cell.c + 0.5) * cellSize,
              y: (cell.r + 0.5) * cellSize,
              color,
              count: 2,
              power: 0.55,
              speed: 1.6,
              size: 3,
              life: 22,
            });
          }
        }

        if (event.type === 'clear') {
          const cross = event.rows.length > 0 && event.cols.length > 0;
          const tier = clearTier(event.lines, cross);
          addFlash(
            event.rows,
            event.cols,
            event.cells,
            event.lines,
            cross,
            cross || event.lines >= 2 ? 'gold' : 'cyan',
          );
          shakeBoard(tier);

          const step = event.cells.length > 44 ? 2 : 1;
          const count = clearParticleCount(tier);
          for (let index = 0; index < event.cells.length; index += step) {
            const cell = event.cells[index];
            if (!cell) continue;
            field.burst({
              x: (cell.c + 0.5) * cellSize,
              y: (cell.r + 0.5) * cellSize,
              color: colorFor(cell),
              count,
              power: tier >= 3 ? 1.8 : 1.1,
              size: tier >= 3 ? 5 : 4,
              shape: tier >= 3 ? 'shard' : 'block',
              life: 34 + tier * 8,
            });
          }

          if (event.lines >= 2) {
            field.ring({
              x: boardWidth / 2,
              y: boardWidth / 2,
              color: tier >= 3 ? '#ffd76a' : '#7ff0ff',
              radius: boardWidth * (tier >= 3 ? 0.62 : 0.4),
              width: tier >= 3 ? 4 : 2.5,
              life: 26,
            });
          }
          if (tier >= 3) {
            field.confetti({
              x: boardWidth / 2,
              y: boardWidth * 0.5,
              count: tier >= 4 ? 26 : 16,
              colors: ['#7ff0ff', '#ffd76a', '#d6bcff', '#ff8fb8', '#8dffb8'],
              power: 1.1,
            });
          }

          const anchor = event.cells[Math.floor(event.cells.length / 2)];
          if (anchor) addPopup(anchor.r, anchor.c, `+${event.points}`, event.lines >= 2 ? 'gold' : 'cyan');
          pulseRelics(['lines', 'combo', 'prism']);
        }

        if (event.type === 'combo' && event.level >= 2) {
          addComboFx(event.level, event.multiplier);
          pulseRelics(['combo']);
          if (event.level >= 3) {
            field.confetti({
              x: boardWidth / 2,
              y: boardWidth * 0.45,
              count: event.level >= 10 ? 36 : event.level >= 5 ? 26 : 16,
              colors: ['#7ff0ff', '#ffd76a', '#d6bcff', '#ff8fb8'],
              power: event.level >= 10 ? 1.5 : 1.1,
            });
          }
          if (event.level >= 5) {
            field.ring({
              x: boardWidth / 2,
              y: boardWidth / 2,
              color: event.level >= 10 ? '#ffe08a' : '#c9a6ff',
              radius: boardWidth * (event.level >= 10 ? 0.72 : 0.58),
              width: 4,
              life: 32,
            });
          }
        }

        if (event.type === 'power') {
          if (event.power === 'shuffle') setShuffleTick((tick) => tick + 1);
          const color = POWER_COLOR[event.power] ?? '#c9a6ff';
          if (event.cells.length > 0) {
            addPowerFx(event.power, event.cells);
            const step = event.cells.length > 30 ? 2 : 1;
            for (let index = 0; index < event.cells.length; index += step) {
              const cell = event.cells[index];
              if (!cell) continue;
              field.burst({
                x: (cell.c + 0.5) * cellSize,
                y: (cell.r + 0.5) * cellSize,
                color: index % 3 === 0 ? '#ffffff' : color,
                count: event.power === 'bomb' ? 6 : 4,
                power: event.power === 'bomb' ? 2 : 1.2,
                shape: event.power === 'bomb' || event.power === 'hammer' ? 'shard' : 'spark',
                size: event.power === 'bomb' ? 6 : 4,
              });
            }
            const center = centroid(event.cells);
            field.ring({
              x: (center.c + 0.5) * cellSize,
              y: (center.r + 0.5) * cellSize,
              color,
              radius: cellSize * (event.power === 'bomb' ? 4.2 : 2.6),
              width: 3,
              life: 30,
            });
            if (event.power === 'bomb' || event.power === 'hammer' || event.power === 'drill') {
              shakeBoard(2);
            }
          }
          pulseRelics(['power']);
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
              shape: 'glow',
            });
          }
        }

        if (event.type === 'shift' && event.cells.length > 0) {
          const center = centroid(event.cells);
          field.burst({
            x: (center.c + 0.5) * cellSize,
            y: (center.r + 0.5) * cellSize,
            color: '#a9d4ff',
            count: 10,
            power: 0.8,
            gravity: 0.38,
            speed: 1.2,
            shape: 'spark',
          });
        }

        if (event.type === 'thaw' && event.cells.length > 0) {
          for (const cell of event.cells) {
            field.burst({
              x: (cell.c + 0.5) * cellSize,
              y: (cell.r + 0.5) * cellSize,
              color: '#c9f6ff',
              count: 4,
              power: 0.9,
              shape: 'spark',
            });
          }
        }

        if (event.type === 'rescue') {
          field.burst({
            x: boardWidth / 2,
            y: boardWidth / 2,
            color: '#ffd98a',
            count: 30,
            power: 2.2,
            shape: 'spark',
          });
          field.ring({
            x: boardWidth / 2,
            y: boardWidth / 2,
            color: '#ffd98a',
            radius: boardWidth * 0.62,
            width: 3,
            life: 30,
          });
        }

        if (event.type === 'boss' && event.damage > 0) {
          setBossHitTick((tick) => tick + 1);
          addPopup(1, 4, `-${event.damage}`, 'violet');
          field.burst({
            x: boardWidth / 2,
            y: cellSize * 1.4,
            color: '#c9a6ff',
            count: 12,
            power: 1.4,
            shape: 'spark',
          });
        }

        if (event.type === 'relic') {
          pulseRelics(['combo', 'lines', 'prism', 'power', 'economy', 'precision']);
        }

        if (event.type === 'rewardClaimed') {
          if (event.power || event.level) pulseRelics(['power']);
          else pulseRelics(['economy', 'precision']);
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
  }, [
    addComboFx,
    addFlash,
    addPlacements,
    addPopup,
    addPowerFx,
    boardWidth,
    cellSize,
    pulseRelics,
    shakeBoard,
  ]);

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

  useEffect(() => {
    if (!run) return;
    const key = run.stage.index;
    if (stageKeyRef.current === key) return;
    stageKeyRef.current = key;
    effectSeq += 1;
    const id = effectSeq;
    setStageBanner({ id, number: run.stage.number, title: stageTitle(run.stage.index) });
    schedule(
      () => setStageBanner((current) => (current?.id === id ? null : current)),
      reducedMotion ? 850 : 1550,
    );
  }, [run, reducedMotion, schedule]);

  useEffect(() => {
    const boss = run?.stage.boss;
    if (!boss) {
      bossKeyRef.current = null;
      return;
    }
    if (bossKeyRef.current === boss.id) return;
    bossKeyRef.current = boss.id;
    effectSeq += 1;
    const id = effectSeq;
    setBossIntro({ id, boss });
    sfx.play('bossIntro');
    schedule(
      () => setBossIntro((current) => (current?.id === id ? null : current)),
      reducedMotion ? 900 : 1900,
    );
  }, [run?.stage.boss, reducedMotion, schedule]);

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
    sfx.play('pick');

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

    // Pega estável: no mouse mantém o ponto exato; no toque a base da peça fica
    // `lift` px acima do dedo (o dedo nunca esconde a peça nem as células).
    const offsets = dragGrabOffsets({
      pointerType: event.pointerType,
      fx,
      fy,
      width: w,
      height: h,
      cell,
      viewportHeight: window.innerHeight,
    });
    const origin = ghostOrigin(event.clientX, event.clientY, offsets);
    const originX = origin.x;
    const originY = origin.y;

    dragSession.current = {
      index,
      pointerId: event.pointerId,
      grabX: offsets.grabX,
      grabY: offsets.grabY,
      lift: offsets.lift,
      startX: event.clientX,
      startY: event.clientY,
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
    setDrag({ index, originX, originY, cell, over: false, invalid: false });
  };

  const movePiecePointer = (index: number, event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current;
    if (!session || session.index !== index || event.pointerId !== session.pointerId) return;
    if (event.cancelable) event.preventDefault();

    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.moved && Math.hypot(dx, dy) > 6) {
      session.moved = true;
      sfx.play('dragStart');
    }

    // Posição visual livre, escrita no DOM via rAF (sem estado React por pixel).
    const x = event.clientX - session.grabX;
    const y = event.clientY - session.grabY - session.lift;
    ghostPos.current = { x, y };
    scheduleGhostWrite();

    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect || boardRect.width <= 0 || !run) return;
    const cell = boardRect.width / 9;
    const piece = run.tray[index];
    if (!piece) return;
    const { h, w } = shapeBounds(piece.cells);
    // Onde a peça precisa estar para soltar: o hit-test é do FANTASMA, não do
    // dedo — com a peça elevada o dedo pode estar fora do tabuleiro.
    const inside = rectsOverlap(
      ghostBox({ x, y }, w, h, cell),
      boardRect,
      cell * 0.15,
    );
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

    const drop = resolveDrop(
      run.board,
      piece,
      cellProjection({ x, y }, boardRect, cell),
      { allowHazard: run.wildcardArmed },
    );
    const current = dragAnchorRef.current;
    if (!current || current.r !== drop.anchor.r || current.c !== drop.anchor.c) {
      dragAnchorRef.current = drop.anchor;
      setDragAnchor(drop.anchor);
      sfx.play('dragTick');
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
    if (run && boardRect && boardRect.width > 0) {
      const piece = run.tray[index];
      const cell = boardRect.width / 9;
      // Coordenadas do pointerup (mais precisas que o último move) projetadas
      // pelo MESMO caminho do preview — o drop cai onde o ghost indicava.
      const origin = ghostOrigin(event.clientX, event.clientY, {
        grabX: session.grabX,
        grabY: session.grabY,
        lift: session.lift,
      });
      if (piece) {
        const { h, w } = shapeBounds(piece.cells);
        const inside = rectsOverlap(ghostBox(origin, w, h, cell), boardRect, cell * 0.15);
        session.inside = inside;
        if (inside) {
          const drop = resolveDrop(
            run.board,
            piece,
            cellProjection(origin, boardRect, cell),
            { allowHazard: run.wildcardArmed },
          );
          anchor = drop.anchor;
          valid = drop.valid;
        }
      } else {
        session.inside = false;
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
      sfx.play('select');
      return;
    }
    if (anchor && valid) {
      sfx.play('drop');
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
    sfx.play('uiClose');
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
    sfx.play('select');
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
    sfx.play('powerSelect');
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
          sfx.play('select');
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
          <BossBar boss={boss} hitTick={bossHitTick} />
        </div>
      )}

      <div className="run__body">
        <div className="area-relics">
          <RelicRail relics={run.relics} pulse={relicPulse} />
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
                placements={placements}
                powerFx={powerFx}
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
                  {!pending && <span className="tray-hint__text">Toque no tabuleiro</span>}
                  {pending && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={confirmPending}
                    >
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
            shuffleKey={shuffleTick}
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
          cellSize={drag.cell}
          over={drag.over}
          invalid={drag.invalid}
          ghostRef={ghostRef}
        />
      )}

      <AnimatePresence>
        {stageBanner && !bossIntro && (
          <StageBanner
            key={`stage-${stageBanner.id}`}
            number={stageBanner.number}
            title={stageBanner.title}
            objectives={stage.objectives}
            modifier={stage.modifier ? MODIFIER_MAP[stage.modifier]?.name ?? null : null}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bossIntro && <BossIntro key={`boss-${bossIntro.id}`} boss={bossIntro.boss} />}
      </AnimatePresence>

      <AnimatePresence>
        {comboFx && (
          <ComboBanner
            key={`combo-${comboFx.id}`}
            level={comboFx.level}
            multiplier={comboFx.multiplier}
            reduced={reducedMotion}
          />
        )}
      </AnimatePresence>

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
        {run.score} pontos. Estágio {stage.number}.{' '}
        {stage.movesLeft >= 0
          ? `${stage.movesLeft} jogadas de par restantes.`
          : `Prorrogação: ${-stage.movesLeft} jogadas além do par.`}
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

