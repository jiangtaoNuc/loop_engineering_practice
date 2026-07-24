import type { IssueSummary } from '@coding-harness/shared';
import { ISSUE_STATUSES, ISSUE_STATUS_LABELS, STATUS_FILTER_ALL } from '@coding-harness/shared';

interface Props {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  issues: IssueSummary[];
  filteredCount: number;
}

export function StatusFilter({ statusFilter, onStatusChange, issues, filteredCount }: Props) {
  const chips = [
    { value: STATUS_FILTER_ALL, label: 'ALL', count: issues.length },
    ...ISSUE_STATUSES.map((s) => ({
      value: s,
      label: ISSUE_STATUS_LABELS[s],
      count: issues.filter((i) => i.status === s).length,
    })),
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      borderBottom: '4px solid var(--ink-muted)',
    }}>
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        flex: 1,
      }}>
        {chips.map((chip) => {
          const isSelected = chip.value === statusFilter;
          return (
            <button
              key={chip.value}
              onClick={() => onStatusChange(chip.value)}
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 8,
                padding: '6px 10px',
                background: isSelected ? 'var(--accent-cyan)' : 'transparent',
                color: isSelected ? 'var(--bg-deep)' : 'var(--text-bone)',
                border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--ink-muted)'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                imageRendering: 'pixelated',
                transition: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {chip.label}
              <span style={{
                fontSize: 8,
                opacity: isSelected ? 0.7 : 0.5,
              }}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 16,
        color: 'var(--text-dust)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {filteredCount} / {issues.length} issues
      </span>
    </div>
  );
}
