import { useEffect } from 'react';
import type { HarnessSnapshot, HarnessState, CodingStats } from '@coding-harness/shared';
import { STATE_LABELS } from '@coding-harness/shared';
import type { NetworkError } from '../hooks/useHarness';

function formatDateTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
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

function formatDurationSec(sec: number | null): string {
  if (sec == null) return '--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatNumber(n: number | null): string {
  if (n == null) return '--';
  return n.toLocaleString();
}

function label(labelText: string, value: React.ReactNode, highlight?: boolean) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 9,
        color: 'var(--text-dust)',
        marginBottom: 6,
      }}>
        {labelText}
      </div>
      <div style={{
        color: highlight ? 'var(--accent-lime)' : 'var(--text-bone)',
        wordBreak: 'break-word',
        fontSize: 22,
      }}>
        {value}
      </div>
    </div>
  );
}

function sectionTitle(text: string) {
  return (
    <div style={{
      fontFamily: 'var(--font-heading)',
      fontSize: 10,
      color: 'var(--accent-cyan)',
      padding: '16px 0 10px',
      borderTop: '2px solid var(--ink-muted)',
      marginTop: 4,
    }}>
      {text}
    </div>
  );
}

interface Props {
  snapshot: HarnessSnapshot;
  state: HarnessState;
  stats: CodingStats | null;
  loadingStats: boolean;
  statsError: NetworkError | null;
  onClose: () => void;
}

export function NodeDetailModal({ snapshot, state, stats, loadingStats, statsError, onClose }: Props) {
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
          padding: '28px 36px',
          minWidth: 720,
          minHeight: 480,
          maxWidth: 900,
          maxHeight: '85vh',
          overflowY: 'auto',
          fontFamily: 'var(--font-body)',
          fontSize: 22,
          boxShadow: '0 0 24px rgba(65,166,246,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          borderBottom: '2px solid var(--ink-muted)',
          paddingBottom: 12,
        }}>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 14,
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
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1 }}>
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
              {label('PICKED UP AT', formatDateTime(snapshot.agentPickedUpAt))}
              {label(
                'SOURCE',
                snapshot.agentPickedUpSource === 'log' ? 'log' : 'fallback',
                snapshot.agentPickedUpSource === 'log',
              )}
              {snapshot.agentPickedUpSource === 'fallback' && (
                <div style={{
                  padding: '10px 14px',
                  marginBottom: 14,
                  background: 'rgba(246,166,65,0.15)',
                  border: '2px solid #F6A641',
                  fontFamily: 'var(--font-body)',
                  fontSize: 18,
                  color: '#F6A641',
                }}>
                  (fallback) No v2 coding-stats footer found; using issue creation time.
                </div>
              )}
              {label('DURATION', formatDuration(node.stayedMs))}
            </>
          )}

          {state === 'coding' && (
            <>
              {label('STARTED AT', formatDateTime(node.enteredAt))}
              {label('DURATION', formatDuration(node.stayedMs))}
              {sectionTitle('CODING TELEMETRY')}
              {loadingStats && (
                <div style={{ color: 'var(--text-dust)', padding: '16px 0' }}>▒▒▒ LOADING... ▒▒▒</div>
              )}
              {!loadingStats && statsError && (
                <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-heading)', fontSize: 10, padding: '16px 0' }}>
                  {statsError.message.toUpperCase()}
                </div>
              )}
              {!loadingStats && !statsError && (!stats || !stats.available) && (
                <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-heading)', fontSize: 10, padding: '16px 0' }}>
                  NO TELEMETRY YET
                </div>
              )}
              {!loadingStats && stats?.available && (
                <>
                  {label('STARTED AT', formatDateTime(stats.startedAt))}
                  {label(
                    'ENDED AT',
                    stats.endedAt ? formatDateTime(stats.endedAt) : 'RUNNING',
                    !stats.endedAt,
                  )}
                  {label('DURATION', formatDurationSec(stats.durationSec))}
                  {label('TOOL CALLS', formatNumber(stats.toolCalls))}
                  {label('EVENTS', formatNumber(stats.events))}
                  {stats.turns != null && label('TURNS', formatNumber(stats.turns))}
                  {label('SAMPLED AT', formatDateTime(stats.sampleAt ?? null))}
                </>
              )}
              {snapshot.meta.prUrl && (
                <>
                  {sectionTitle('PR')}
                  {label('PR URL', snapshot.meta.prUrl ? (
                    <a href={snapshot.meta.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                      {snapshot.meta.prUrl.replace('https://github.com/', '')}
                    </a>
                  ) : '--')}
                  {label('CI STATUS', snapshot.meta.ciStatus ?? '--')}
                  {label('DRAFT', snapshot.meta.prDraft ? 'YES' : 'NO')}
                </>
              )}
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
    </div>
  );
}
