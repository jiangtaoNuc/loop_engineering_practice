import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { issueRoutes } from './issues.js';
import type { MulticaIssue, MulticaComment, MulticaMetadata } from '../services/multica-cli.js';

vi.mock('../services/multica-cli.js', () => ({
  listIssues: vi.fn(),
  getMetadata: vi.fn(),
  getComments: vi.fn(),
  getAllComments: vi.fn(),
}));

vi.mock('../services/github.js', () => ({
  getPrInfo: vi.fn(),
  getDeployInfo: vi.fn(),
}));

import * as multica from '../services/multica-cli.js';
import { SRE_AUTOPILOT_AGENT_ID, ISSUE_LIST_LIMIT } from '../constants.js';

function makeIssue(overrides: Partial<MulticaIssue> & { id: string; identifier: string }): MulticaIssue {
  return {
    title: `Issue ${overrides.identifier}`,
    status: 'todo',
    assignee_id: null,
    assignee_type: null,
    creator_id: null,
    creator_type: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(issueRoutes);
  return app;
}

describe('GET /api/issues', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filters out autopilot issues with no PR by default', async () => {
    const autopilotIssue = makeIssue({
      id: 'ap-1',
      identifier: 'LOO-99',
      assignee_id: SRE_AUTOPILOT_AGENT_ID,
      assignee_type: 'agent',
      updated_at: '2026-06-01T00:00:00Z',
    });
    const normalIssue = makeIssue({
      id: 'norm-1',
      identifier: 'LOO-10',
      assignee_id: 'some-other-agent',
      assignee_type: 'agent',
      updated_at: '2026-05-01T00:00:00Z',
    });

    vi.mocked(multica.listIssues).mockResolvedValue([autopilotIssue, normalIssue]);
    vi.mocked(multica.getMetadata).mockImplementation(async (id: string) =>
      id === 'norm-1'
        ? ({ pr_url: 'https://github.com/foo/bar/pull/1' } as MulticaMetadata)
        : ({} as MulticaMetadata)
    );
    vi.mocked(multica.getAllComments).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/issues' });
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].identifier).toBe('LOO-10');
  });

  it('includes autopilot issues when include_autopilot=1', async () => {
    const autopilotIssue = makeIssue({
      id: 'ap-1',
      identifier: 'LOO-99',
      assignee_id: SRE_AUTOPILOT_AGENT_ID,
      assignee_type: 'agent',
      updated_at: '2026-06-01T00:00:00Z',
    });
    const normalIssue = makeIssue({
      id: 'norm-1',
      identifier: 'LOO-10',
      updated_at: '2026-05-01T00:00:00Z',
    });

    vi.mocked(multica.listIssues).mockResolvedValue([autopilotIssue, normalIssue]);
    vi.mocked(multica.getMetadata).mockResolvedValue({
      pr_url: 'https://github.com/foo/bar/pull/1',
    });
    vi.mocked(multica.getAllComments).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/issues?include_autopilot=1' });
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(2);
    const ids = body.issues.map((i: { identifier: string }) => i.identifier);
    expect(ids).toContain('LOO-99');
    expect(ids).toContain('LOO-10');
  });

  it('does not filter autopilot issues that have pr_url in metadata', async () => {
    const autopilotWithPr = makeIssue({
      id: 'ap-pr',
      identifier: 'LOO-50',
      assignee_id: SRE_AUTOPILOT_AGENT_ID,
      assignee_type: 'agent',
      updated_at: '2026-06-01T00:00:00Z',
    });

    vi.mocked(multica.listIssues).mockResolvedValue([autopilotWithPr]);
    vi.mocked(multica.getMetadata).mockResolvedValue({
      pr_url: 'https://github.com/foo/bar/pull/42',
    });
    vi.mocked(multica.getAllComments).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/issues' });
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].identifier).toBe('LOO-50');
  });

  it('does not filter autopilot issues that have a PR URL in comments', async () => {
    const autopilotWithPrComment = makeIssue({
      id: 'ap-cmt',
      identifier: 'LOO-51',
      assignee_id: SRE_AUTOPILOT_AGENT_ID,
      assignee_type: 'agent',
      updated_at: '2026-06-01T00:00:00Z',
    });

    vi.mocked(multica.listIssues).mockResolvedValue([autopilotWithPrComment]);
    vi.mocked(multica.getMetadata).mockResolvedValue({});
    vi.mocked(multica.getAllComments).mockResolvedValue([
      {
        id: 'c1',
        content: 'Opened PR https://github.com/foo/bar/pull/99 for this.',
        author_id: 'x',
        author_type: 'agent',
        created_at: '2026-06-01T00:00:00Z',
      },
    ] as MulticaComment[]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/issues' });
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].identifier).toBe('LOO-51');
  });

  it('filters out autopilot-created issues with no PR by default', async () => {
    const autopilotCreatedIssue = makeIssue({
      id: 'ap-created',
      identifier: 'LOO-100',
      creator_id: SRE_AUTOPILOT_AGENT_ID,
      creator_type: 'agent',
      updated_at: '2026-06-01T00:00:00Z',
    });
    const normalIssue = makeIssue({
      id: 'norm-1',
      identifier: 'LOO-10',
      updated_at: '2026-05-01T00:00:00Z',
    });

    vi.mocked(multica.listIssues).mockResolvedValue([autopilotCreatedIssue, normalIssue]);
    vi.mocked(multica.getMetadata).mockImplementation(async (id: string) =>
      id === 'norm-1'
        ? ({ pr_url: 'https://github.com/foo/bar/pull/1' } as MulticaMetadata)
        : ({} as MulticaMetadata)
    );
    vi.mocked(multica.getAllComments).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/issues' });
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].identifier).toBe('LOO-10');
  });

  it('includes autopilot-created issues when include_autopilot=1', async () => {
    const autopilotCreatedIssue = makeIssue({
      id: 'ap-created',
      identifier: 'LOO-100',
      creator_id: SRE_AUTOPILOT_AGENT_ID,
      creator_type: 'agent',
      updated_at: '2026-06-01T00:00:00Z',
    });
    const normalIssue = makeIssue({
      id: 'norm-1',
      identifier: 'LOO-10',
      updated_at: '2026-05-01T00:00:00Z',
    });

    vi.mocked(multica.listIssues).mockResolvedValue([autopilotCreatedIssue, normalIssue]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/issues?include_autopilot=1' });
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(2);
    const ids = body.issues.map((i: { identifier: string }) => i.identifier);
    expect(ids).toContain('LOO-100');
    expect(ids).toContain('LOO-10');
  });

  it('does not filter autopilot-created issues that have pr_url in metadata', async () => {
    const autopilotCreatedWithPr = makeIssue({
      id: 'ap-created-pr',
      identifier: 'LOO-101',
      creator_id: SRE_AUTOPILOT_AGENT_ID,
      creator_type: 'agent',
      updated_at: '2026-06-01T00:00:00Z',
    });

    vi.mocked(multica.listIssues).mockResolvedValue([autopilotCreatedWithPr]);
    vi.mocked(multica.getMetadata).mockResolvedValue({
      pr_url: 'https://github.com/foo/bar/pull/42',
    });
    vi.mocked(multica.getAllComments).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/issues' });
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].identifier).toBe('LOO-101');
  });

  it('caps the result list at ISSUE_LIST_LIMIT (50)', async () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      makeIssue({
        id: `n-${i}`,
        identifier: `LOO-${i}`,
        updated_at: new Date(Date.now() - i * 1000).toISOString(),
      }),
    );

    vi.mocked(multica.listIssues).mockResolvedValue(many);
    vi.mocked(multica.getMetadata).mockResolvedValue({
      pr_url: 'https://github.com/foo/bar/pull/1',
    });
    vi.mocked(multica.getAllComments).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/issues' });
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(ISSUE_LIST_LIMIT);
    expect(ISSUE_LIST_LIMIT).toBe(50);
  });
});
