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
  durationSec: number;
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
  prTitle: string | null;
  prMergedAt: string | null;
  prMergeSha: string | null;
  prReviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | null;
  deployConclusion: string | null;
  deployStartedAt: string | null;
  deployCompletedAt: string | null;
}

export interface HarnessSnapshot {
  issueId: string;
  identifier: string;
  title: string;
  state: HarnessState;
  enteredAt: string | null;
  stayedMs: number;
  totalDurationMs: number;
  creatorId: string | null;
  creatorType: string | null;
  perNode: Record<HarnessState, NodeStatus>;
  meta: HarnessMeta;
  degraded: boolean;
  etag: string;
}

export interface CodingStats {
  available: boolean;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  turns: number;
  sampleCommentId?: string;
  sampleAt?: string;
}

export interface IssueSummary {
  id: string;
  identifier: string;
  title: string;
  status: string;
  updatedAt: string;
}

export type IssueStatus =
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'blocked'
  | 'backlog'
  | 'cancelled';

export const ISSUE_STATUSES: IssueStatus[] = [
  'todo',
  'in_progress',
  'in_review',
  'done',
  'blocked',
  'backlog',
  'cancelled',
];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  todo: 'TODO',
  in_progress: 'IN PROGRESS',
  in_review: 'IN REVIEW',
  done: 'DONE',
  blocked: 'BLOCKED',
  backlog: 'BACKLOG',
  cancelled: 'CANCELLED',
};

export const STATUS_FILTER_ALL = 'all';

export interface IssueListQuery {
  includeAutopilot?: boolean;
}

export interface IssuesListResponse {
  issues: IssueSummary[];
  etag: string;
  degraded?: boolean;
}

export interface HealthResponse {
  ok: boolean;
  multicaCli: boolean;
  github: boolean;
}
