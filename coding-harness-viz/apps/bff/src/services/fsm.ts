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
import { extractEarliestStartedAt } from './coding-stats.js';

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

  if (issue.status === 'done') {
    if (deployInfo) return { state: 'deployed', prUrl };
    if (prInfo?.merged) {
      if (prInfo.ciStartedAt) return { state: 'ci', prUrl };
      return { state: 'pr_merged', prUrl };
    }
    if (prInfo) return { state: 'pr_opened', prUrl };
    if (hasAgent) return { state: 'agent_picked_up', prUrl };
    return { state: 'issue_created', prUrl };
  }
  if (issue.status === 'cancelled' && !hasPr) {
    return { state: 'issue_created', prUrl };
  }

  if (!hasPr) return { state: 'agent_picked_up', prUrl };

  if (prInfo) {
    if (prInfo.state === 'closed' && !prInfo.merged) {
      return { state: 'agent_picked_up', prUrl };
    }

    if (prInfo.merged) {
      if (deployInfo) return { state: 'deployed', prUrl };
      if (prInfo.ciStartedAt) return { state: 'ci', prUrl };
      return { state: 'pr_merged', prUrl };
    }

    if (prInfo.reviewDecision === 'APPROVED') {
      return { state: 'pr_opened', prUrl };
    }

    return { state: 'coding', prUrl };
  }

  return { state: 'coding', prUrl };
}

function computeNodeTimestamps(
  issue: MulticaIssue,
  comments: MulticaComment[],
  prInfo: PrInfo | null,
  deployInfo: DeployInfo | null,
): Record<HarnessState, string | null> {
  const sorted = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const firstAgentComment = sorted.find((c) => c.author_type === 'agent');
  const agentPickedUpAt = firstAgentComment?.created_at ?? null;

  return {
    issue_created: issue.created_at,
    agent_picked_up: agentPickedUpAt,
    coding: agentPickedUpAt,
    pr_opened: prInfo?.createdAt ?? null,
    pr_merged: prInfo?.mergedAt ?? null,
    ci: prInfo?.ciStartedAt ?? null,
    deployed: deployInfo?.startedAt ?? null,
  };
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
  const { state, prUrl } = deriveState(issue, comments, metadata, prInfo, deployInfo);
  const timestamps = computeNodeTimestamps(issue, comments, prInfo, deployInfo);

  const perNode = {} as Record<HarnessState, NodeStatus>;
  for (let i = 0; i < HARNESS_STATES.length; i++) {
    const s = HARNESS_STATES[i];
    const enteredAt = timestamps[s] ?? null;
    let leftAt: string | null = null;
    if (enteredAt) {
      for (let j = i + 1; j < HARNESS_STATES.length; j++) {
        const nextTs = timestamps[HARNESS_STATES[j]];
        if (nextTs) {
          leftAt = nextTs;
          break;
        }
      }
    }
    const stayedMs = enteredAt
      ? Math.max(0, new Date(leftAt ?? Date.now()).getTime() - new Date(enteredAt).getTime())
      : 0;
    perNode[s] = { state: s, enteredAt, leftAt, stayedMs };
  }

  const earliestStartedAt = extractEarliestStartedAt(comments);
  const agentPickedUpAt = earliestStartedAt ?? perNode.agent_picked_up.enteredAt ?? issue.created_at;
  const agentPickedUpSource: 'log' | 'fallback' = earliestStartedAt ? 'log' : 'fallback';

  if (agentPickedUpAt) {
    const apuIdx = HARNESS_STATES.indexOf('agent_picked_up');
    const currentIdx = HARNESS_STATES.indexOf(state);
    if (apuIdx <= currentIdx) {
      perNode.agent_picked_up.enteredAt = agentPickedUpAt;
      const apuLeftAt = perNode.agent_picked_up.leftAt;
      perNode.agent_picked_up.stayedMs = Math.max(0, new Date(apuLeftAt ?? Date.now()).getTime() - new Date(agentPickedUpAt).getTime());
      perNode.agent_picked_up.durationSec = Math.floor(perNode.agent_picked_up.stayedMs / 1000);
    }
  }

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
    issueCancelled: issue.status === 'cancelled',
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
      a: agentPickedUpAt,
    }),
  ).toString('base64url').slice(0, 32);

  const createdAt = new Date(issue.created_at).getTime();
  const allTimestamps = Object.values(timestamps).filter(
    (t): t is string => t != null,
  );
  const lastTs = allTimestamps.length > 0
    ? Math.max(...allTimestamps.map((t) => new Date(t).getTime()))
    : null;
  const endTime = issue.status === 'done' && lastTs && !isNaN(lastTs)
    ? lastTs
    : Date.now();
  const totalDurationMs = !isNaN(createdAt) ? endTime - createdAt : 0;

  return {
    issueId: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state,
    enteredAt: timestamps[state] ?? issue.created_at,
    totalDurationMs,
    creatorType: issue.creator_type ?? null,
    creatorId: issue.creator_id ?? null,
    perNode,
    meta,
    agentPickedUpAt,
    agentPickedUpSource,
    degraded: false,
    etag,
  };
}
