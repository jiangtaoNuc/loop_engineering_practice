import type { CodingStats } from '@coding-harness/shared';
import type { MulticaComment } from './multica-cli.js';

const CODING_STATS_RE = /<!-- coding-stats\n([\s\S]*?)-->/;

function parseCodingStatsFooter(content: string): Omit<CodingStats, 'available' | 'sampleCommentId' | 'sampleAt'> | null {
  const match = content.match(CODING_STATS_RE);
  if (!match) return null;

  const block = match[1];
  const pairs: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    pairs[key] = value;
  }

  const toolCalls = parseInt(pairs.tool_calls ?? '', 10);
  const tokensIn = parseInt(pairs.tokens_in ?? '', 10);
  const tokensOut = parseInt(pairs.tokens_out ?? '', 10);
  const turns = parseInt(pairs.turns ?? '', 10);

  if ([toolCalls, tokensIn, tokensOut, turns].some((v) => Number.isNaN(v))) {
    return null;
  }

  return { toolCalls, tokensIn, tokensOut, turns };
}

export function extractCodingStats(comments: MulticaComment[]): CodingStats {
  for (const comment of comments) {
    if (comment.author_type !== 'agent') continue;
    const parsed = parseCodingStatsFooter(comment.content);
    if (!parsed) continue;

    return {
      available: true,
      ...parsed,
      sampleCommentId: comment.id,
      sampleAt: comment.created_at,
    };
  }

  return {
    available: false,
    toolCalls: 0,
    tokensIn: 0,
    tokensOut: 0,
    turns: 0,
  };
}
