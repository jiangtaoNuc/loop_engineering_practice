import { useState, useEffect, useRef, useCallback } from 'react';
import type { HarnessSnapshot, IssuesListResponse, CodingStats, CodingStatsResponse } from '@coding-harness/shared';

const POLL_BASE = 7000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_BACKOFF_MS = 60000;

function backoffInterval(failCount: number, base: number): number {
  if (failCount <= 0) return base;
  return Math.min(base * Math.pow(2, failCount), MAX_BACKOFF_MS);
}

async function fetchWithTimeout(
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

export function useIssues(includeAutopilot: boolean = false) {
  const [data, setData] = useState<IssuesListResponse | null>(null);
  const [error, setError] = useState(false);
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

      const res = await fetchWithTimeout(url, { headers }, FETCH_TIMEOUT_MS);
      if (res.status === 304) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body: IssuesListResponse = await res.json();
      etagRef.current = body.etag;
      setData(body);
      failCount.current = 0;
      setError(false);
    } catch {
      failCount.current++;
      setError(true);
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
  const [error, setError] = useState(false);
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

      const res = await fetchWithTimeout(
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
      setError(false);
    } catch {
      failCount.current++;
      setError(true);
    }
  }, [issueId]);

  useEffect(() => {
    setSnapshot(null);
    etagRef.current = null;
    prevStateRef.current = null;
    setTransition(null);
    failCount.current = 0;
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
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/issues/${issueId}/coding-stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: CodingStatsResponse = await res.json();
      setStats(body.stats);
    } catch {
      setError(true);
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
    setError(false);
  }, [issueId]);

  return { stats, loading, error, fetchStats };
}
