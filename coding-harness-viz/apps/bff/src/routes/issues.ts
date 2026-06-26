import type { FastifyInstance } from 'fastify';
import type { IssuesListResponse, IssueSummary, CodingStats } from '@coding-harness/shared';
import * as multica from '../services/multica-cli.js';
import * as github from '../services/github.js';
import { deriveState, buildSnapshot } from '../services/fsm.js';
import { getTransitions, recordTransition } from '../services/transitions.js';
import { extractCodingStats } from '../services/coding-stats.js';

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
        stayedMs: 0,
        totalDurationMs: 0,
        creatorId: null,
        creatorType: null,
        perNode: {},
        meta: {
          prUrl: null, deployUrl: null, assignee: null, lastComment: null, ciStatus: null,
          prDraft: false, prMerged: false, prClosed: false, deployFailed: false,
          prTitle: null, prMergedAt: null, prMergeSha: null, prReviewDecision: null,
          deployConclusion: null, deployStartedAt: null, deployCompletedAt: null,
        },
        degraded: true,
        etag: 'error',
      });
    }
  });

  app.get('/api/issues/:id/coding-stats', async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const comments = await multica.getCommentsForCodingStats(id);
      const stats: CodingStats = extractCodingStats(comments);
      return stats;
    } catch (err) {
      console.error(`GET /api/issues/${id}/coding-stats failed:`, err);
      const stats: CodingStats = {
        available: false,
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        turns: 0,
      };
      return reply.code(200).send(stats);
    }
  });
}
