import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  HarnessSnapshot,
  IssuesListResponse,
  IssuesGraphResponse,
  StatusTimelineResponse,
  MulticaStatus,
} from '@coding-harness/shared';
import { MULTICA_STATUSES } from '@coding-harness/shared';

const POLL_BASE = 7000;

export function useIssues() {
  const [data, setData] = useState<IssuesListResponse | null>(null);
  const [error, setError] = useState(false);
  const etagRef = useRef<string | null>(null);
  const failCount = useRef(0);

  const fetchIssues = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (etagRef.current) headers['If-None-Match'] = `"${etagRef.current}"`;

      const res = await fetch('/api/issues', { headers });
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
  }, []);

  useEffect(() => {
    fetchIssues();
    const interval = setInterval(fetchIssues, POLL_BASE);
    return () => clearInterval(interval);
  }, [fetchIssues]);

  return { data, error };
}

export function useIssueGraph(statuses: MulticaStatus[]) {
  const [data, setData] = useState<IssuesGraphResponse | null>(null);
  const [error, setError] = useState(false);
  const etagRef = useRef<string | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statuses.length > 0 && statuses.length < MULTICA_STATUSES.length) {
        params.set('status', statuses.join(','));
      }

      const headers: Record<string, string> = {};
      if (etagRef.current) headers['If-None-Match'] = `"${etagRef.current}"`;

      const res = await fetch(`/api/issues/graph?${params.toString()}`, { headers });
      if (res.status === 304) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body: IssuesGraphResponse = await res.json();
      etagRef.current = body.etag;
      setData(body);
      setError(false);
    } catch {
      setError(true);
    }
  }, [statuses]);

  useEffect(() => {
    etagRef.current = null;
    fetchGraph();
    const interval = setInterval(fetchGraph, POLL_BASE);
    return () => clearInterval(interval);
  }, [fetchGraph]);

  return { data, error };
}

export function useStatusTimeline(issueId: string | null) {
  const [data, setData] = useState<StatusTimelineResponse | null>(null);
  const [error, setError] = useState(false);

  const fetchTimeline = useCallback(async () => {
    if (!issueId) return;
    try {
      const res = await fetch(`/api/issues/${issueId}/timeline`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body: StatusTimelineResponse = await res.json();
      setData(body);
      setError(false);
    } catch {
      setError(true);
    }
  }, [issueId]);

  useEffect(() => {
    setData(null);
    fetchTimeline();
    const interval = setInterval(fetchTimeline, POLL_BASE);
    return () => clearInterval(interval);
  }, [fetchTimeline]);

  return { data, error };
}

export function useHarness(issueId: string | null) {
  const [snapshot, setSnapshot] = useState<HarnessSnapshot | null>(null);
  const [error, setError] = useState(false);
  const etagRef = useRef<string | null>(null);
  const prevStateRef = useRef<string | null>(null);
  const [transition, setTransition] = useState<{ from: string; to: string } | null>(null);
  const terminalTimerRef = useRef<number | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!issueId) return;
    try {
      const headers: Record<string, string> = {};
      if (etagRef.current) headers['If-None-Match'] = `"${etagRef.current}"`;

      const res = await fetch(`/api/issues/${issueId}/harness`, { headers });
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
      setError(false);
    } catch {
      setError(true);
    }
  }, [issueId]);

  useEffect(() => {
    setSnapshot(null);
    etagRef.current = null;
    prevStateRef.current = null;
    setTransition(null);
    if (terminalTimerRef.current) {
      clearTimeout(terminalTimerRef.current);
      terminalTimerRef.current = null;
    }
  }, [issueId]);

  useEffect(() => {
    if (!issueId) return;
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, POLL_BASE);

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        fetchSnapshot();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [issueId, fetchSnapshot]);

  return { snapshot, error, transition };
}
