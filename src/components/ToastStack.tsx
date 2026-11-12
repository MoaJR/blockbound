import { AnimatePresence, m as motion } from 'framer-motion';
import { Icon } from '../ui/icons';

export interface ToastItem {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'gold';
}

export interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
  placement?: 'raised' | 'top';
}

export function ToastStack({ toasts, onDismiss, placement = 'top' }: ToastStackProps) {
  return (
    <div className={`toast-stack toast-stack--${placement}`} aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            className={`toast toast--${toast.tone}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            onClick={() => onDismiss(toast.id)}
          >
            <Icon
              name={toast.tone === 'good' ? 'check' : toast.tone === 'bad' ? 'skull' : toast.tone === 'gold' ? 'star' : 'bolt'}
              size={15}
            />
            <span>{toast.text}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
