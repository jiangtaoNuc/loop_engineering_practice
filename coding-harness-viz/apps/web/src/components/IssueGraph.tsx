import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { IssueNode as IssueNodeData, IssueEdge as IssueEdgeData, MulticaStatus } from '@coding-harness/shared';
import { STATUS_LABELS } from '@coding-harness/shared';

const STATUS_CSS_VARS: Record<MulticaStatus, string> = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in_progress)',
  in_review: 'var(--status-in_review)',
  done: 'var(--status-done)',
  blocked: 'var(--status-blocked)',
  backlog: 'var(--status-backlog)',
  cancelled: 'var(--status-cancelled)',
};

interface NodeData extends Record<string, unknown> {
  issue: IssueNodeData;
}

interface Props {
  nodes: IssueNodeData[];
  edges: IssueEdgeData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function IssueNodeComponent({ data, selected }: { data: NodeData; selected?: boolean }) {
  const { issue } = data;
  const color = STATUS_CSS_VARS[issue.status];

  return (
    <div style={{
      padding: '8px 12px',
      background: 'var(--bg-deep)',
      border: `3px solid ${selected ? 'var(--text-bone)' : color}`,
      boxShadow: selected ? `0 0 12px ${color}` : 'none',
      minWidth: 140,
      maxWidth: 220,
      cursor: 'pointer',
    }}>
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 8,
        color,
        marginBottom: 4,
      }}>
        {issue.identifier}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 16,
        color: 'var(--text-bone)',
        lineHeight: 1.2,
        wordBreak: 'break-word',
      }}>
        {issue.title}
      </div>
      <div style={{
        marginTop: 6,
        fontFamily: 'var(--font-heading)',
        fontSize: 7,
        color,
      }}>
        {STATUS_LABELS[issue.status].toUpperCase()}
      </div>
    </div>
  );
}

const nodeTypes = { issueNode: IssueNodeComponent };

export function IssueGraph({ nodes: dataNodes, edges: dataEdges, selectedId, onSelect }: Props) {
  const initialNodes: Node<NodeData>[] = useMemo(() => {
    const perRow = Math.max(1, Math.ceil(Math.sqrt(dataNodes.length)));
    return dataNodes.map((issue, index) => ({
      id: issue.id,
      type: 'issueNode',
      position: { x: (index % perRow) * 260, y: Math.floor(index / perRow) * 140 },
      data: { issue },
      selected: issue.id === selectedId,
    }));
  }, [dataNodes, selectedId]);

  const initialEdges: Edge[] = useMemo(() => {
    return dataEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: 'var(--accent-cyan)', strokeWidth: 2 },
    }));
  }, [dataEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = (_event: React.MouseEvent, node: Node<NodeData>) => {
    onSelect(node.id);
  };

  if (dataNodes.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        fontSize: 24,
        color: 'var(--text-dust)',
      }}>
        No issues match the selected filters.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        style={{ background: 'var(--bg-deep)' }}
      >
        <Background color="var(--ink-muted)" gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => STATUS_CSS_VARS[(node.data as NodeData).issue.status]}
          style={{ background: 'var(--bg-deep)' }}
        />
      </ReactFlow>
    </div>
  );
}
