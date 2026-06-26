import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HarnessSnapshot, IssuesListResponse, IssueSummary } from '@coding-harness/shared';

interface MockTransition {
  afterSeconds: number;
  harness: HarnessSnapshot;
}

interface MockFixture {
  issues: IssueSummary[];
  harness: HarnessSnapshot;
  transitions?: MockTransition[];
}

let fixture: MockFixture | null = null;
let startTime: number = 0;
let currentTransitionIndex = -1;

export function loadMockFixture(fixturePath: string): void {
  const absPath = resolve(fixturePath);
  const raw = readFileSync(absPath, 'utf-8');
  fixture = JSON.parse(raw) as MockFixture;
  startTime = Date.now();
  currentTransitionIndex = -1;
  console.log(`[mock] Loaded fixture from ${absPath}`);
  if (fixture!.transitions?.length) {
    console.log(`[mock] ${fixture!.transitions.length} transition(s) scheduled`);
  }
}

export function isMockMode(): boolean {
  return fixture !== null;
}

export function mockListIssues(): IssuesListResponse {
  if (!fixture) throw new Error('Mock fixture not loaded');
  const summaries: IssueSummary[] = fixture.issues.map((i) => ({
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    status: i.status,
    updatedAt: i.updatedAt,
  }));
  const etag = Buffer.from(JSON.stringify(summaries.map((s) => s.updatedAt)))
    .toString('base64url')
    .slice(0, 32);
  return { issues: summaries, etag };
}

export function mockGetHarness(issueId: string): HarnessSnapshot | null {
  if (!fixture) throw new Error('Mock fixture not loaded');

  const elapsed = (Date.now() - startTime) / 1000;
  const transitions = fixture.transitions ?? [];

  let activeHarness = fixture.harness;
  for (let i = transitions.length - 1; i >= 0; i--) {
    if (elapsed >= transitions[i].afterSeconds && i > currentTransitionIndex) {
      currentTransitionIndex = i;
      activeHarness = transitions[i].harness;
      break;
    }
  }

  if (activeHarness.issueId !== issueId) return null;
  return activeHarness;
}
