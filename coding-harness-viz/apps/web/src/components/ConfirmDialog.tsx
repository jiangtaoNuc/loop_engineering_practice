import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'DELETE',
  cancelLabel = 'CANCEL',
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-deep)',
          border: '4px solid var(--accent-red)',
          padding: '24px 32px',
          maxWidth: 420,
          width: '90%',
          imageRendering: 'pixelated',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 12,
            color: 'var(--accent-red)',
            marginBottom: 16,
            letterSpacing: 1,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 20,
            color: 'var(--text-bone)',
            marginBottom: 24,
            lineHeight: 1.4,
          }}
        >
          {message}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 9,
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--text-dust)',
              border: '2px solid var(--ink-muted)',
              cursor: loading ? 'not-allowed' : 'pointer',
              imageRendering: 'pixelated',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 9,
              padding: '8px 16px',
              background: 'var(--accent-red)',
              color: 'var(--text-bone)',
              border: '2px solid var(--accent-red)',
              cursor: loading ? 'not-allowed' : 'pointer',
              imageRendering: 'pixelated',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
