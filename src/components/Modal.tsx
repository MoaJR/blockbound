import { m as motion } from 'framer-motion';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../ui/icons';
import { sfx } from '../audio/sfx';

export interface ModalProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, subtitle, onClose, children, footer, wide = false }: ModalProps) {
  useEffect(() => {
    sfx.play('uiOpen');
    return () => sfx.play('uiClose');
  }, []);

  return (
    <motion.div
      className="modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        className={`modal ${wide ? 'modal--wide' : ''}`}
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <header className="modal__head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
              <Icon name="close" size={20} />
            </button>
          )}
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </motion.div>
    </motion.div>
  );
}
