export type HarnessState =
  | 'issue_created'
  | 'agent_picked_up'
  | 'coding'
  | 'pr_opened'
  | 'pr_merged'
  | 'deployed';

export const HARNESS_STATES: HarnessState[] = [
  'issue_created',
  'agent_picked_up',
  'coding',
  'pr_opened',
  'pr_merged',
  'deployed',
];

export const STATE_LABELS: Record<HarnessState, string> = {
  issue_created: 'Issue Created',
  agent_picked_up: 'Agent Picked Up',
  coding: 'Coding',
  pr_opened: 'PR Opened',
  pr_merged: 'PR Merged',
  deployed: 'Deployed',
};

export const STATE_SHORT: Record<HarnessState, string> = {
  issue_created: 'S1',
  agent_picked_up: 'S2',
  coding: 'S3',
  pr_opened: 'S4',
  pr_merged: 'S5',
  deployed: 'S6',
};

export interface NodeStatus {
  state: HarnessState;
  enteredAt: string | null;
  leftAt: string | null;
  stayedMs: number;
}

export interface HarnessMeta {
  prUrl: string | null;
  deployUrl: string | null;
  assignee: string | null;
  lastComment: string | null;
  ciStatus: 'pass' | 'fail' | 'pending' | null;
  prDraft: boolean;
  prMerged: boolean;
  prClosed: boolean;
  deployFailed: boolean;
}

export interface HarnessSnapshot {
  issueId: string;
  identifier: string;
  title: string;
  state: HarnessState;
  enteredAt: string | null;
  stayedMs: number;
  perNode: Record<HarnessState, NodeStatus>;
  meta: HarnessMeta;
  degraded: boolean;
  etag: string;
}

export interface IssueSummary {
  id: string;
  identifier: string;
  title: string;
  status: string;
  updatedAt: string;
}

export interface IssuesListResponse {
  issues: IssueSummary[];
  etag: string;
}

export interface HealthResponse {
  ok: boolean;
  multicaCli: boolean;
  github: boolean;
}
