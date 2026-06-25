import type { HarnessSnapshot } from '@coding-harness/shared';
import { STATE_LABELS } from '@coding-harness/shared';

interface Props {
  snapshot: HarnessSnapshot;
}

export function Sidebar({ snapshot }: Props) {
  const { meta, state } = snapshot;

  return (
    <div style={{
      width: 280,
      minWidth: 280,
      padding: 16,
      borderLeft: '4px solid var(--ink-muted)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      fontFamily: 'var(--font-body)',
      fontSize: 20,
      overflowY: 'auto',
    }}>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-dust)', marginBottom: 4 }}>
          CURRENT STATE
        </div>
        <div style={{
          display: 'inline-block',
          padding: '4px 8px',
          background: state === 'deployed' ? 'var(--accent-lime)' : 'var(--accent-cyan)',
          color: 'var(--bg-deep)',
          fontFamily: 'var(--font-heading)',
          fontSize: 10,
        }}>
          {STATE_LABELS[state]}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-dust)', marginBottom: 4 }}>
          TITLE
        </div>
        <div style={{ fontSize: 18, color: 'var(--text-bone)', wordBreak: 'break-word' }}>
          {snapshot.title}
        </div>
      </div>

      {meta.assignee && (
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-dust)', marginBottom: 4 }}>
            ASSIGNEE
          </div>
          <div style={{ color: 'var(--accent-cyan)' }}>
            {meta.assignee}
          </div>
        </div>
      )}

      {meta.prUrl && (
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-dust)', marginBottom: 4 }}>
            PULL REQUEST
          </div>
          <a
            href={meta.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: meta.prClosed ? 'var(--accent-red)' : meta.prMerged ? 'var(--accent-lime)' : 'var(--accent-cyan)',
              textDecoration: 'none',
              borderBottom: '2px solid currentColor',
            }}
          >
            {meta.prUrl.replace('https://github.com/', '')}
          </a>
          <div style={{ marginTop: 4, fontSize: 16, color: 'var(--text-dust)' }}>
            {meta.prDraft && <span style={{ color: 'var(--accent-red)' }}> [DRAFT]</span>}
            {meta.prMerged && <span style={{ color: 'var(--accent-lime)' }}> [MERGED]</span>}
            {meta.prClosed && !meta.prMerged && <span style={{ color: 'var(--accent-red)' }}> [CLOSED]</span>}
            {meta.ciStatus === 'pass' && <span> CI: ✓</span>}
            {meta.ciStatus === 'fail' && <span style={{ color: 'var(--accent-red)' }}> CI: ✗</span>}
            {meta.ciStatus === 'pending' && <span> CI: ...</span>}
          </div>
        </div>
      )}

      {meta.deployUrl && (
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-dust)', marginBottom: 4 }}>
            DEPLOY
          </div>
          <a
            href={meta.deployUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-lime)', textDecoration: 'none', borderBottom: '2px solid currentColor' }}
          >
            {meta.deployUrl.replace('https://github.com/', '')}
          </a>
          {snapshot.meta.deployFailed && (
            <div style={{ color: 'var(--accent-red)', fontSize: 16, marginTop: 4 }}>
              ✗ DEPLOY FAILED
            </div>
          )}
        </div>
      )}

      {meta.lastComment && (
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-dust)', marginBottom: 4 }}>
            LAST COMMENT
          </div>
          <div style={{
            fontSize: 16,
            color: 'var(--text-dust)',
            borderLeft: '4px solid var(--ink-muted)',
            paddingLeft: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {meta.lastComment}
          </div>
        </div>
      )}

      {snapshot.degraded && (
        <div style={{
          padding: 8,
          background: 'var(--accent-red)',
          color: 'var(--text-bone)',
          fontFamily: 'var(--font-heading)',
          fontSize: 8,
          textAlign: 'center',
        }}>
          ⚠ DEGRADED MODE
        </div>
      )}
    </div>
  );
}
