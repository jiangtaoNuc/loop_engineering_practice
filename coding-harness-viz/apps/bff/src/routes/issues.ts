import type { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  IssuesListResponse,
  IssueSummary,
  IssuesGraphResponse,
  IssueNode,
  IssueEdge,
  StatusTimelineResponse,
  StatusTimelineEntry,
  MulticaStatus,
  CodingStatsResponse,
  BatchDeleteResponse,
} from '@coding-harness/shared';
import { MULTICA_STATUSES } from '@coding-harness/shared';
import * as multica from '../services/multica-cli.js';
import { isCliTimeoutError } from '../services/multica-cli.js';
import * as github from '../services/github.js';
import { deriveState, buildSnapshot, extractPrUrl } from '../services/fsm.js';
import { getTransitions, recordTransition } from '../services/transitions.js';
import { extractCodingStats } from '../services/coding-stats.js';
import { isMockMode, mockGetHarness } from '../services/mock.js';
import { SRE_AUTOPILOT_AGENT_ID, ISSUE_LIST_LIMIT } from '../constants.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function withinLast30Days(updatedAt: string): boolean {
  const updated = new Date(updatedAt).getTime();
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  return updated >= cutoff;
}

function isMulticaStatus(value: string): value is MulticaStatus {
  return MULTICA_STATUSES.includes(value as MulticaStatus);
}

function parseStatusFilter(raw: string | undefined): MulticaStatus[] | null {
  if (!raw || raw.trim() === '') return null;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const statuses = parts.filter(isMulticaStatus);
  return statuses.length > 0 ? statuses : null;
}

export async function issueRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/issues', async (req, reply) => {
    try {
      const query = req.query as { include_autopilot?: string; status?: string };
      const includeAutopilot = query.include_autopilot === '1';
      const statusFilter = query.status;

      const issues = await multica.listIssues(statusFilter);

      // Non-autopilot issues are always shown. Autopilot issues (by assignee or creator)
      // are hidden unless they have a PR URL or the user explicitly opts in via include_autopilot=1.
      const filteredPromises = issues.map(async (issue) => {
        const isAutopilot =
          issue.assignee_id === SRE_AUTOPILOT_AGENT_ID ||
          issue.creator_id === SRE_AUTOPILOT_AGENT_ID;
        if (!isAutopilot) return issue;

        if (includeAutopilot) return issue;

        const metadata = await multica.getMetadata(issue.id);
        if (metadata.pr_url && typeof metadata.pr_url === 'string') return issue;

        const comments = await multica.getAllComments(issue.id);
        const prUrl = extractPrUrl(metadata, comments);
        if (prUrl) return issue;

        return null;
      });
      const results = await Promise.all(filteredPromises);
      const filtered = results.filter((i): i is multica.MulticaIssue => i !== null);

      const summaries: IssueSummary[] = filtered
        .filter((i) => withinLast30Days(i.updated_at))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, ISSUE_LIST_LIMIT)
        .map((i) => ({
          id: i.id,
          identifier: i.identifier,
          title: i.title,
          status: i.status,
          updatedAt: i.updated_at,
        }));

      const body: IssuesListResponse = {
        issues: summaries,
        etag: Buffer.from(JSON.stringify(summaries.map((s) => s.updatedAt)))
          .toString('base64url')
          .slice(0, 32),
      };

      reply.header('ETag', `"${body.etag}"`);
      return body;
    } catch (err) {
      console.error('GET /api/issues failed:', err);
      return reply.code(200).send({ issues: [], etag: 'empty', degraded: true });
    }
  });

  app.get('/api/issues/graph', async (req: FastifyRequest<{ Querystring: { status?: string } }>, reply) => {
    try {
      const issues = await multica.listIssues();
      const allowedStatuses = parseStatusFilter(req.query.status) ?? MULTICA_STATUSES;

      const filtered = issues.filter((i) => isMulticaStatus(i.status) && allowedStatuses.includes(i.status));

      const nodes: IssueNode[] = filtered.map((i) => ({
        id: i.id,
        identifier: i.identifier,
        title: i.title,
        status: i.status as MulticaStatus,
        parentIssueId: i.parent_issue_id,
      }));

      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges: IssueEdge[] = [];
      for (const node of nodes) {
        if (node.parentIssueId && nodeIds.has(node.parentIssueId)) {
          edges.push({
            id: `${node.parentIssueId}->${node.id}`,
            source: node.parentIssueId,
            target: node.id,
          });
        }
      }

      const body: IssuesGraphResponse = {
        nodes,
        edges,
        etag: Buffer.from(JSON.stringify({ count: nodes.length, edgeCount: edges.length }))
          .toString('base64url')
          .slice(0, 32),
      };

      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === `"${body.etag}"`) {
        return reply.code(304).send();
      }

      reply.header('ETag', `"${body.etag}"`);
      return body;
    } catch (err) {
      console.error('GET /api/issues/graph failed:', err);
      return reply.code(200).send({ nodes: [], edges: [], etag: 'empty' });
    }
  });

  app.get('/api/issues/:id/timeline', async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const [issue, runs] = await Promise.all([
        multica.getIssue(id),
        multica.getIssueRuns(id),
      ]);

      const timeline = buildTimeline(issue, runs);

      const body: StatusTimelineResponse = {
        issueId: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        timeline,
      };

      return body;
    } catch (err) {
      console.error(`GET /api/issues/${id}/timeline failed:`, err);
      return reply.code(200).send({
        issueId: id,
        identifier: '???',
        title: 'Error loading timeline',
        timeline: [],
      });
    }
  });

  app.post('/api/issues', async (req, reply) => {
    const { title } = (req.body as { title?: string }) ?? {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return reply.code(400).send({ error: 'title is required' });
    }
    try {
      const issue = await multica.createIssue(title.trim());
      const summary: IssueSummary = {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
        updatedAt: issue.updated_at,
      };
      return reply.code(201).send(summary);
    } catch (err) {
      console.error('POST /api/issues failed:', err);
      return reply.code(500).send({ error: 'failed to create issue' });
    }
  });

  app.delete('/api/issues/batch', async (req, reply) => {
    const { ids } = (req.body as { ids?: string[] }) ?? {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: 'ids must be a non-empty array' });
    }
    if (ids.length > 50) {
      return reply.code(400).send({ error: 'maximum 50 issues per batch' });
    }

    try {
      const results = await multica.deleteIssues(ids);
      const deleted = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const body: BatchDeleteResponse = { results, deleted, failed };
      return reply.code(failed > 0 && deleted === 0 ? 500 : 200).send(body);
    } catch (err) {
      console.error('DELETE /api/issues/batch failed:', err);
      return reply.code(500).send({ error: 'batch delete failed' });
    }
  });

  app.delete('/api/issues/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await multica.deleteIssue(id);
      return reply.code(204).send();
    } catch (err) {
      console.error(`DELETE /api/issues/${id} failed:`, err);
      return reply.code(500).send({ error: 'delete failed' });
    }
  });

  app.get('/api/issues/:id/harness', async (req, reply) => {
    const { id } = req.params as { id: string };

    if (isMockMode()) {
      const snap = mockGetHarness(id);
      if (!snap) {
        return reply.code(404).send({ error: 'Mock issue not found' });
      }
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === `"${snap.etag}"`) {
        return reply.code(304).send();
      }
      reply.header('ETag', `"${snap.etag}"`);
      return snap;
    }

    try {
      const [issue, comments, metadata] = await Promise.all([
        multica.getIssue(id),
        multica.getAllComments(id),
        multica.getMetadata(id),
      ]);

      const prUrl = extractPrUrl(metadata, comments);
      const prInfo = prUrl ? await github.getPrInfo(prUrl) : null;

      let deployInfo = null;
      if (prInfo?.merged && prInfo.mergeCommitSha) {
        const parsed = prUrl ? github.parsePrUrl(prUrl) : null;
        const owner = parsed?.owner ?? process.env.GITHUB_OWNER ?? '';
        const repo = parsed?.repo ?? process.env.GITHUB_REPO ?? '';
        const wf = process.env.DEPLOY_WORKFLOW_FILE ?? 'deploy.yml';
        deployInfo = await github.getDeployInfo(prInfo.mergeCommitSha, owner, repo, wf);
      }

      let agentName: string | null = null;
      if (issue.assignee_id && issue.assignee_type === 'agent') {
        const agent = await multica.getAgent(issue.assignee_id);
        agentName = agent?.name ?? null;
      }

      const { state } = deriveState(issue, comments, metadata, prInfo, deployInfo);
      const transitions = await getTransitions(id);
      const lastToState = transitions[transitions.length - 1]?.toState ?? 'issue_created';
      if (state !== lastToState) {
        await recordTransition(id, lastToState, state, new Date().toISOString());
        transitions.push({ fromState: lastToState, toState: state, at: new Date().toISOString() });
      }

      const snapshot = buildSnapshot(issue, comments, metadata, prInfo, deployInfo, agentName, transitions);

      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === `"${snapshot.etag}"`) {
        return reply.code(304).send();
      }

      reply.header('ETag', `"${snapshot.etag}"`);
      return snapshot;
    } catch (err) {
      console.error(`GET /api/issues/${id}/harness failed:`, err);
      return reply.code(200).send({
        issueId: id,
        identifier: '???',
        title: 'Error loading issue',
        state: 'issue_created',
        enteredAt: null,
        totalDurationMs: 0,
        creatorType: null,
        creatorId: null,
        perNode: {},
        meta: {
          prUrl: null, deployUrl: null, assignee: null, lastComment: null, ciStatus: null,
          prDraft: false, prMerged: false, prClosed: false, deployFailed: false,
          issueCancelled: false, prTitle: null, prMergedAt: null, prMergeSha: null,
          prReviewDecision: null, deployConclusion: null, deployStartedAt: null,
          deployCompletedAt: null,
        },
        agentPickedUpAt: null,
        agentPickedUpSource: 'fallback',
        degraded: true,
        etag: 'error',
      });
    }
  });

  app.get('/api/issues/:id/coding-stats', async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const comments = await multica.getCommentsForCodingStats(id);
      const stats = extractCodingStats(comments);
      const body: CodingStatsResponse = { issueId: id, stats };
      return body;
    } catch (err) {
      console.error(`GET /api/issues/${id}/coding-stats failed:`, err);
      if (isCliTimeoutError(err)) {
        return reply.code(504).send({
          error: 'multica CLI timeout',
          detail: err.message,
        });
      }
      return reply.code(200).send({
        issueId: id,
        stats: {
          available: false,
          startedAt: null,
          endedAt: null,
          durationSec: null,
          toolCalls: null,
          events: null,
          turns: null,
        },
      });
    }
  });
}

function buildTimeline(issue: multica.MulticaIssue, runs: multica.MulticaRun[]): StatusTimelineEntry[] {
  const currentStatus = isMulticaStatus(issue.status) ? issue.status : 'todo';
  const createdAt = issue.created_at;
  const updatedAt = issue.updated_at;

  const sortedRuns = runs
    .filter((r) => r.started_at != null)
    .sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime());

  const timeline: StatusTimelineEntry[] = [];

  if (sortedRuns.length === 0) {
    timeline.push({
      status: currentStatus,
      startedAt: createdAt,
      endedAt: null,
      inferred: true,
    });
    return timeline;
  }

  const firstRunStart = sortedRuns[0].started_at!;
  const initialStatus: MulticaStatus = currentStatus === 'backlog' ? 'backlog' : 'todo';

  if (new Date(createdAt).getTime() < new Date(firstRunStart).getTime()) {
    timeline.push({
      status: initialStatus,
      startedAt: createdAt,
      endedAt: firstRunStart,
      inferred: true,
    });
  }

  for (let i = 0; i < sortedRuns.length; i++) {
    const run = sortedRuns[i];
    const startedAt = run.started_at!;
    let endedAt: string | null = run.completed_at;

    if (!endedAt) {
      const nextRun = sortedRuns[i + 1];
      endedAt = nextRun?.started_at ?? updatedAt;
    }

    timeline.push({
      status: 'in_progress',
      startedAt,
      endedAt,
      inferred: true,
    });
  }

  const lastEntry = timeline[timeline.length - 1];
  let currentStartedAt = lastEntry?.endedAt ?? updatedAt;

  if (new Date(currentStartedAt).getTime() < new Date(updatedAt).getTime()) {
    currentStartedAt = updatedAt;
  }

  timeline.push({
    status: currentStatus,
    startedAt: currentStartedAt,
    endedAt: null,
    inferred: true,
  });

  return timeline;
}
