import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const { type, message } = toast;

  const styles = {
    success: 'bg-emerald-900/90 text-emerald-100 border-emerald-500/50',
    error: 'bg-rose-900/90 text-rose-100 border-rose-500/50',
    warning: 'bg-amber-900/90 text-amber-100 border-amber-500/50',
    info: 'bg-sky-900/90 text-sky-100 border-sky-500/50'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-400 shrink-0" />
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up max-w-md">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md ${styles[type] || styles.info}`}>
        {icons[type] || icons.info}
        <div className="text-sm font-medium pr-2 leading-relaxed">{message}</div>
        {onClose && (
          <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity p-0.5">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
