import { useState, useEffect } from 'react';
import {
  useIssues,
  useHarness,
  useIssueGraph,
  useStatusTimeline,
} from './hooks/useHarness';
import { IssueTabs } from './components/IssueTabs';
import { Pipeline } from './components/Pipeline';
import { Sidebar } from './components/Sidebar';
import { Banner } from './components/Banner';
import { FilterBar } from './components/FilterBar';
import { IssueGraph } from './components/IssueGraph';
import { StatusTimeline } from './components/StatusTimeline';
import { MULTICA_STATUSES, type MulticaStatus } from '@coding-harness/shared';

type ViewMode = 'pipeline' | 'graph';

export function App() {
  const { data: issuesData, error: issuesError } = useIssues();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [selectedStatuses, setSelectedStatuses] = useState<MulticaStatus[]>([...MULTICA_STATUSES]);

  const { snapshot, error: harnessError, transition } = useHarness(selectedId);
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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const issue = issuesData?.issues.find((i) => i.id === id);
    if (issue) {
      const url = new URL(window.location.href);
      url.searchParams.set('issue', issue.identifier);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const showBanner = issuesError || harnessError || graphError || timelineError;

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
  );
}
