import type { GameEvent } from '../engine/types';

export type FxHandler = (events: GameEvent[]) => void;

const handlers = new Set<FxHandler>();

export function subscribeFx(handler: FxHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function emitFx(events: GameEvent[]): void {
  if (events.length === 0) return;
  for (const handler of handlers) handler(events);
}
