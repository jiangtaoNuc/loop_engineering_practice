import { useState, useEffect } from 'react';
import type { HarnessSnapshot } from '@coding-harness/shared';
import { HARNESS_STATES, STATE_LABELS, STATE_SHORT } from '@coding-harness/shared';
import type { HarnessState } from '@coding-harness/shared';

function formatDuration(ms: number): string {
  if (ms <= 0) return '--';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTotalDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${String(s).padStart(2, '0')}s`;
}

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

interface NodeCardProps {
  state: HarnessState;
  currentIndex: number;
  stateIndex: number;
  node: { enteredAt: string | null; leftAt: string | null; stayedMs: number };
  isFailed: boolean;
  onClick: () => void;
}

function NodeCard({ state, currentIndex, stateIndex, node, isFailed, onClick }: NodeCardProps) {
  const [showLightUp, setShowLightUp] = useState(false);
  const isCompleted = stateIndex < currentIndex;
  const isCurrent = stateIndex === currentIndex;
  const isPending = stateIndex > currentIndex;

  useEffect(() => {
    if (isCurrent) {
      setShowLightUp(true);
      const t = setTimeout(() => setShowLightUp(false), 1000);
      return () => clearTimeout(t);
    }
  }, [isCurrent]);

  const bg = isCompleted
    ? 'var(--accent-lime)'
    : isCurrent
    ? 'var(--accent-cyan)'
    : 'var(--ink-muted)';

  const textColor = isCompleted || isCurrent ? 'var(--bg-deep)' : 'var(--text-dust)';

  const animClass = isCurrent
    ? 'anim-heartbeat'
    : isFailed
    ? 'anim-shake'
    : '';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${STATE_LABELS[state]} details`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={animClass}
        style={{
          width: 'var(--node-size)',
          height: 'var(--node-size)',
          background: bg,
          border: `4px solid ${isFailed ? 'var(--accent-red)' : isCurrent ? 'var(--accent-cyan)' : isCompleted ? 'var(--accent-lime)' : 'var(--ink-muted)'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          position: 'relative',
          animation: isCurrent
            ? 'heartbeat 1.2s steps(8) infinite'
            : isFailed
            ? 'failShake 0.4s steps(6) 3'
            : showLightUp
            ? 'nodeLightUp 1s steps(12) 1'
            : 'none',
          imageRendering: 'pixelated',
          flexShrink: 0,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 8,
          color: textColor,
          textAlign: 'center',
          lineHeight: 1.2,
        }}>
          {STATE_SHORT[state]}
        </span>
        {isCompleted && (
          <span style={{ fontSize: 16, color: 'var(--bg-deep)' }}>✓</span>
        )}
        {isCurrent && (
          <span style={{ fontSize: 12, color: 'var(--bg-deep)' }}>●</span>
        )}
      </div>

      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        color: 'var(--text-dust)',
        marginTop: 12,
        whiteSpace: 'nowrap',
      }}>
        {STATE_LABELS[state]}
      </span>

      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        color: 'var(--text-dust)',
        whiteSpace: 'nowrap',
      }}>
        START {formatDateTime(isPending ? null : node.enteredAt)}
      </span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        color: 'var(--text-dust)',
        whiteSpace: 'nowrap',
      }}>
        END {formatDateTime(isPending ? null : node.leftAt)}
      </span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-dust)',
        whiteSpace: 'nowrap',
      }}>
        DURATION {isPending ? '--' : formatDuration(node.stayedMs)}
      </span>
    </div>
  );
}

interface PipeProps {
  active: boolean;
  direction: 'right';
}

function Pipe({ active }: PipeProps) {
  return (
    <div
      className={active ? 'anim-dataflow' : ''}
      style={{
        flex: 1,
        minWidth: 40,
        height: 'var(--pipe-height)',
        background: active
          ? 'repeating-linear-gradient(90deg, var(--accent-cyan) 0, var(--accent-cyan) 8px, var(--bg-deep) 8px, var(--bg-deep) 16px)'
          : 'var(--ink-muted)',
        animation: active ? 'dataFlow 0.6s steps(6) infinite' : 'none',
        imageRendering: 'pixelated',
        alignSelf: 'center',
      }}
    />
  );
}

interface Props {
  snapshot: HarnessSnapshot;
  transition: { from: string; to: string } | null;
  onNodeClick: (state: HarnessState) => void;
}

export function Pipeline({ snapshot, transition, onNodeClick }: Props) {
  const currentIndex = HARNESS_STATES.indexOf(snapshot.state);
  const isDeployFailed = snapshot.meta.deployFailed;
  const isPrClosed = snapshot.meta.prClosed;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 12px',
        background: 'var(--bg-deep)',
        border: '2px solid var(--accent-lime)',
        color: 'var(--accent-lime)',
        fontFamily: 'var(--font-heading)',
        fontSize: 8,
        whiteSpace: 'nowrap',
        zIndex: 1,
      }}>
        END-TO-END: {formatTotalDuration(snapshot.totalDurationMs)}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '56px 24px 60px',
        justifyContent: 'center',
        minWidth: 700,
      }}>
        {HARNESS_STATES.map((state, idx) => {
          const isFailed =
            (state === 'pr_merged' && isDeployFailed) ||
            (state === 'agent_picked_up' && isPrClosed);

          return (
            <span key={state} style={{ display: 'flex', alignItems: 'flex-start', flex: idx < HARNESS_STATES.length - 1 ? 1 : 'none' }}>
              <NodeCard
                state={state}
                currentIndex={currentIndex}
                stateIndex={idx}
                node={snapshot.perNode[state] ?? { enteredAt: null, leftAt: null, stayedMs: 0 }}
                isFailed={isFailed}
                onClick={() => onNodeClick(state)}
              />
              {idx < HARNESS_STATES.length - 1 && (
                <Pipe active={idx < currentIndex} direction="right" />
              )}
            </span>
          );
        })}
      </div>

      {transition?.to === 'pr_merged' && (
        <div className="anim-firework" style={{
          position: 'absolute',
          top: 0,
          left: '65%',
          fontSize: 32,
          animation: 'firework 2s steps(24) 1',
          pointerEvents: 'none',
        }}>
          ✦ ✧ ✦
        </div>
      )}

      {transition?.to === 'deployed' && (
        <div className="anim-rocket" style={{
          position: 'absolute',
          bottom: 40,
          left: '65%',
          fontSize: 24,
          animation: 'rocketLaunch 2.5s steps(30) 1',
          pointerEvents: 'none',
        }}>
          🚀
        </div>
      )}
    </div>
  );
}
