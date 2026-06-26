import type {
  HarnessState,
  HarnessSnapshot,
  HarnessMeta,
  NodeStatus,
} from '@coding-harness/shared';
import { HARNESS_STATES } from '@coding-harness/shared';
import type { MulticaIssue, MulticaComment, MulticaMetadata } from './multica-cli.js';
import type { PrInfo, DeployInfo } from './github.js';

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

function makeNodeStatus(
  state: HarnessState,
  target: HarnessState,
  enteredAt: string | null,
  now: number,
): NodeStatus {
  const idx = HARNESS_STATES.indexOf(state);
  const tidx = HARNESS_STATES.indexOf(target);

  if (tidx < idx) {
    return { state: target, enteredAt: null, leftAt: null, stayedMs: 0 };
  }
  if (tidx === idx) {
    const entered = enteredAt ?? new Date().toISOString();
    return { state: target, enteredAt: entered, leftAt: null, stayedMs: now - new Date(entered).getTime() };
  }
  return { state: target, enteredAt: enteredAt ?? null, leftAt: enteredAt ?? null, stayedMs: 0 };
}

export function buildSnapshot(
  issue: MulticaIssue,
  comments: MulticaComment[],
  metadata: MulticaMetadata,
  prInfo: PrInfo | null,
  deployInfo: DeployInfo | null,
  agentName: string | null,
): HarnessSnapshot {
  const now = Date.now();
  const { state, prUrl } = deriveState(issue, comments, metadata, prInfo, deployInfo);

  const enteredAt = issue.created_at;
  const perNode = {} as Record<HarnessState, NodeStatus>;
  for (const s of HARNESS_STATES) {
    perNode[s] = makeNodeStatus(state, s, enteredAt, now);
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
  };

  const etag = Buffer.from(
    JSON.stringify({ s: state, u: issue.updated_at, d: deployInfo?.conclusion }),
  ).toString('base64url').slice(0, 32);

  return {
    issueId: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state,
    enteredAt,
    stayedMs: now - new Date(enteredAt).getTime(),
    perNode,
    meta,
    degraded: false,
    etag,
  };
}
