import type { MulticaStatus } from '@coding-harness/shared';
import { MULTICA_STATUSES, STATUS_LABELS } from '@coding-harness/shared';

const STATUS_CSS_VARS: Record<MulticaStatus, string> = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in_progress)',
  in_review: 'var(--status-in_review)',
  done: 'var(--status-done)',
  blocked: 'var(--status-blocked)',
  backlog: 'var(--status-backlog)',
  cancelled: 'var(--status-cancelled)',
};

interface Props {
  selected: MulticaStatus[];
  onChange: (statuses: MulticaStatus[]) => void;
}

export function FilterBar({ selected, onChange }: Props) {
  const allSelected = selected.length === MULTICA_STATUSES.length;

  const toggleStatus = (status: MulticaStatus) => {
    if (selected.includes(status)) {
      onChange(selected.filter((s) => s !== status));
    } else {
      onChange([...selected, status]);
    }
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : [...MULTICA_STATUSES]);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 16px',
      borderBottom: '4px solid var(--ink-muted)',
      overflowX: 'auto',
      fontFamily: 'var(--font-body)',
      fontSize: 18,
    }}>
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 8,
        color: 'var(--text-dust)',
        whiteSpace: 'nowrap',
      }}>
        STATUS FILTER
      </span>

      <button
        onClick={toggleAll}
        style={{
          padding: '4px 8px',
          fontFamily: 'var(--font-heading)',
          fontSize: 8,
          background: allSelected ? 'var(--accent-cyan)' : 'transparent',
          color: allSelected ? 'var(--bg-deep)' : 'var(--text-bone)',
          border: `2px solid ${allSelected ? 'var(--accent-cyan)' : 'var(--ink-muted)'}`,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        ALL
      </button>

      {MULTICA_STATUSES.map((status) => {
        const isSelected = selected.includes(status);
        return (
          <button
            key={status}
            onClick={() => toggleStatus(status)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              fontFamily: 'var(--font-heading)',
              fontSize: 8,
              background: isSelected ? STATUS_CSS_VARS[status] : 'transparent',
              color: isSelected ? 'var(--bg-deep)' : 'var(--text-bone)',
              border: `2px solid ${isSelected ? STATUS_CSS_VARS[status] : 'var(--ink-muted)'}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              background: STATUS_CSS_VARS[status],
              display: 'inline-block',
            }} />
            {STATUS_LABELS[status].toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
