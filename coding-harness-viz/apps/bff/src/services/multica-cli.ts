import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cache } from './cache.js';

const execFileAsync = promisify(execFile);

const MULTICA_TTL_MS = 5_000;
const MULTICA_STALE_TTL_MS = 30_000;

async function runMultica(args: string[]): Promise<string> {
  const key = `multica:${args.join(' ')}`;
  const staleKey = `stale:${key}`;
  const cached = cache.get<string>(key);
  if (cached) return cached;

  try {
    const { stdout } = await execFileAsync('multica', args, {
      timeout: 15_000,
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
        err instanceof Error ? err.message : err,
      );
      return stale;
    }
    console.error(
      `[${new Date().toISOString()}] multica ${args.join(' ')} failed (no stale cache):`,
      err instanceof Error ? err.message : err,
    );
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
  created_at: string;
  updated_at: string;
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

const ISSUE_LIST_LIMIT = 200;

export async function listIssues(): Promise<MulticaIssue[]> {
  const raw = await runMultica([
    'issue', 'list',
    '--limit', String(ISSUE_LIST_LIMIT),
    '--output', 'json',
  ]);
  const parsed = JSON.parse(raw);
  const issues: MulticaIssue[] = Array.isArray(parsed) ? parsed : parsed.issues ?? [];
  return issues.filter((i) => i.status !== 'cancelled');
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

export async function getMetadata(id: string): Promise<MulticaMetadata> {
  try {
    const raw = await runMultica(['issue', 'metadata', 'list', id, '--output', 'json']);
    return JSON.parse(raw);
  } catch {
    return {};
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

export async function checkCli(): Promise<boolean> {
  try {
    await execFileAsync('multica', ['--version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
