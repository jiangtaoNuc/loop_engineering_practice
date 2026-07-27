import type { StatusTimelineResponse, MulticaStatus } from '@coding-harness/shared';
import { STATUS_LABELS } from '@coding-harness/shared';

const STATUS_CSS_VARS: Record<MulticaStatus, string> = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in_progress)',
  in_review: 'var(--status-in_review)',
  done: 'var(--status-done)',
  blocked: 'var(--status-blocked)',
  backlog: 'var(--status-backlog)',
  cancelled: 'var(--status-cancelled)',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  timeline: StatusTimelineResponse | null;
}

export function StatusTimeline({ timeline }: Props) {
  if (!timeline) {
    return (
      <div style={{
        width: 300,
        minWidth: 300,
        padding: 16,
        borderLeft: '4px solid var(--ink-muted)',
        fontFamily: 'var(--font-body)',
        fontSize: 20,
        color: 'var(--text-dust)',
      }}>
        Select an issue to view its status timeline.
      </div>
    );
  }

  return (
    <div style={{
      width: 300,
      minWidth: 300,
      padding: 16,
      borderLeft: '4px solid var(--ink-muted)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      overflowY: 'auto',
    }}>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-dust)', marginBottom: 4 }}>
          ISSUE
        </div>
        <div style={{ fontSize: 18, color: 'var(--text-bone)', wordBreak: 'break-word' }}>
          [{timeline.identifier}] {timeline.title}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-dust)', marginBottom: 8 }}>
          STATUS TIMELINE
        </div>

        {timeline.timeline.length === 0 ? (
          <div style={{ color: 'var(--text-dust)' }}>No timeline data available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {timeline.timeline.map((entry, index) => {
              const color = STATUS_CSS_VARS[entry.status];
              return (
                <div key={index} style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}>
                    <div style={{
                      width: 12,
                      height: 12,
                      background: color,
                      border: `2px solid ${color}`,
                    }} />
                    {index < timeline.timeline.length - 1 && (
                      <div style={{
                        width: 2,
                        flex: 1,
                        background: 'var(--ink-muted)',
                        marginTop: 4,
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1, paddingBottom: 12 }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      background: color,
                      color: 'var(--bg-deep)',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 8,
                    }}>
                      {STATUS_LABELS[entry.status].toUpperCase()}
                    </div>
                    {entry.inferred && (
                      <span style={{
                        marginLeft: 6,
                        fontSize: 12,
                        color: 'var(--text-dust)',
                      }}>
                        (inferred)
                      </span>
                    )}
                    <div style={{ marginTop: 4, fontSize: 16, color: 'var(--text-bone)' }}>
                      {formatDate(entry.startedAt)}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-dust)' }}>
                      {entry.endedAt ? `→ ${formatDate(entry.endedAt)}` : '→ now'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
