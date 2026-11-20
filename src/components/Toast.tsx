import React from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
  tone?: 'success' | 'error' | 'info';
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  const toneClasses =
    toast.tone === 'error'
      ? 'bg-rose-700 text-white'
      : toast.tone === 'info'
      ? 'bg-sky-900 text-white'
      : 'bg-slate-900 text-white';

  return (
    <div className="fixed top-16 md:top-20 right-4 left-4 md:left-auto z-50 flex justify-end pointer-events-none">
      <div
        role="status"
        className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg max-w-md ${toneClasses}`}
      >
        {toast.tone === 'error' ? (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        )}
        <span className="flex-1">{toast.text}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="p-1 -mr-1 rounded-lg opacity-80 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
