import { useState, useEffect, useRef, useCallback } from 'react';
import type { HarnessSnapshot, IssuesListResponse, CodingStats, CodingStatsResponse } from '@coding-harness/shared';

const POLL_BASE = 7000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_BACKOFF_MS = 60000;
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;

export type NetworkErrorKind = 'timeout' | 'server' | 'client' | 'network' | 'unknown';

export interface NetworkError {
  kind: NetworkErrorKind;
  message: string;
}

export function backoffInterval(failCount: number, base: number): number {
  if (failCount <= 0) return base;
  return Math.min(base * Math.pow(2, failCount), MAX_BACKOFF_MS);
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (isRetryableError(err) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}

export function classifyError(err: unknown): NetworkError {
  if (err instanceof Error && err.name === 'AbortError') {
    return { kind: 'timeout', message: 'Network timeout — request took too long' };
  }
  if (err instanceof TypeError) {
    return { kind: 'network', message: 'Network request failed — check your connection and try again' };
  }
  if (err instanceof Error && err.message.startsWith('HTTP ')) {
    const status = parseInt(err.message.slice(5), 10);
    if (Number.isNaN(status)) {
      return { kind: 'unknown', message: 'Request failed' };
    }
    if (status === 504) {
      return { kind: 'timeout', message: 'Server timeout — please try again' };
    }
    if (status >= 500) {
      return { kind: 'server', message: `Server error ${status} — please try again` };
    }
    if (status >= 400) {
      return { kind: 'client', message: `Request failed (${status})` };
    }
  }
  return { kind: 'unknown', message: 'Request failed' };
}

export function useIssues(includeAutopilot: boolean = false) {
  const [data, setData] = useState<IssuesListResponse | null>(null);
  const [error, setError] = useState<NetworkError | null>(null);
  const etagRef = useRef<string | null>(null);
  const failCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (etagRef.current) headers['If-None-Match'] = `"${etagRef.current}"`;

      const params = new URLSearchParams();
      if (includeAutopilot) params.set('include_autopilot', '1');
      const qs = params.toString();
      const url = qs ? `/api/issues?${qs}` : '/api/issues';

      const res = await fetchWithRetry(url, { headers }, FETCH_TIMEOUT_MS);
      if (res.status === 304) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body: IssuesListResponse = await res.json();
      etagRef.current = body.etag;
      setData(body);
      failCount.current = 0;
      setError(null);
    } catch (err) {
      failCount.current++;
      setError(classifyError(err));
    }
  }, [includeAutopilot]);

  useEffect(() => {
    etagRef.current = null;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const interval = backoffInterval(failCount.current, POLL_BASE);
      timerRef.current = setTimeout(async () => {
        await fetchIssues();
        schedule();
      }, interval);
    };

    fetchIssues().then(schedule);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchIssues]);

  return { data, error };
}

export function useHarness(issueId: string | null) {
  const [snapshot, setSnapshot] = useState<HarnessSnapshot | null>(null);
  const [error, setError] = useState<NetworkError | null>(null);
  const etagRef = useRef<string | null>(null);
  const prevStateRef = useRef<string | null>(null);
  const [transition, setTransition] = useState<{ from: string; to: string } | null>(null);
  const terminalTimerRef = useRef<number | null>(null);
  const failCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!issueId) return;
    try {
      const headers: Record<string, string> = {};
      if (etagRef.current) headers['If-None-Match'] = `"${etagRef.current}"`;

      const res = await fetchWithRetry(
        `/api/issues/${issueId}/harness`,
        { headers },
        FETCH_TIMEOUT_MS,
      );
      if (res.status === 304) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const snap: HarnessSnapshot = await res.json();
      etagRef.current = snap.etag;

      if (prevStateRef.current && prevStateRef.current !== snap.state) {
        setTransition({ from: prevStateRef.current, to: snap.state });
        setTimeout(() => setTransition(null), 3000);
      }
      prevStateRef.current = snap.state;

      setSnapshot(snap);
      failCount.current = 0;
      setError(null);
    } catch (err) {
      failCount.current++;
      setError(classifyError(err));
    }
  }, [issueId]);

  useEffect(() => {
    setSnapshot(null);
    etagRef.current = null;
    prevStateRef.current = null;
    setTransition(null);
    failCount.current = 0;
    setError(null);
    if (terminalTimerRef.current) {
      clearTimeout(terminalTimerRef.current);
      terminalTimerRef.current = null;
    }
  }, [issueId]);

  useEffect(() => {
    if (!issueId) return;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const interval = backoffInterval(failCount.current, POLL_BASE);
      timerRef.current = setTimeout(async () => {
        await fetchSnapshot();
        schedule();
      }, interval);
    };

    fetchSnapshot().then(schedule);

    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else {
        fetchSnapshot().then(schedule);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [issueId, fetchSnapshot]);

  return { snapshot, error, transition };
}

export function useCodingStats(issueId: string | null) {
  const [stats, setStats] = useState<CodingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NetworkError | null>(null);

  const fetchStats = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry(`/api/issues/${issueId}/coding-stats`, {}, FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: CodingStatsResponse = await res.json();
      setStats(body.stats);
    } catch (err) {
      setError(classifyError(err));
      setStats({
        available: false,
        startedAt: null,
        endedAt: null,
        durationSec: null,
        toolCalls: null,
        events: null,
        turns: null,
      });
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    setStats(null);
    setError(null);
  }, [issueId]);

  return { stats, loading, error, fetchStats };
}
