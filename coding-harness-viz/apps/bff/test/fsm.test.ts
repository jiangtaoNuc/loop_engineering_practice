import { describe, it, expect } from 'vitest';
import { deriveState } from '../src/services/fsm.js';
import type { MulticaIssue, MulticaComment, MulticaMetadata } from '../src/services/multica-cli.js';
import type { PrInfo, DeployInfo } from '../src/services/github.js';

function makeIssue(overrides: Partial<MulticaIssue> = {}): MulticaIssue {
  return {
    id: 'issue-1',
    identifier: 'LOO-1',
    title: 'test issue',
    status: 'in_progress',
    assignee_id: 'agent-1',
    assignee_type: 'agent',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const noComments: MulticaComment[] = [];
const noMetadata: MulticaMetadata = {};

describe('deriveState — terminal issue.status short-circuit', () => {
  it('done + no PR + no deploy → deployed', () => {
    const result = deriveState(
      makeIssue({ status: 'done' }),
      noComments,
      noMetadata,
      null,
      null,
    );
    expect(result.state).toBe('deployed');
  });

  it('done + PR merged + no deploy → pr_merged', () => {
    const prInfo: PrInfo = {
      state: 'closed',
      draft: false,
      merged: true,
      mergeCommitSha: 'sha123',
      headSha: 'sha123',
      author: 'bot',
      ciStatus: 'pass',
      reviewDecision: 'APPROVED',
    };
    const result = deriveState(
      makeIssue({ status: 'done' }),
      noComments,
      { pr_url: 'https://github.com/foo/bar/pull/1' },
      prInfo,
      null,
    );
    expect(result.state).toBe('pr_merged');
  });

  it('done + PR + deploy success → deployed', () => {
    const prInfo: PrInfo = {
      state: 'closed',
      draft: false,
      merged: true,
      mergeCommitSha: 'sha123',
      headSha: 'sha123',
      author: 'bot',
      ciStatus: 'pass',
      reviewDecision: 'APPROVED',
    };
    const deployInfo: DeployInfo = {
      conclusion: 'success',
      runUrl: 'https://github.com/foo/bar/actions/runs/1',
      deployUrl: null,
    };
    const result = deriveState(
      makeIssue({ status: 'done' }),
      noComments,
      { pr_url: 'https://github.com/foo/bar/pull/1' },
      prInfo,
      deployInfo,
    );
    expect(result.state).toBe('deployed');
  });
});

describe('deriveState — regression: in-progress without PR', () => {
  it('in_progress + agent assigned + no PR → agent_picked_up', () => {
    const result = deriveState(
      makeIssue({ status: 'in_progress' }),
      noComments,
      noMetadata,
      null,
      null,
    );
    expect(result.state).toBe('agent_picked_up');
  });

  it('cancelled + no PR → issue_created', () => {
    const result = deriveState(
      makeIssue({ status: 'cancelled' }),
      noComments,
      noMetadata,
      null,
      null,
    );
    expect(result.state).toBe('issue_created');
  });
});
