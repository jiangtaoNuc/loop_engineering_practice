export const ISSUE_STATUSES = [
  { value: '', label: '全部' },
  { value: 'todo', label: 'todo' },
  { value: 'in_progress', label: 'in_progress' },
  { value: 'in_review', label: 'in_review' },
  { value: 'done', label: 'done' },
  { value: 'blocked', label: 'blocked' },
  { value: 'backlog', label: 'backlog' },
] as const;

interface Props {
  value: string;
  onChange: (status: string) => void;
}

export function StatusFilter({ value, onChange }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 16px',
      borderBottom: '2px solid var(--ink-muted)',
      fontFamily: 'var(--font-heading)',
      fontSize: 10,
      color: 'var(--text-bone)',
    }}>
      <label htmlFor="status-filter">状态筛选</label>
      <select
        id="status-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg-deep)',
          color: 'var(--text-bone)',
          border: '2px solid var(--ink-muted)',
          fontFamily: 'var(--font-heading)',
          fontSize: 10,
          padding: '6px 8px',
          cursor: 'pointer',
        }}
      >
        {ISSUE_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
