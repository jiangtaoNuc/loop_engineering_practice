import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { HarnessState } from '@coding-harness/shared';

const MAX_TRANSITIONS = 200;

export interface Transition {
  fromState: HarnessState;
  toState: HarnessState;
  at: string;
}

function getDataDir(): string {
  return process.env.HARNESS_DATA_DIR ?? join(process.cwd(), 'data');
}

function transitionsPath(issueId: string): string {
  return join(getDataDir(), 'transitions', `${issueId}.json`);
}

export async function recordTransition(
  issueId: string,
  fromState: HarnessState,
  toState: HarnessState,
  atIso: string,
): Promise<void> {
  const transitions = await getTransitions(issueId);
  transitions.push({ fromState, toState, at: atIso });
  if (transitions.length > MAX_TRANSITIONS) {
    transitions.splice(0, transitions.length - MAX_TRANSITIONS);
  }

  const path = transitionsPath(issueId);
  await mkdir(dirname(path), { recursive: true });

  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, JSON.stringify(transitions, null, 2) + '\n', 'utf-8');
  await rename(tmpPath, path);
}

export async function getTransitions(issueId: string): Promise<Transition[]> {
  try {
    const raw = await readFile(transitionsPath(issueId), 'utf-8');
    const parsed = JSON.parse(raw) as Transition[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return [];
    console.error(`Failed to read transitions for ${issueId}:`, err);
    return [];
  }
}
