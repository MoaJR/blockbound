/**
 * Geometria do drag & drop de peças.
 *
 * Módulo puro (sem DOM/React) para que a ergonomia do toque e a projeção do
 * fantasma possam ser testadas isoladamente. A regra central:
 *
 *   origem do ghost = ponteiro - pega - lift
 *
 * `lift` só existe no toque: a peça fica acima do dedo para não esconder as
 * células onde ela será encaixada. O preview e a confirmação do drop usam
 * SEMPRE esta mesma origem, então o que o jogador vê é onde a peça cai.
 */

export interface Point {
  x: number;
  y: number;
}

export interface DragRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GhostBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Faixa aceitável do offset vertical no toque (px). */
export const TOUCH_LIFT_MIN = 60;
export const TOUCH_LIFT_MAX = 84;

/** Proporção da altura da viewport usada como offset (≈70px em 844px). */
const TOUCH_LIFT_RATIO = 0.082;
const TOUCH_LIFT_FALLBACK = 70;

/**
 * Offset vertical do arraste por toque, calibrado pela altura da viewport.
 * Telas curtas → 60px; telas altas → até 84px.
 */
export function touchDragLift(viewportHeight: number): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return TOUCH_LIFT_FALLBACK;
  const raw = viewportHeight * TOUCH_LIFT_RATIO;
  return Math.round(Math.min(TOUCH_LIFT_MAX, Math.max(TOUCH_LIFT_MIN, raw)));
}

export interface GrabParams {
  /** `pointerType` do PointerEvent. */
  pointerType: string;
  /** Posição relativa (0..1) do toque dentro do desenho da peça na bandeja. */
  fx: number;
  fy: number;
  /** Span da peça em células. */
  width: number;
  height: number;
  /** Tamanho da célula renderizada no tabuleiro (px). */
  cell: number;
  viewportHeight: number;
}

export interface GrabOffsets {
  grabX: number;
  grabY: number;
  lift: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/**
 * Offset entre o ponteiro e o canto superior esquerdo do ghost.
 * - mouse/caneta: a peça mantém o ponto exato onde foi pega (precisão).
 * - toque: a BASE da peça fica `lift` px acima do dedo (o dedo nunca cobre a
 *   peça nem as células de destino), mantendo a pega horizontal.
 */
export function dragGrabOffsets({
  pointerType,
  fx,
  fy,
  width,
  height,
  cell,
  viewportHeight,
}: GrabParams): GrabOffsets {
  const grabX = clamp01(fx) * width * cell;
  if (pointerType !== 'touch') {
    return { grabX, grabY: clamp01(fy) * height * cell, lift: 0 };
  }
  return { grabX, grabY: height * cell, lift: touchDragLift(viewportHeight) };
}

/** Canto superior esquerdo do ghost (px de viewport) para um ponteiro. */
export function ghostOrigin(
  pointerX: number,
  pointerY: number,
  offsets: GrabOffsets,
): Point {
  return {
    x: pointerX - offsets.grabX,
    y: pointerY - offsets.grabY - offsets.lift,
  };
}

/** Retângulo ocupado pelo ghost renderizado. */
export function ghostBox(origin: Point, width: number, height: number, cell: number): GhostBox {
  return { x: origin.x, y: origin.y, width: width * cell, height: height * cell };
}

/**
 * O ghost está sobre o tabuleiro? Usado no lugar da posição do dedo: com a
 * peça elevada o dedo pode estar fora do tabuleiro enquanto a peça já mira
 * uma célula.
 */
export function rectsOverlap(a: GhostBox, b: DragRect, slack = 0): boolean {
  return (
    a.x + a.width >= b.left - slack &&
    a.x <= b.left + b.width + slack &&
    a.y + a.height >= b.top - slack &&
    a.y <= b.top + b.height + slack
  );
}

/** Projeção fracionária do canto do ghost em coordenadas de célula. */
export function cellProjection(origin: Point, board: DragRect, cell: number): { row: number; col: number } {
  const safeCell = cell > 0 ? cell : 1;
  return {
    row: (origin.y - board.top) / safeCell,
    col: (origin.x - board.left) / safeCell,
  };
}
