import { useState, useEffect } from 'react';
import type { HarnessSnapshot } from '@coding-harness/shared';
import { HARNESS_STATES, STATE_LABELS } from '@coding-harness/shared';
import type { HarnessState } from '@coding-harness/shared';

function formatTimestamp(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function formatFullTimestamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
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
  enteredAt: string | null;
  isFailed: boolean;
  isCancelled: boolean;
  onClick: () => void;
}

function NodeCard({ state, currentIndex, stateIndex, enteredAt, isFailed, isCancelled, onClick }: NodeCardProps) {
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
    ? isCancelled
      ? 'var(--ink-muted)'
      : 'var(--accent-cyan)'
    : 'var(--ink-muted)';

  const textColor = isCompleted || isCurrent ? 'var(--bg-deep)' : 'var(--text-dust)';

  const borderColor = isFailed
    ? 'var(--accent-red)'
    : isCurrent
    ? isCancelled
      ? 'var(--ink-muted)'
      : 'var(--accent-cyan)'
    : isCompleted
    ? 'var(--accent-lime)'
    : 'var(--ink-muted)';

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
    <div
      className={animClass}
      title={`${STATE_LABELS[state]}: ${formatFullTimestamp(enteredAt)}`}
      style={{
        width: 'var(--node-size)',
        height: 'var(--node-size)',
        background: bg,
        border: `4px solid ${isFailed ? 'var(--accent-red)' : isCurrent ? 'var(--accent-cyan)' : isCompleted ? 'var(--accent-lime)' : 'var(--ink-muted)'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
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
        padding: '4px 6px',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 9,
        color: textColor,
        textAlign: 'center',
        lineHeight: 1.3,
        wordBreak: 'break-word',
      }}>
        {STATE_LABELS[state]}
      </span>
      {isCompleted && (
        <span style={{ fontSize: 18, color: 'var(--bg-deep)' }}>✓</span>
      )}
      {isCurrent && (
        <span style={{ fontSize: 14, color: 'var(--bg-deep)' }}>●</span>
      )}
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        color: isPending ? 'var(--text-dust)' : textColor,
        position: 'absolute',
        bottom: -24,
        whiteSpace: 'nowrap',
      }}>
        {formatTimestamp(enteredAt)}
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
  const isCancelled = snapshot.meta.issueCancelled;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '56px 24px 60px',
        justifyContent: 'center',
        minWidth: 900,
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
                enteredAt={snapshot.perNode[state]?.enteredAt ?? null}
                isFailed={isFailed}
                isCancelled={isCancelled && idx === currentIndex}
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
