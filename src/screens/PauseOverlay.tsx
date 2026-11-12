import { useState } from 'react';
import type { GameApi } from '../hooks/useGame';
import { stageTitle } from '../engine/stages';
import { Modal } from '../components/Modal';
import { Icon } from '../ui/icons';

export interface PauseOverlayProps {
  api: GameApi;
}

export function PauseOverlay({ api }: PauseOverlayProps) {
  const run = api.run;
  const [confirm, setConfirm] = useState(false);
  if (!run) return null;
  const stage = run.stage;

  return (
    <Modal
      title="Pausa"
      subtitle={`Estágio ${stage.number} · ${stageTitle(stage.index)}`}
      onClose={() => api.setPaused(false)}
      footer={
        <>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => api.setPaused(false)}>
            <Icon name="play" size={15} /> Continuar
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={api.openSettings}>
            <Icon name="gear" size={15} /> Configurações
          </button>
          {!confirm ? (
            <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirm(true)}>
              Abandonar
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--danger btn--sm" onClick={api.abandon}>
                Confirmar abandono
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>
                Voltar
              </button>
            </>
          )}
        </>
      }
    >
      <div className="pause__stats">
        <div>
          <span>Pontuação</span>
          <strong>{run.score.toLocaleString('pt-BR')}</strong>
        </div>
        <div>
          <span>Jogadas</span>
          <strong>
            {stage.movesLeft}/{stage.movesTotal}
          </strong>
        </div>
        <div>
          <span>Combo</span>
          <strong>{run.combo}</strong>
        </div>
        <div>
          <span>Relíquias</span>
          <strong>{run.relics.length}</strong>
        </div>
      </div>

      <div className="pause__hints">
        <span className="rail-label">
          <Icon name="target" size={13} /> Atalhos
        </span>
        <ul>
          <li><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> selecionar peça</li>
          <li><kbd>setas</kbd> mover cursor · <kbd>Enter</kbd> posicionar</li>
          <li><kbd>Esc</kbd> cancelar / pausar · <kbd>R</kbd> devolver peça</li>
          <li>Arraste a peça ou toque nela e depois no tabuleiro</li>
        </ul>
      </div>
    </Modal>
  );
}
