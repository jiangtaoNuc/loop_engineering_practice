import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { issueRoutes } from '../issues.js';

vi.mock('../../services/multica-cli.js', () => ({
  listIssues: vi.fn().mockResolvedValue([]),
  getIssue: vi.fn().mockResolvedValue({}),
  getComments: vi.fn().mockResolvedValue([]),
  getMetadata: vi.fn().mockResolvedValue({}),
  getAgent: vi.fn().mockResolvedValue(null),
  deleteIssue: vi.fn(),
  deleteIssues: vi.fn(),
}));

vi.mock('../../services/github.js', () => ({
  getPrInfo: vi.fn().mockResolvedValue(null),
  getDeployInfo: vi.fn().mockResolvedValue(null),
}));

import * as multica from '../../services/multica-cli.js';

const mockDeleteIssue = vi.mocked(multica.deleteIssue);
const mockDeleteIssues = vi.mocked(multica.deleteIssues);

describe('DELETE /api/issues/:id', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(issueRoutes);
    await app.ready();
  });

  it('returns 204 on successful delete', async () => {
    mockDeleteIssue.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/issues/test-id-123',
    });

    expect(res.statusCode).toBe(204);
    expect(mockDeleteIssue).toHaveBeenCalledWith('test-id-123');
  });

  it('returns 500 when delete fails', async () => {
    mockDeleteIssue.mockRejectedValue(new Error('CLI error'));

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/issues/bad-id',
    });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'delete failed' });
  });
});

describe('DELETE /api/issues/batch', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(issueRoutes);
    await app.ready();
  });

  it('returns 400 for empty ids array', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/issues/batch',
      payload: { ids: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when ids is not an array', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/issues/batch',
      payload: { ids: 'not-array' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for more than 50 ids', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/issues/batch',
      payload: { ids },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with all results on full success', async () => {
    mockDeleteIssues.mockResolvedValue([
      { id: 'id-1', success: true },
      { id: 'id-2', success: true },
    ]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/issues/batch',
      payload: { ids: ['id-1', 'id-2'] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.deleted).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.results).toHaveLength(2);
  });

  it('returns 200 with partial failure results', async () => {
    mockDeleteIssues.mockResolvedValue([
      { id: 'id-1', success: true },
      { id: 'id-2', success: false, error: 'not found' },
    ]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/issues/batch',
      payload: { ids: ['id-1', 'id-2'] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.deleted).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.results[1].error).toBe('not found');
  });

  it('returns 500 when all deletions fail', async () => {
    mockDeleteIssues.mockResolvedValue([
      { id: 'id-1', success: false, error: 'err1' },
      { id: 'id-2', success: false, error: 'err2' },
    ]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/issues/batch',
      payload: { ids: ['id-1', 'id-2'] },
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.deleted).toBe(0);
    expect(body.failed).toBe(2);
  });
});
