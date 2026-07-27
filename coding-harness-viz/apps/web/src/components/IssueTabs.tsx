import { useState, useMemo, useCallback } from 'react';
import type { IssueSummary } from '@coding-harness/shared';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  issues: IssueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  includeAutopilot: boolean;
  onToggleAutopilot: () => void;
  isFiltered: boolean;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  onToggleAll: () => void;
  onDeleteOne: (id: string) => void;
  onDeleteBatch: () => void;
}

export function IssueTabs({
  issues,
  selectedId,
  onSelect,
  includeAutopilot,
  onToggleAutopilot,
  isFiltered,
  checkedIds,
  onToggleCheck,
  onToggleAll,
  onDeleteOne,
  onDeleteBatch,
}: Props) {
  const [query, setQuery] = useState('');
  const [confirmSingle, setConfirmSingle] = useState<string | null>(null);
  const [confirmBatch, setConfirmBatch] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter(
      (i) =>
        i.identifier.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q),
    );
  }, [issues, query]);

  const checkedCount = checkedIds.size;
  const allChecked = issues.length > 0 && checkedCount === issues.length;

  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmSingle(id);
  }, []);

  const confirmSingleIssue = confirmSingle
    ? issues.find((i) => i.id === confirmSingle)
    : null;

  if (issues.length === 0) {
    return (
      <div style={{
        padding: '12px 16px',
        fontFamily: "var(--font-body)",
        fontSize: 24,
        color: 'var(--text-dust)',
        textAlign: 'center',
      }}>
        {isFiltered
          ? '▒▒▒ No issues match this filter ▒▒▒'
          : '▒▒▒ No issues found. Waiting for creation... ▒▒▒'}
      </div>
    );
  }

  return (
    <>
      {checkedCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 16px',
            background: 'var(--bg-deep)',
            borderBottom: '2px solid var(--accent-red)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 18,
              color: 'var(--text-dust)',
            }}
          >
            {checkedCount} selected
          </span>
          <button
            onClick={() => setConfirmBatch(true)}
            data-testid="batch-delete-btn"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 8,
              padding: '4px 12px',
              background: 'var(--accent-red)',
              color: 'var(--text-bone)',
              border: '2px solid var(--accent-red)',
              cursor: 'pointer',
              imageRendering: 'pixelated',
            }}
          >
            BATCH DELETE
          </button>
          <button
            onClick={onToggleAll}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 8,
              padding: '4px 12px',
              background: 'transparent',
              color: 'var(--text-dust)',
              border: '2px solid var(--ink-muted)',
              cursor: 'pointer',
              imageRendering: 'pixelated',
              marginLeft: 'auto',
            }}
          >
            {allChecked ? 'DESELECT ALL' : 'SELECT ALL'}
          </button>
        </div>
      )}

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
            const isChecked = checkedIds.has(issue.id);
            return (
              <div
                key={issue.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  border: `2px solid ${isSelected ? 'var(--accent-cyan)' : isChecked ? 'var(--accent-lime)' : 'var(--ink-muted)'}`,
                  background: isSelected ? 'var(--accent-cyan)' : 'transparent',
                  imageRendering: 'pixelated',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleCheck(issue.id)}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`check-${issue.id}`}
                  style={{
                    width: 14,
                    height: 14,
                    marginLeft: 6,
                    cursor: 'pointer',
                    accentColor: 'var(--accent-lime)',
                  }}
                />
                <button
                  onClick={() => onSelect(issue.id)}
                  title={issue.title}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 10,
                    padding: '8px 8px',
                    background: 'transparent',
                    color: isSelected ? 'var(--bg-deep)' : 'var(--text-bone)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  [{issue.identifier}]
                </button>
                <button
                  onClick={(e) => handleDeleteClick(e, issue.id)}
                  data-testid={`delete-${issue.id}`}
                  title={`Delete ${issue.identifier}`}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 10,
                    padding: '4px 6px',
                    marginRight: 4,
                    background: 'transparent',
                    color: isSelected ? 'var(--bg-deep)' : 'var(--accent-red)',
                    border: 'none',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={onToggleAutopilot}
          title={includeAutopilot ? 'Hide autopilot issues' : 'Show autopilot issues'}
          style={{
            marginLeft: 'auto',
            width: 24,
            height: 24,
            padding: 0,
            background: includeAutopilot ? 'var(--accent-cyan)' : 'transparent',
            border: `2px solid ${includeAutopilot ? 'var(--accent-cyan)' : 'var(--ink-muted)'}`,
            color: includeAutopilot ? 'var(--bg-deep)' : 'var(--text-dust)',
            cursor: 'pointer',
            fontSize: 8,
            lineHeight: '20px',
            textAlign: 'center',
            imageRendering: 'pixelated',
            flexShrink: 0,
          }}
        >
          🛠
        </button>
      </div>

      <ConfirmDialog
        open={!!confirmSingleIssue}
        title="CONFIRM DELETE"
        message={
          confirmSingleIssue
            ? `Delete issue ${confirmSingleIssue.identifier}? This action cannot be undone.`
            : ''
        }
        onConfirm={() => {
          if (confirmSingle) onDeleteOne(confirmSingle);
          setConfirmSingle(null);
        }}
        onCancel={() => setConfirmSingle(null)}
      />

      <ConfirmDialog
        open={confirmBatch}
        title="CONFIRM BATCH DELETE"
        message={`Delete ${checkedCount} selected issue(s)? This action cannot be undone.`}
        onConfirm={() => {
          onDeleteBatch();
          setConfirmBatch(false);
        }}
        onCancel={() => setConfirmBatch(false)}
      />
    </>
  );
}
