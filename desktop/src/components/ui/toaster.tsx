import * as React from 'react';
import { cva } from 'class-variance-authority';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const toasterVariants = cva('', {
  variants: {
    variant: {
      default: '',
      success: 'text-income',
      error: 'text-destructive',
      warning: 'text-warning',
      info: 'text-primary',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Optional action button (e.g. "Undo"). */
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <Toaster>');
  return ctx;
}

const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-muted-foreground" />,
  success: <CheckCircle2 className="h-4 w-4 text-income" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
  info: <Info className="h-4 w-4 text-primary" />,
};

let toastCounter = 0;
const nextId = () => `toast-${Date.now()}-${toastCounter++}`;

export function Toaster({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = nextId();
      setItems((prev) => [...prev, { ...item, id }]);
      // Auto-dismiss after a few seconds unless it carries an action.
      if (!item.action) {
        window.setTimeout(() => dismiss(id), 4500);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider swipeDirection="right">
        {children}
        {items.map((item) => (
          <Toast key={item.id} variant={item.variant === 'error' ? 'destructive' : 'default'}>
            <div className="grid gap-1">
              <ToastTitle className={cn('flex items-center gap-2', toasterVariants({ variant: item.variant }))}>
                {VARIANT_ICONS[item.variant ?? 'default']}
                {item.title}
              </ToastTitle>
              {item.description && <ToastDescription>{item.description}</ToastDescription>}
            </div>
            {item.action && (
              <button
                type="button"
                className="h-8 shrink-0 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-surface-hover"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            )}
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}
