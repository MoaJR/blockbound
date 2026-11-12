import { useState } from 'react';
import type { GameApi } from '../hooks/useGame';
import { Modal } from '../components/Modal';
import { Icon } from '../ui/icons';

export interface SettingsModalProps {
  api: GameApi;
}

interface ToggleProps {
  label: string;
  desc: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, desc, value, onChange }: ToggleProps) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        <strong>{label}</strong>
        <em>{desc}</em>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span className={`toggle__track ${value ? 'is-on' : ''}`} aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}

export function SettingsModal({ api }: SettingsModalProps) {
  const settings = api.meta.settings;
  const [confirm, setConfirm] = useState(false);

  return (
    <Modal
      title="Configurações"
      onClose={api.closeSettings}
      footer={
        <button type="button" className="btn btn--primary btn--sm" onClick={api.closeSettings}>
          Fechar
        </button>
      }
    >
      <div className="setting">
        <div className="setting__head">
          <span>
            <Icon name={settings.muted ? 'mute' : 'sound'} size={16} /> Volume
          </span>
          <em>{Math.round(settings.volume * 100)}%</em>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(settings.volume * 100)}
          onChange={(event) => api.patchSettings({ volume: Number(event.target.value) / 100 })}
          aria-label="Volume dos efeitos"
        />
      </div>

      <Toggle
        label="Efeitos sonoros"
        desc="Sons sintetizados para cada ação"
        value={!settings.muted}
        onChange={(value) => api.patchSettings({ muted: !value })}
      />
      <Toggle
        label="Vibração"
        desc="Feedback tátil em dispositivos compatíveis"
        value={settings.haptics}
        onChange={(value) => api.patchSettings({ haptics: value })}
      />
      <Toggle
        label="Movimento reduzido"
        desc="Desativa partículas e animações intensas"
        value={settings.reducedMotion}
        onChange={(value) => api.patchSettings({ reducedMotion: value })}
      />

      <div className="settings__danger">
        {!confirm ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(true)}>
            <Icon name="refresh" size={14} /> Zerar progresso
          </button>
        ) : (
          <div className="settings__confirm">
            <span>Apagar todo o progresso?</span>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => {
                api.resetProgress();
                setConfirm(false);
              }}
            >
              Apagar
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
