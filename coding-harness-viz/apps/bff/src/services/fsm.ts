import type {
  HarnessState,
  HarnessSnapshot,
  HarnessMeta,
  NodeStatus,
} from '@coding-harness/shared';
import { HARNESS_STATES } from '@coding-harness/shared';
import type { MulticaIssue, MulticaComment, MulticaMetadata } from './multica-cli.js';
import type { PrInfo, DeployInfo } from './github.js';
import type { Transition } from './transitions.js';

export const PR_URL_RE = /https?:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/;

export function extractPrUrl(metadata: MulticaMetadata, comments: MulticaComment[]): string | null {
  if (metadata.pr_url && typeof metadata.pr_url === 'string') return metadata.pr_url;
  for (const c of comments) {
    const match = c.content.match(PR_URL_RE);
    if (match) return match[0];
  }
  return null;
}

function extractLastComment(comments: MulticaComment[]): string | null {
  if (comments.length === 0) return null;
  const text = comments[0].content.replace(/[#*`[\]]/g, '').trim();
  return text.length > 120 ? text.slice(0, 120) + '...' : text;
}

export function deriveState(
  issue: MulticaIssue,
  comments: MulticaComment[],
  metadata: MulticaMetadata,
  prInfo: PrInfo | null,
  deployInfo: DeployInfo | null,
): { state: HarnessState; prUrl: string | null } {
  const prUrl = extractPrUrl(metadata, comments);
  const hasAgent = issue.assignee_id != null && issue.assignee_type === 'agent';
  const hasPr = prUrl != null;

  if (!hasAgent) return { state: 'issue_created', prUrl };

  if (!hasPr) return { state: 'agent_picked_up', prUrl };

  if (prInfo) {
    if (prInfo.state === 'closed' && !prInfo.merged) {
      return { state: 'agent_picked_up', prUrl };
    }

    if (prInfo.merged) {
      if (deployInfo?.conclusion === 'success') {
        return { state: 'deployed', prUrl };
      }
      return { state: 'pr_merged', prUrl };
    }

    if (prInfo.reviewDecision === 'APPROVED') {
      return { state: 'pr_opened', prUrl };
    }

    return { state: 'coding', prUrl };
  }

  return { state: 'coding', prUrl };
}

function applyTransitions(
  issue: MulticaIssue,
  state: HarnessState,
  transitions: Transition[],
  now: number,
): { perNode: Record<HarnessState, NodeStatus>; totalDurationMs: number } {
  const terminal = state === 'deployed' || issue.status === 'cancelled';
  const endTime = terminal ? new Date(issue.updated_at).getTime() : now;
  const totalDurationMs = Math.max(0, endTime - new Date(issue.created_at).getTime());

  const perNode = {} as Record<HarnessState, NodeStatus>;
  for (const s of HARNESS_STATES) {
    perNode[s] = { state: s, enteredAt: null, leftAt: null, stayedMs: 0, durationSec: 0 };
  }

  perNode['issue_created'].enteredAt = issue.created_at;

  for (const t of transitions) {
    perNode[t.fromState].leftAt = t.at;
    perNode[t.toState].enteredAt = t.at;
  }

  const currentIdx = HARNESS_STATES.indexOf(state);
  for (let i = 0; i < HARNESS_STATES.length; i++) {
    const s = HARNESS_STATES[i];
    const node = perNode[s];

    if (i < currentIdx) {
      if (node.enteredAt && node.leftAt) {
        node.stayedMs = Math.max(0, new Date(node.leftAt).getTime() - new Date(node.enteredAt).getTime());
      }
    } else if (i === currentIdx) {
      if (!node.enteredAt) {
        node.enteredAt = issue.created_at;
      }
      node.leftAt = terminal ? issue.updated_at : null;
      node.stayedMs = Math.max(0, endTime - new Date(node.enteredAt).getTime());
    } else {
      node.enteredAt = null;
      node.leftAt = null;
      node.stayedMs = 0;
    }

    node.durationSec = Math.floor(node.stayedMs / 1000);
  }

  return { perNode, totalDurationMs };
}

export function buildSnapshot(
  issue: MulticaIssue,
  comments: MulticaComment[],
  metadata: MulticaMetadata,
  prInfo: PrInfo | null,
  deployInfo: DeployInfo | null,
  agentName: string | null,
  transitions: Transition[] = [],
): HarnessSnapshot {
  const now = Date.now();
  const { state, prUrl } = deriveState(issue, comments, metadata, prInfo, deployInfo);

  const { perNode, totalDurationMs } = applyTransitions(issue, state, transitions, now);

  const deployUrl = (metadata.deploy_url as string) ?? deployInfo?.runUrl ?? null;

  const meta: HarnessMeta = {
    prUrl,
    deployUrl,
    assignee: agentName,
    lastComment: extractLastComment(comments),
    ciStatus: prInfo?.ciStatus ?? null,
    prDraft: prInfo?.draft ?? false,
    prMerged: prInfo?.merged ?? false,
    prClosed: prInfo != null && prInfo.state === 'closed' && !prInfo.merged,
    deployFailed: deployInfo?.conclusion === 'failure',
    prTitle: prInfo?.title ?? null,
    prMergedAt: prInfo?.mergedAt ?? null,
    prMergeSha: prInfo?.mergeCommitSha ?? null,
    prReviewDecision: prInfo?.reviewDecision ?? null,
    deployConclusion: deployInfo?.conclusion ?? null,
    deployStartedAt: deployInfo?.startedAt ?? null,
    deployCompletedAt: deployInfo?.completedAt ?? null,
  };

  const currentNode = perNode[state];
  const etag = Buffer.from(
    JSON.stringify({
      s: state,
      u: issue.updated_at,
      d: deployInfo?.conclusion,
      e: currentNode?.enteredAt,
      l: currentNode?.leftAt,
    }),
  ).toString('base64url').slice(0, 32);

  return {
    issueId: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state,
    enteredAt: currentNode.enteredAt,
    stayedMs: currentNode.stayedMs,
    totalDurationMs,
    creatorId: issue.creator_id ?? null,
    creatorType: issue.creator_type ?? null,
    perNode,
    meta,
    degraded: false,
    etag,
  };
}
