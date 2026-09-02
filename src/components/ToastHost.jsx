import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function ToastHost({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(onDismiss, toast.duration || 4200);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[7.2rem] z-[1200] flex justify-center px-4" role="status" aria-live="polite">
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[1.25rem] border border-white/10 bg-[var(--bg-nav)] px-4 py-3 text-sm shadow-2xl backdrop-blur-2xl animate-fade-in">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-400" />
        <span className="min-w-0 flex-1 font-semibold text-primary">{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
          <button type="button" onClick={() => { toast.onAction(); onDismiss(); }} className="rounded-lg px-2 py-1 text-xs font-extrabold text-accent-400 hover:bg-white/5">
            {toast.actionLabel}
          </button>
        )}
        <button type="button" onClick={onDismiss} className="rounded-lg p-1 text-slate-600 hover:bg-white/5 hover:text-primary" aria-label="Dismiss"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
