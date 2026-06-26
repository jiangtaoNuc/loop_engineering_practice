import type { CodingStats } from '@coding-harness/shared';
import type { MulticaComment } from './multica-cli.js';

interface ParsedFooter {
  version: 1 | 2;
  startedAt: string | null;
  endedAt: string | null;
  toolCalls: number | null;
  events: number | null;
  turns: number | null;
  commentId: string;
  commentCreatedAt: string;
}

const V2_RE = /<!--\s*coding-stats\s+v2\s*\n([\s\S]*?)-->/;
const V1_RE = /<!--\s*coding-stats\s*\n([\s\S]*?)-->/;

function parseKeyValue(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function parseV2Block(block: string, commentId: string, commentCreatedAt: string): ParsedFooter {
  const kv = parseKeyValue(block);
  return {
    version: 2,
    startedAt: kv.started_at ?? null,
    endedAt: kv.ended_at ?? null,
    toolCalls: kv.tool_calls != null ? parseInt(kv.tool_calls, 10) : null,
    events: kv.events != null ? parseInt(kv.events, 10) : null,
    turns: kv.turns != null ? parseInt(kv.turns, 10) : null,
    commentId,
    commentCreatedAt,
  };
}

function parseV1Block(block: string, commentId: string, commentCreatedAt: string): ParsedFooter {
  const kv = parseKeyValue(block);
  return {
    version: 1,
    startedAt: null,
    endedAt: null,
    toolCalls: kv.tool_calls != null ? parseInt(kv.tool_calls, 10) : null,
    events: null,
    turns: kv.turns != null ? parseInt(kv.turns, 10) : null,
    commentId,
    commentCreatedAt,
  };
}

function parseAllFooters(comments: MulticaComment[]): ParsedFooter[] {
  const footers: ParsedFooter[] = [];
  for (const c of comments) {
    if (c.author_type !== 'agent') continue;
    const v2Match = c.content.match(V2_RE);
    if (v2Match) {
      footers.push(parseV2Block(v2Match[1], c.id, c.created_at));
      continue;
    }
    const v1Match = c.content.match(V1_RE);
    if (v1Match) {
      footers.push(parseV1Block(v1Match[1], c.id, c.created_at));
    }
  }
  return footers;
}

function calcDurationSec(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return null;
  return Math.round((end - start) / 1000);
}

export function extractEarliestStartedAt(comments: MulticaComment[]): string | null {
  const footers = parseAllFooters(comments);
  const v2Started = footers
    .filter((f) => f.version === 2 && f.startedAt)
    .map((f) => f.startedAt!)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return v2Started.length > 0 ? v2Started[0] : null;
}

export function extractCodingStats(comments: MulticaComment[]): CodingStats {
  const footers = parseAllFooters(comments);
  if (footers.length === 0) {
    return {
      available: false,
      startedAt: null,
      endedAt: null,
      durationSec: null,
      toolCalls: null,
      events: null,
      turns: null,
    };
  }

  const latest = footers[footers.length - 1];

  return {
    available: true,
    startedAt: latest.startedAt,
    endedAt: latest.endedAt,
    durationSec: calcDurationSec(latest.startedAt, latest.endedAt),
    toolCalls: latest.toolCalls,
    events: latest.events,
    turns: latest.turns,
    sampleCommentId: latest.commentId,
    sampleAt: latest.commentCreatedAt,
  };
}
