import { useState, useCallback } from 'react';
import type { IssueSummary } from '@coding-harness/shared';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  issues: IssueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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
  checkedIds,
  onToggleCheck,
  onToggleAll,
  onDeleteOne,
  onDeleteBatch,
}: Props) {
  const [confirmSingle, setConfirmSingle] = useState<string | null>(null);
  const [confirmBatch, setConfirmBatch] = useState(false);

  const checkedCount = checkedIds.size;
  const allChecked = issues.length > 0 && checkedCount === issues.length;

  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmSingle(id);
  }, []);

  const handleCheckClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onToggleCheck(id);
    },
    [onToggleCheck],
  );

  const confirmSingleId = confirmSingle
    ? issues.find((i) => i.id === confirmSingle)
    : null;

  if (issues.length === 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          fontFamily: 'var(--font-body)',
          fontSize: 24,
          color: 'var(--text-dust)',
          textAlign: 'center',
        }}
      >
        {'▒▒▒ No issues found. Waiting for creation... ▒▒▒'}
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

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 16px',
          overflowX: 'auto',
          borderBottom: '4px solid var(--ink-muted)',
        }}
      >
        {issues.map((issue) => {
          const isSelected = issue.id === selectedId;
          const isChecked = checkedIds.has(issue.id);
          return (
            <div
              key={issue.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
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

      <ConfirmDialog
        open={!!confirmSingleId}
        title="CONFIRM DELETE"
        message={
          confirmSingleId
            ? `Delete issue ${confirmSingleId.identifier}? This action cannot be undone.`
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
