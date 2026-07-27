import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cache } from './cache.js';

const execFileAsync = promisify(execFile);

const MULTICA_TTL_MS = 5_000;
const MULTICA_STALE_TTL_MS = 30_000;
const CLI_TIMEOUT_MS = 15_000;
const ERROR_PREVIEW_CHARS = 200;

export class CliTimeoutError extends Error {
  constructor(
    message: string,
    public readonly command: string,
  ) {
    super(message);
    this.name = 'CliTimeoutError';
  }
}

export function isCliTimeoutError(err: unknown): err is CliTimeoutError {
  return err instanceof CliTimeoutError;
}

function isExecTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if ((err as { killed?: boolean }).killed === true) return true;
  if (/timed?\s*out/i.test(err.message)) return true;
  return false;
}

function truncateError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.length > ERROR_PREVIEW_CHARS
    ? `${message.slice(0, ERROR_PREVIEW_CHARS)}...`
    : message;
}

async function runMulticaNoCache(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('multica', args, {
      timeout: 15_000,
      env: { ...process.env },
    });
    return stdout;
  } catch (err) {
    console.error(`multica ${args.join(' ')} failed:`, err);
    throw err;
  }
}

async function runMultica(args: string[]): Promise<string> {
  const key = `multica:${args.join(' ')}`;
  const staleKey = `stale:${key}`;
  const cached = cache.get<string>(key);
  if (cached) return cached;

  try {
    const { stdout } = await execFileAsync('multica', args, {
      timeout: CLI_TIMEOUT_MS,
      env: { ...process.env },
    });
    cache.set(key, stdout, MULTICA_TTL_MS);
    cache.set(staleKey, stdout, MULTICA_STALE_TTL_MS);
    return stdout;
  } catch (err) {
    const stale = cache.get<string>(staleKey);
    if (stale) {
      console.warn(
        `[${new Date().toISOString()}] multica ${args.join(' ')} failed, serving stale cache`,
        truncateError(err),
      );
      return stale;
    }
    console.error(
      `[${new Date().toISOString()}] multica ${args.join(' ')} failed (no stale cache):`,
      truncateError(err),
    );
    if (isExecTimeout(err)) {
      throw new CliTimeoutError(
        truncateError(err),
        `multica ${args.join(' ')}`,
      );
    }
    throw err;
  }
}

export interface MulticaIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  assignee_id: string | null;
  assignee_type: string | null;
  creator_id: string | null;
  creator_type: string | null;
  created_at: string;
  updated_at: string;
  parent_issue_id: string | null;
  priority: string | null;
  number: number;
}

export interface MulticaComment {
  id: string;
  content: string;
  author_id: string;
  author_type: string;
  created_at: string;
}

export interface MulticaMetadata {
  [key: string]: string | number | boolean;
}

export interface MulticaRun {
  id: string;
  agent_id: string | null;
  attempt: number;
  completed_at: string | null;
  created_at: string;
  dispatched_at: string | null;
  error: string | null;
  issue_id: string;
  kind: string;
  max_attempts: number;
  priority: number;
  result: string | null;
  runtime_id: string;
  started_at: string | null;
  status: string;
  workspace_id: string;
}

interface IssueListPayload {
  issues: MulticaIssue[];
  has_more?: boolean;
  limit?: number;
  offset?: number;
  total?: number;
}

const ISSUE_LIST_PAGE_LIMIT = 200;
const ISSUE_LOOKBACK_DAYS = 30;

export async function listIssues(status?: string): Promise<MulticaIssue[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ISSUE_LOOKBACK_DAYS);
  const cutoffMs = cutoff.getTime();

  const all: MulticaIssue[] = [];
  let offset = 0;

  for (let page = 0; page < 20; page++) {
    const args: string[] = [
      'issue', 'list',
      '--output', 'json',
      '--limit', String(ISSUE_LIST_PAGE_LIMIT),
      '--offset', String(offset),
    ];
    if (status) args.push('--status', status);

    const raw = await runMultica(args);
    const parsed: IssueListPayload = JSON.parse(raw);
    const pageIssues = Array.isArray(parsed) ? parsed : parsed.issues ?? [];

    if (pageIssues.length === 0) break;

    for (const issue of pageIssues) {
      const updatedMs = new Date(issue.updated_at).getTime();
      if (updatedMs >= cutoffMs) {
        all.push(issue);
      }
    }

    const oldestInPage = new Date(pageIssues[pageIssues.length - 1].updated_at).getTime();
    const hasMore = !Array.isArray(parsed) ? (parsed.has_more ?? false) : false;

    if (!hasMore || oldestInPage < cutoffMs) break;

    offset += ISSUE_LIST_PAGE_LIMIT;
  }

  return status ? all : all.filter((i) => i.status !== 'cancelled');
}

export async function getIssue(id: string): Promise<MulticaIssue> {
  const raw = await runMultica(['issue', 'get', id, '--output', 'json']);
  return JSON.parse(raw);
}

export async function getComments(id: string): Promise<MulticaComment[]> {
  const raw = await runMultica([
    'issue', 'comment', 'list', id,
    '--recent', '10',
    '--output', 'json',
  ]);
  return JSON.parse(raw);
}

export async function getAllComments(id: string): Promise<MulticaComment[]> {
  const raw = await runMultica([
    'issue', 'comment', 'list', id,
    '--output', 'json',
  ]);
  return JSON.parse(raw);
}

export async function getCommentsForCodingStats(id: string): Promise<MulticaComment[]> {
  const raw = await runMultica([
    'issue', 'comment', 'list', id,
    '--recent', '50',
    '--output', 'json',
  ]);
  return JSON.parse(raw);
}

export async function getMetadata(id: string): Promise<MulticaMetadata> {
  try {
    const raw = await runMultica(['issue', 'metadata', 'list', id, '--output', 'json']);
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getIssueRuns(id: string): Promise<MulticaRun[]> {
  try {
    const raw = await runMultica(['issue', 'runs', id, '--output', 'json']);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function getAgent(agentId: string): Promise<{ name: string } | null> {
  try {
    const raw = await runMultica(['agent', 'get', agentId, '--output', 'json']);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createIssue(title: string): Promise<MulticaIssue> {
  const raw = await runMultica([
    'issue', 'create', '--title', title, '--output', 'json',
  ]);
  return JSON.parse(raw);
}

export async function deleteIssue(id: string): Promise<void> {
  await runMulticaNoCache(['issue', 'status', id, 'cancelled']);
  cache.invalidatePrefix('multica:');
}

export interface DeleteResult {
  id: string;
  success: boolean;
  error?: string;
}

export async function deleteIssues(ids: string[]): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];
  for (const id of ids) {
    try {
      await runMulticaNoCache(['issue', 'status', id, 'cancelled']);
      results.push({ id, success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id, success: false, error: msg });
    }
  }
  if (results.some((r) => r.success)) {
    cache.invalidatePrefix('multica:');
  }
  return results;
}

export async function checkCli(): Promise<boolean> {
  try {
    await execFileAsync('multica', ['--version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
