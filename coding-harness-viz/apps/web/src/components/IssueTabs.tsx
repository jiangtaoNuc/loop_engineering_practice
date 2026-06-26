import type { IssueSummary } from '@coding-harness/shared';

interface Props {
  issues: IssueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  includeAutopilot: boolean;
  onToggleAutopilot: () => void;
  isFiltered: boolean;
}

export function IssueTabs({ issues, selectedId, onSelect, includeAutopilot, onToggleAutopilot, isFiltered }: Props) {
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
    <div style={{
      display: 'flex',
      gap: 8,
      padding: '8px 16px',
      overflowX: 'auto',
      borderBottom: '4px solid var(--ink-muted)',
      alignItems: 'center',
      position: 'relative',
    }}>
      {issues.map((issue) => {
        const isSelected = issue.id === selectedId;
        return (
          <button
            key={issue.id}
            onClick={() => onSelect(issue.id)}
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
  );
}
