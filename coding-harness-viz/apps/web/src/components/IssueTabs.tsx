import { useState, useMemo } from 'react';
import type { IssueSummary } from '@coding-harness/shared';

interface Props {
  issues: IssueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function IssueTabs({ issues, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter(
      (i) =>
        i.identifier.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q),
    );
  }, [issues, query]);

  if (issues.length === 0) {
    return (
      <div style={{
        padding: '12px 16px',
        fontFamily: "var(--font-body)",
        fontSize: 24,
        color: 'var(--text-dust)',
        textAlign: 'center',
      }}>
        ▒▒▒ No issues found. Waiting for creation... ▒▒▒
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 16px',
      borderBottom: '4px solid var(--ink-muted)',
      background: 'var(--bg-deep)',
    }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索 issue..."
        style={{
          width: 160,
          flexShrink: 0,
          padding: '6px 8px',
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          color: 'var(--text-bone)',
          background: 'var(--bg-deep)',
          border: '2px solid var(--ink-muted)',
          outline: 'none',
          imageRendering: 'pixelated',
        }}
      />
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 16,
        color: 'var(--text-dust)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        {filtered.length}/{issues.length}
      </span>
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        flex: 1,
      }}>
        {filtered.map((issue) => {
          const isSelected = issue.id === selectedId;
          return (
            <button
              key={issue.id}
              onClick={() => onSelect(issue.id)}
              title={issue.title}
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 10,
                padding: '8px 12px',
                background: isSelected ? 'var(--accent-cyan)' : 'transparent',
                color: isSelected ? 'var(--bg-deep)' : 'var(--text-bone)',
                border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--ink-muted)'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                imageRendering: 'pixelated',
                transition: 'none',
              }}
            >
              [{issue.identifier}]
            </button>
          );
        })}
      </div>
    </div>
  );
}
