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

// Canonical display status for a pipeline node, normalized once from the raw
// signals the BFF emits so node colors stay consistent with the Sidebar and the
// spec: success→green, failure→red, pending→blue.
//
// Known status values that reach this component (all produced by
// apps/bff/src/services/fsm.ts — no other status strings are sent over the
// wire, so only these are covered here):
//   - snapshot.state ∈ HARNESS_STATES:
//       "issue_created" | "agent_picked_up" | "coding" | "pr_opened"
//       | "pr_merged" | "ci" | "deployed"
//   - deploy success  → snapshot.state === "deployed"
//                       (fsm.ts: deployInfo.conclusion === "success")
//   - deploy failure  → snapshot.meta.deployFailed === true
//                       (fsm.ts: deployInfo.conclusion === "failure")
//   - PR closed w/o merge → snapshot.meta.prClosed === true
//   - issue cancelled → snapshot.meta.issueCancelled === true
//
// Color mapping (matches design tokens in design-tokens.ts):
//   success → green (var(--accent-lime))  — completed nodes + terminal "deployed"
//   failure → red   (var(--accent-red))   — failed deploy / closed-without-merge
//   pending → blue  (var(--ink-muted))    — nodes not yet reached, or cancelled-current
//   active  → cyan  (var(--accent-cyan))  — the single in-progress node (transient)
type NodeDisplayStatus = 'success' | 'failure' | 'active' | 'pending';

const STATUS_COLOR: Record<NodeDisplayStatus, string> = {
  success: 'var(--accent-lime)',
  failure: 'var(--accent-red)',
  active: 'var(--accent-cyan)',
  pending: 'var(--ink-muted)',
};

function resolveNodeStatus(args: {
  stateIndex: number;
  currentIndex: number;
  isFailed: boolean;
  isCancelled: boolean;
  reachedDeployed: boolean;
}): NodeDisplayStatus {
  const { stateIndex, currentIndex, isFailed, isCancelled, reachedDeployed } = args;
  if (isFailed) return 'failure';
  // Terminal "deployed" node is success once reached; otherwise it falls into
  // the active branch and renders cyan/blue forever (the reported bug).
  const isCompleted =
    stateIndex < currentIndex ||
    (reachedDeployed && stateIndex === currentIndex);
  if (isCompleted) return 'success';
  if (stateIndex === currentIndex) return isCancelled ? 'pending' : 'active';
  return 'pending';
}

interface NodeCardProps {
  state: HarnessState;
  currentIndex: number;
  stateIndex: number;
  enteredAt: string | null;
  isFailed: boolean;
  isCancelled: boolean;
  onClick: () => void;
  reachedDeployed: boolean;
}

function NodeCard({ state, currentIndex, stateIndex, enteredAt, isFailed, isCancelled, onClick, reachedDeployed }: NodeCardProps) {
  const [showLightUp, setShowLightUp] = useState(false);
  const status = resolveNodeStatus({ stateIndex, currentIndex, isFailed, isCancelled, reachedDeployed });
  const isCompleted = status === 'success';
  const isCurrent = status === 'active';
  const isPending = status === 'pending';
  const color = STATUS_COLOR[status];

  useEffect(() => {
    if (isCurrent) {
      setShowLightUp(true);
      const t = setTimeout(() => setShowLightUp(false), 1000);
      return () => clearTimeout(t);
    }
  }, [isCurrent]);

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
    <div
      className={animClass}
      onClick={onClick}
      title={`${STATE_LABELS[state]}: ${formatFullTimestamp(enteredAt)}`}
      style={{
        width: 'var(--node-size)',
        height: 'var(--node-size)',
        background: color,
        border: `4px solid ${color}`,
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
        cursor: 'pointer',
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
      {isFailed && (
        <span style={{ fontSize: 18, color: 'var(--bg-deep)' }}>✗</span>
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
  const reachedDeployed = snapshot.state === 'deployed';

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
                reachedDeployed={reachedDeployed}
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
