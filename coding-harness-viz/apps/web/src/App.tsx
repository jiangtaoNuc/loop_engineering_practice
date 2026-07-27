import { useState, useEffect, useCallback } from 'react';
import { useIssues, useHarness } from './hooks/useHarness';
import { IssueTabs } from './components/IssueTabs';
import { Pipeline } from './components/Pipeline';
import { Sidebar } from './components/Sidebar';
import { Banner } from './components/Banner';

export function App() {
  const { data: issuesData, error: issuesError, refetch: refetchIssues } = useIssues();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const { snapshot, error: harnessError, transition } = useHarness(selectedId);

  useEffect(() => {
    if (issuesData?.issues && !selectedId && issuesData.issues.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('issue');
      const match = fromUrl
        ? issuesData.issues.find((i) => i.identifier === fromUrl)
        : null;
      setSelectedId(match?.id ?? issuesData.issues[0].id);
    }
  }, [issuesData, selectedId]);

  useEffect(() => {
    if (!issuesData?.issues) return;
    const validIds = new Set(issuesData.issues.map((i) => i.id));
    setCheckedIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size !== prev.size ? next : prev;
    });
  }, [issuesData]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const issue = issuesData?.issues.find((i) => i.id === id);
    if (issue) {
      const url = new URL(window.location.href);
      url.searchParams.set('issue', issue.identifier);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleToggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (!issuesData?.issues) return;
    setCheckedIds((prev) => {
      if (prev.size === issuesData.issues.length) return new Set();
      return new Set(issuesData.issues.map((i) => i.id));
    });
  }, [issuesData]);

  const handleDeleteOne = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/issues/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        return;
      }
      if (selectedId === id) {
        setSelectedId(null);
      }
      setCheckedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refetchIssues();
    },
    [selectedId, refetchIssues],
  );

  const handleDeleteBatch = useCallback(async () => {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    try {
      const res = await fetch('/api/issues/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      return;
    }
    if (selectedId && checkedIds.has(selectedId)) {
      setSelectedId(null);
    }
    setCheckedIds(new Set());
    refetchIssues();
  }, [checkedIds, selectedId, refetchIssues]);

  const showBanner = issuesError || harnessError;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <header style={{
        padding: '16px 24px',
        borderBottom: '4px solid var(--ink-muted)',
        fontFamily: 'var(--font-heading)',
        fontSize: 14,
        letterSpacing: 2,
        color: 'var(--accent-cyan)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>{'▓▓▓'}</span>
        CODING HARNESS
        <span style={{ fontSize: 20 }}>{'▓▓▓'}</span>
      </header>

      {showBanner && (
        <Banner
          message={issuesError ? '⚠ Connection error, retrying...' : '⚠ Data may be stale'}
          type="warning"
        />
      )}

      <IssueTabs
        issues={issuesData?.issues ?? []}
        selectedId={selectedId}
        onSelect={handleSelect}
        checkedIds={checkedIds}
        onToggleCheck={handleToggleCheck}
        onToggleAll={handleToggleAll}
        onDeleteOne={handleDeleteOne}
        onDeleteBatch={handleDeleteBatch}
      />

      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        <div style={{
          flex: 1,
          overflowX: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          {snapshot ? (
            <Pipeline snapshot={snapshot} transition={transition} />
          ) : (
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: 24,
              color: 'var(--text-dust)',
              textAlign: 'center',
            }}>
              {selectedId ? 'Loading harness data...' : 'Select an issue to view its pipeline'}
            </div>
          )}
        </div>

        {snapshot && <Sidebar snapshot={snapshot} />}
      </div>
    </div>
  );
}
