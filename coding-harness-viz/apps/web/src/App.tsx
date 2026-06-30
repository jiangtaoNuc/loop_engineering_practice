import { useState, useEffect, useCallback } from 'react';
import { useIssues, useHarness, useCodingStats } from './hooks/useHarness';
import { IssueTabs } from './components/IssueTabs';
import { StatusFilter } from './components/StatusFilter';
import { Pipeline } from './components/Pipeline';
import { Sidebar } from './components/Sidebar';
import { Banner } from './components/Banner';
import { NodeDetailModal } from './components/NodeDetailModal';
import type { HarnessState } from '@coding-harness/shared';
import { STATUS_FILTER_ALL } from '@coding-harness/shared';

const LS_KEY = 'coding-harness-include-autopilot';

function getInitialStatusFilter(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('status') ?? STATUS_FILTER_ALL;
}

export function App() {
  const [includeAutopilot, setIncludeAutopilot] = useState<boolean>(
    () => localStorage.getItem(LS_KEY) === '1'
  );
  const { data: issuesData, error: issuesError } = useIssues(includeAutopilot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(getInitialStatusFilter);
  const { snapshot, error: harnessError, transition } = useHarness(selectedId);
  const [modalState, setModalState] = useState<HarnessState | null>(null);
  const { stats, loading: loadingStats, error: statsError, fetchStats } = useCodingStats(selectedId);

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

  useEffect(() => {
    setModalState(null);
  }, [selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setModalState(null);
    const issue = issuesData?.issues.find((i) => i.id === id);
    if (issue) {
      const url = new URL(window.location.href);
      url.searchParams.set('issue', issue.identifier);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    const url = new URL(window.location.href);
    if (status === STATUS_FILTER_ALL) {
      url.searchParams.delete('status');
    } else {
      url.searchParams.set('status', status);
    }
    window.history.replaceState(null, '', url.toString());
  };

  const handleToggleAutopilot = () => {
    setIncludeAutopilot((prev) => {
      const next = !prev;
      localStorage.setItem(LS_KEY, next ? '1' : '0');
      return next;
    });
  };

  const allIssues = issuesData?.issues ?? [];
  const filteredIssues = statusFilter === STATUS_FILTER_ALL
    ? allIssues
    : allIssues.filter((i) => i.status === statusFilter);

  const activeError = issuesError ?? harnessError;

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

      {activeError && (
        <Banner
          message={`⚠ ${activeError.message}`}
          type={activeError.kind === 'server' || activeError.kind === 'timeout' ? 'error' : 'warning'}
        />
      )}

      <StatusFilter
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        issues={allIssues}
        filteredCount={filteredIssues.length}
      />

      <IssueTabs
        issues={filteredIssues}
        selectedId={selectedId}
        onSelect={handleSelect}
        includeAutopilot={includeAutopilot}
        onToggleAutopilot={handleToggleAutopilot}
        isFiltered={statusFilter !== STATUS_FILTER_ALL}
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
          statsError={statsError}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
