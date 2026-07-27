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
} from '@coding-harness/shared';
import { MULTICA_STATUSES } from '@coding-harness/shared';
import * as multica from '../services/multica-cli.js';
import * as github from '../services/github.js';
import { buildSnapshot } from '../services/fsm.js';

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
  app.get('/api/issues', async (_req, reply) => {
    try {
      const issues = await multica.listIssues();
      const summaries: IssueSummary[] = issues
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 20)
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

  app.get('/api/issues/:id/harness', async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const [issue, comments, metadata] = await Promise.all([
        multica.getIssue(id),
        multica.getComments(id),
        multica.getMetadata(id),
      ]);

      const prUrl = metadata.pr_url as string | null;
      const prInfo = prUrl ? await github.getPrInfo(prUrl) : null;

      let deployInfo = null;
      if (prInfo?.merged && prInfo.mergeCommitSha) {
        const owner = process.env.GITHUB_OWNER ?? '';
        const repo = process.env.GITHUB_REPO ?? '';
        const wf = process.env.DEPLOY_WORKFLOW_FILE ?? 'deploy.yml';
        deployInfo = await github.getDeployInfo(prInfo.mergeCommitSha, owner, repo, wf);
      }

      let agentName: string | null = null;
      if (issue.assignee_id && issue.assignee_type === 'agent') {
        const agent = await multica.getAgent(issue.assignee_id);
        agentName = agent?.name ?? null;
      }

      const snapshot = buildSnapshot(issue, comments, metadata, prInfo, deployInfo, agentName);

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
        stayedMs: 0,
        perNode: {},
        meta: { prUrl: null, deployUrl: null, assignee: null, lastComment: null, ciStatus: null, prDraft: false, prMerged: false, prClosed: false, deployFailed: false },
        degraded: true,
        etag: 'error',
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
