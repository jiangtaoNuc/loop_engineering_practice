import { Octokit } from '@octokit/rest';
import { cache } from './cache.js';

const GITHUB_TTL_MS = 10_000;

let octokit: Octokit | null = null;

function getClient(): Octokit | null {
  if (octokit) return octokit;
  const token = process.env.GITHUB_TOKEN;
  if (!token || token === 'ghp_your_token_here') return null;
  octokit = new Octokit({ auth: token });
  return octokit;
}

export interface PrInfo {
  state: string;
  draft: boolean;
  merged: boolean;
  mergeCommitSha: string | null;
  headSha: string;
  author: string;
  ciStatus: 'pass' | 'fail' | 'pending' | null;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | null;
  createdAt: string | null;
  mergedAt: string | null;
  ciStartedAt: string | null;
}

export interface DeployInfo {
  conclusion: string | null;
  runUrl: string | null;
  deployUrl: string | null;
  startedAt: string | null;
}

export function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

export async function getPrInfo(prUrl: string): Promise<PrInfo | null> {
  const client = getClient();
  if (!client) return null;

  const parsed = parsePrUrl(prUrl);
  if (!parsed) return null;

  const key = `gh:pr:${parsed.owner}/${parsed.repo}/${parsed.number}`;
  const cached = cache.get<PrInfo>(key);
  if (cached) return cached;

  try {
    const { data: pr } = await client.pulls.get({
      owner: parsed.owner,
      repo: parsed.repo,
      pull_number: parsed.number,
    });

    let ciStatus: 'pass' | 'fail' | 'pending' | null = null;
    let ciStartedAt: string | null = null;
    try {
      const { data: checks } = await client.checks.listForRef({
        owner: parsed.owner,
        repo: parsed.repo,
        ref: pr.head.sha,
      });
      if (checks.check_runs.length > 0) {
        const conclusions = checks.check_runs.map((c) => c.conclusion);
        if (conclusions.some((c) => c === 'failure')) ciStatus = 'fail';
        else if (conclusions.every((c) => c === 'success')) ciStatus = 'pass';
        else ciStatus = 'pending';

        const startedDates = checks.check_runs
          .map((c) => c.started_at)
          .filter((d): d is string => d != null)
          .sort();
        ciStartedAt = startedDates[0] ?? null;
      }
    } catch {
      // ignore check failures
    }

    let reviewDecision: PrInfo['reviewDecision'] = null;
    try {
      const { data: reviews } = await client.pulls.listReviews({
        owner: parsed.owner,
        repo: parsed.repo,
        pull_number: parsed.number,
      });
      if (reviews.length > 0) {
        const last = reviews[reviews.length - 1];
        if (last.state === 'APPROVED') reviewDecision = 'APPROVED';
        else if (last.state === 'CHANGES_REQUESTED') reviewDecision = 'CHANGES_REQUESTED';
        else reviewDecision = 'COMMENTED';
      }
    } catch {
      // ignore
    }

    const info: PrInfo = {
      state: pr.state,
      draft: pr.draft ?? false,
      merged: pr.merged ?? false,
      mergeCommitSha: pr.merge_commit_sha ?? null,
      headSha: pr.head.sha,
      author: pr.user?.login ?? 'unknown',
      ciStatus,
      reviewDecision,
      createdAt: pr.created_at ?? null,
      mergedAt: pr.merged_at ?? null,
      ciStartedAt,
    };

    cache.set(key, info, GITHUB_TTL_MS);
    return info;
  } catch (err) {
    console.error(`GitHub PR fetch failed:`, err);
    return null;
  }
}

export async function getDeployInfo(
  mergeSha: string,
  owner: string,
  repo: string,
  workflowFile: string,
): Promise<DeployInfo | null> {
  const client = getClient();
  if (!client) return null;

  const key = `gh:deploy:${owner}/${repo}/${mergeSha}`;
  const cached = cache.get<DeployInfo>(key);
  if (cached) return cached;

  try {
    const { data } = await client.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowFile,
      head_sha: mergeSha,
    });

    if (data.workflow_runs.length === 0) {
      return null;
    }

    const run = data.workflow_runs[0];
    const info: DeployInfo = {
      conclusion: run.conclusion,
      runUrl: run.html_url,
      deployUrl: null,
      startedAt: run.run_started_at ?? null,
    };

    cache.set(key, info, GITHUB_TTL_MS);
    return info;
  } catch (err) {
    console.error(`GitHub deploy fetch failed:`, err);
    return null;
  }
}

export async function checkGithub(): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    await client.rateLimit.get();
    return true;
  } catch {
    return false;
  }
}
