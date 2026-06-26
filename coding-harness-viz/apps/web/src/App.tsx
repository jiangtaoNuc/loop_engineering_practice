import { useState, useEffect } from 'react';
import { useIssues, useHarness, useCodingStats } from './hooks/useHarness';
import { IssueTabs } from './components/IssueTabs';
import { Pipeline } from './components/Pipeline';
import { Sidebar } from './components/Sidebar';
import { Banner } from './components/Banner';
import { NodeDetailModal } from './components/NodeDetailModal';
import type { HarnessState } from '@coding-harness/shared';

export function App() {
  const { data: issuesData, error: issuesError } = useIssues();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { snapshot, error: harnessError, transition } = useHarness(selectedId);
  const [modalState, setModalState] = useState<HarnessState | null>(null);
  const { stats, loading: loadingStats, fetchStats } = useCodingStats(selectedId);

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
    if (modalState === 'coding') {
      fetchStats();
    }
  }, [modalState, fetchStats]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const issue = issuesData?.issues.find((i) => i.id === id);
    if (issue) {
      const url = new URL(window.location.href);
      url.searchParams.set('issue', issue.identifier);
      window.history.replaceState(null, '', url.toString());
    }
  };

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
        <span style={{ fontSize: 20 }}>▓▓▓</span>
        CODING HARNESS
        <span style={{ fontSize: 20 }}>▓▓▓</span>
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
            <Pipeline
              snapshot={snapshot}
              transition={transition}
              onNodeClick={setModalState}
            />
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

      {snapshot && modalState && (
        <NodeDetailModal
          snapshot={snapshot}
          state={modalState}
          stats={stats}
          loadingStats={loadingStats}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
