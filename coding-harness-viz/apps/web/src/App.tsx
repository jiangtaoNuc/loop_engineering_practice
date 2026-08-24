import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useIssues,
  useHarness,
  useCodingStats,
  useIssueGraph,
  useStatusTimeline,
} from './hooks/useHarness';
import { IssueTabs } from './components/IssueTabs';
import { StatusFilter } from './components/StatusFilter';
import { Pipeline } from './components/Pipeline';
import { Sidebar } from './components/Sidebar';
import { Banner } from './components/Banner';
import { NavMenu } from './components/NavMenu';
import { NodeDetailModal } from './components/NodeDetailModal';
import { FilterBar } from './components/FilterBar';
import { IssueGraph } from './components/IssueGraph';
import { StatusTimeline } from './components/StatusTimeline';
import type { HarnessState, MulticaStatus } from '@coding-harness/shared';
import { STATUS_FILTER_ALL, MULTICA_STATUSES } from '@coding-harness/shared';

const LS_KEY = 'coding-harness-include-autopilot';

type ViewMode = 'pipeline' | 'graph';

function getInitialStatusFilter(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('status') ?? STATUS_FILTER_ALL;
}

export function App() {
  const [includeAutopilot, setIncludeAutopilot] = useState<boolean>(
    () => localStorage.getItem(LS_KEY) === '1'
  );
  const { data: issuesData, error: issuesError, refetch: refetchIssues } = useIssues(includeAutopilot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(getInitialStatusFilter);
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [selectedStatuses, setSelectedStatuses] = useState<MulticaStatus[]>([...MULTICA_STATUSES]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const { snapshot, error: harnessError, transition } = useHarness(selectedId);
  const [modalState, setModalState] = useState<HarnessState | null>(null);
  const { stats, loading: loadingStats, error: statsError, fetchStats } = useCodingStats(selectedId);
  const { data: graphData, error: graphError } = useIssueGraph(selectedStatuses);
  const { data: timelineData, error: timelineError } = useStatusTimeline(
    viewMode === 'graph' ? selectedId : null,
  );

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
  const statusFiltered = statusFilter === STATUS_FILTER_ALL
    ? allIssues
    : allIssues.filter((i) => i.status === statusFilter);

  const filteredIssues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return statusFiltered;
    return statusFiltered.filter(
      (i) =>
        i.identifier.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q),
    );
  }, [statusFiltered, searchQuery]);

  useEffect(() => {
    if (selectedId && filteredIssues.length > 0) {
      const stillVisible = filteredIssues.some((i) => i.id === selectedId);
      if (!stillVisible) {
        setSelectedId(filteredIssues[0].id);
        setModalState(null);
      }
    }
  }, [filteredIssues, selectedId]);

  const handleCreateIssue = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        setNewTitle('');
        setShowNewForm(false);
      }
    } finally {
      setCreating(false);
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
    setCheckedIds((prev) => {
      if (prev.size === filteredIssues.length) return new Set();
      return new Set(filteredIssues.map((i) => i.id));
    });
  }, [filteredIssues]);

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

  const activeError = issuesError ?? harnessError;
  const graphViewDegraded = viewMode === 'graph' && (graphError || timelineError);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
    }}>
      <NavMenu />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <header style={{
          padding: '12px 24px',
          borderBottom: '4px solid var(--ink-muted)',
          fontFamily: 'var(--font-heading)',
          fontSize: 10,
          letterSpacing: 2,
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--bg-deep)',
        }}>
          任务运行监控
        </header>

        {activeError && (
          <Banner
            message={`⚠ ${activeError.message}`}
            type={activeError.kind === 'server' || activeError.kind === 'timeout' ? 'error' : 'warning'}
          />
        )}

        {!activeError && graphViewDegraded && (
          <Banner
            message="⚠ Graph data may be stale, retrying..."
            type="warning"
          />
        )}

        <div style={{
          display: 'flex',
          borderBottom: '4px solid var(--ink-muted)',
        }}>
          <button
            onClick={() => setViewMode('pipeline')}
            style={{
              padding: '8px 16px',
              fontFamily: 'var(--font-heading)',
              fontSize: 8,
              background: viewMode === 'pipeline' ? 'var(--accent-cyan)' : 'transparent',
              color: viewMode === 'pipeline' ? 'var(--bg-deep)' : 'var(--text-bone)',
              border: 'none',
              borderRight: '4px solid var(--ink-muted)',
              cursor: 'pointer',
            }}
          >
            PIPELINE
          </button>
          <button
            onClick={() => setViewMode('graph')}
            style={{
              padding: '8px 16px',
              fontFamily: 'var(--font-heading)',
              fontSize: 8,
              background: viewMode === 'graph' ? 'var(--accent-cyan)' : 'transparent',
              color: viewMode === 'graph' ? 'var(--bg-deep)' : 'var(--text-bone)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ISSUE GRAPH
          </button>
        </div>

        {viewMode === 'pipeline' ? (
          <>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={handleStatusChange}
              issues={allIssues}
              filteredCount={filteredIssues.length}
            />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderBottom: '2px solid var(--ink-muted)',
            }}>
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-body)',
                  fontSize: 20,
                  padding: '4px 10px',
                  background: 'var(--bg-deep)',
                  color: 'var(--text-bone)',
                  border: '2px solid var(--ink-muted)',
                  outline: 'none',
                }}
              />
              {!showNewForm ? (
                <button
                  onClick={() => setShowNewForm(true)}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 8,
                    padding: '6px 10px',
                    background: 'var(--accent-cyan)',
                    color: 'var(--bg-deep)',
                    border: '2px solid var(--accent-cyan)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + NEW
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="text"
                    placeholder="Issue title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateIssue();
                      if (e.key === 'Escape') { setShowNewForm(false); setNewTitle(''); }
                    }}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 20,
                      padding: '4px 10px',
                      width: 200,
                      background: 'var(--bg-deep)',
                      color: 'var(--text-bone)',
                      border: '2px solid var(--ink-muted)',
                      outline: 'none',
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleCreateIssue}
                    disabled={creating || !newTitle.trim()}
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 8,
                      padding: '6px 10px',
                      background: 'var(--accent-cyan)',
                      color: 'var(--bg-deep)',
                      border: '2px solid var(--accent-cyan)',
                      cursor: 'pointer',
                      opacity: creating || !newTitle.trim() ? 0.5 : 1,
                    }}
                  >
                    {creating ? '...' : 'OK'}
                  </button>
                  <button
                    onClick={() => { setShowNewForm(false); setNewTitle(''); }}
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 8,
                      padding: '6px 10px',
                      background: 'var(--ink-muted)',
                      color: 'var(--text-bone)',
                      border: '2px solid var(--ink-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    X
                  </button>
                </div>
              )}
            </div>

            <IssueTabs
              issues={filteredIssues}
              selectedId={selectedId}
              onSelect={handleSelect}
              includeAutopilot={includeAutopilot}
              onToggleAutopilot={handleToggleAutopilot}
              isFiltered={statusFilter !== STATUS_FILTER_ALL || searchQuery.trim() !== ''}
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
                overflowY: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background: 'var(--bg-light)',
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
                    color: 'var(--ink-muted)',
                    textAlign: 'center',
                  }}>
                    {selectedId ? 'Loading harness data...' : 'Select an issue to view its pipeline'}
                  </div>
                )}
              </div>

              {snapshot && <Sidebar snapshot={snapshot} />}
            </div>
          </>
        ) : (
          <>
            <FilterBar selected={selectedStatuses} onChange={setSelectedStatuses} />

            <div style={{
              flex: 1,
              display: 'flex',
              overflow: 'hidden',
            }}>
              <IssueGraph
                nodes={graphData?.nodes ?? []}
                edges={graphData?.edges ?? []}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
              <StatusTimeline timeline={timelineData} />
            </div>
          </>
        )}
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
