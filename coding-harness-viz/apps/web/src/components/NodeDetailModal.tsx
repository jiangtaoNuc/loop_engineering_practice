import { useEffect } from 'react';
import type { HarnessSnapshot, HarnessState, CodingStats } from '@coding-harness/shared';
import { STATE_LABELS } from '@coding-harness/shared';

function formatDateTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${String(s % 60).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${String(s).padStart(2, '0')}s`;
}

function label(labelText: string, value: React.ReactNode) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 8,
        color: 'var(--text-dust)',
        marginBottom: 4,
      }}>
        {labelText}
      </div>
      <div style={{ color: 'var(--text-bone)', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

interface Props {
  snapshot: HarnessSnapshot;
  state: HarnessState;
  stats: CodingStats | null;
  loadingStats: boolean;
  onClose: () => void;
}

export function NodeDetailModal({ snapshot, state, stats, loadingStats, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const node = snapshot.perNode[state];

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${STATE_LABELS[state]} details`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-deep)',
          border: `4px solid ${state === 'deployed' ? 'var(--accent-lime)' : 'var(--accent-cyan)'}`,
          padding: 24,
          minWidth: 320,
          maxWidth: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          fontFamily: 'var(--font-body)',
          fontSize: 20,
          boxShadow: '0 0 24px rgba(65,166,246,0.25)',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          borderBottom: '2px solid var(--ink-muted)',
          paddingBottom: 8,
        }}>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 10,
            color: state === 'deployed' ? 'var(--accent-lime)' : 'var(--accent-cyan)',
          }}>
            {STATE_LABELS[state].toUpperCase()}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dust)',
              fontFamily: 'var(--font-heading)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {state === 'issue_created' && (
          <>
            {label('CREATOR', `${snapshot.creatorType ?? 'unknown'} ${snapshot.creatorId ? `(${snapshot.creatorId.slice(0, 8)})` : ''}`)}
            {label('CREATED AT', formatDateTime(snapshot.perNode.issue_created.enteredAt))}
            {label('TITLE', snapshot.title)}
            {label('ISSUE', `[${snapshot.identifier}](https://app.multica.io/issues/${snapshot.issueId})`)}
          </>
        )}

        {state === 'agent_picked_up' && (
          <>
            {label('AGENT', snapshot.meta.assignee ?? '--')}
            {label('STARTED AT', formatDateTime(node.enteredAt))}
            {label('DURATION', formatDuration(node.stayedMs))}
          </>
        )}

        {state === 'coding' && (
          <>
            {label('STARTED AT', formatDateTime(node.enteredAt))}
            {label('DURATION', formatDuration(node.stayedMs))}
            <div style={{ marginTop: 16, borderTop: '2px solid var(--ink-muted)', paddingTop: 12 }}>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 8,
                color: 'var(--text-dust)',
                marginBottom: 8,
              }}>
                AI TELEMETRY
              </div>
              {loadingStats && (
                <div style={{ color: 'var(--text-dust)' }}>LOADING...</div>
              )}
              {!loadingStats && (!stats || !stats.available) && (
                <div style={{ color: 'var(--text-dust)' }}>NO TELEMETRY YET</div>
              )}
              {!loadingStats && stats?.available && (
                <>
                  {label('TOOL CALLS', stats.toolCalls.toLocaleString())}
                  {label('TOKENS IN', stats.tokensIn.toLocaleString())}
                  {label('TOKENS OUT', stats.tokensOut.toLocaleString())}
                  {label('TURNS', stats.turns.toLocaleString())}
                  {label('SAMPLED AT', formatDateTime(stats.sampleAt ?? null))}
                </>
              )}
            </div>
          </>
        )}

        {state === 'pr_opened' && (
          <>
            {label('PR TITLE', snapshot.meta.prTitle ?? '--')}
            {label('PR URL', snapshot.meta.prUrl ? (
              <a href={snapshot.meta.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                {snapshot.meta.prUrl.replace('https://github.com/', '')}
              </a>
            ) : '--')}
            {label('CI STATUS', snapshot.meta.ciStatus ?? '--')}
            {label('REVIEW DECISION', snapshot.meta.prReviewDecision ?? '--')}
          </>
        )}

        {state === 'pr_merged' && (
          <>
            {label('PR TITLE', snapshot.meta.prTitle ?? '--')}
            {label('PR URL', snapshot.meta.prUrl ? (
              <a href={snapshot.meta.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                {snapshot.meta.prUrl.replace('https://github.com/', '')}
              </a>
            ) : '--')}
            {label('MERGED AT', formatDateTime(snapshot.meta.prMergedAt))}
            {label('MERGE SHA', snapshot.meta.prMergeSha ?? '--')}
            {label('REVIEW DECISION', snapshot.meta.prReviewDecision ?? '--')}
          </>
        )}

        {state === 'deployed' && (
          <>
            {label('DEPLOY URL', snapshot.meta.deployUrl ? (
              <a href={snapshot.meta.deployUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-lime)' }}>
                {snapshot.meta.deployUrl.replace('https://github.com/', '')}
              </a>
            ) : '--')}
            {label('CONCLUSION', snapshot.meta.deployConclusion ?? '--')}
            {label('STARTED AT', formatDateTime(snapshot.meta.deployStartedAt))}
            {label('COMPLETED AT', formatDateTime(snapshot.meta.deployCompletedAt))}
          </>
        )}
      </div>
    </div>
  );
}
