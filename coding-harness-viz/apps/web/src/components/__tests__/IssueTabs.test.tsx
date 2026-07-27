import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueTabs } from '../IssueTabs';
import type { IssueSummary } from '@coding-harness/shared';

const mockIssues: IssueSummary[] = [
  { id: 'id-1', identifier: 'LOO-1', title: 'First issue', status: 'todo', updatedAt: '2026-01-01' },
  { id: 'id-2', identifier: 'LOO-2', title: 'Second issue', status: 'in_progress', updatedAt: '2026-01-02' },
  { id: 'id-3', identifier: 'LOO-3', title: 'Third issue', status: 'done', updatedAt: '2026-01-03' },
];

function defaultProps() {
  return {
    issues: mockIssues,
    selectedId: 'id-1',
    onSelect: vi.fn(),
    includeAutopilot: false,
    onToggleAutopilot: vi.fn(),
    isFiltered: false,
    checkedIds: new Set<string>(),
    onToggleCheck: vi.fn(),
    onToggleAll: vi.fn(),
    onDeleteOne: vi.fn(),
    onDeleteBatch: vi.fn(),
  };
}

describe('IssueTabs', () => {
  it('renders checkboxes for each issue', () => {
    render(<IssueTabs {...defaultProps()} />);
    expect(screen.getByTestId('check-id-1')).toBeInTheDocument();
    expect(screen.getByTestId('check-id-2')).toBeInTheDocument();
    expect(screen.getByTestId('check-id-3')).toBeInTheDocument();
  });

  it('renders delete buttons for each issue', () => {
    render(<IssueTabs {...defaultProps()} />);
    expect(screen.getByTestId('delete-id-1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-id-2')).toBeInTheDocument();
    expect(screen.getByTestId('delete-id-3')).toBeInTheDocument();
  });

  it('toggles check when checkbox is clicked', () => {
    const onToggleCheck = vi.fn();
    render(<IssueTabs {...defaultProps()} onToggleCheck={onToggleCheck} />);
    fireEvent.click(screen.getByTestId('check-id-1'));
    expect(onToggleCheck).toHaveBeenCalledWith('id-1');
  });

  it('shows confirm dialog when delete button is clicked', () => {
    render(<IssueTabs {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('delete-id-2'));
    expect(screen.getByText('CONFIRM DELETE')).toBeInTheDocument();
    expect(screen.getByText(/Delete issue LOO-2\?/)).toBeInTheDocument();
  });

  it('calls onDeleteOne when single delete is confirmed', () => {
    const onDeleteOne = vi.fn();
    render(<IssueTabs {...defaultProps()} onDeleteOne={onDeleteOne} />);
    fireEvent.click(screen.getByTestId('delete-id-1'));
    fireEvent.click(screen.getByText('DELETE'));
    expect(onDeleteOne).toHaveBeenCalledWith('id-1');
  });

  it('closes dialog when cancel is clicked (cancel confirm)', () => {
    render(<IssueTabs {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('delete-id-1'));
    expect(screen.getByText('CONFIRM DELETE')).toBeInTheDocument();
    fireEvent.click(screen.getByText('CANCEL'));
    expect(screen.queryByText('CONFIRM DELETE')).not.toBeInTheDocument();
  });

  it('shows batch toolbar when items are checked', () => {
    render(
      <IssueTabs {...defaultProps()} checkedIds={new Set(['id-1', 'id-2'])} />,
    );
    expect(screen.getByTestId('batch-delete-btn')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('does not show batch toolbar when nothing is checked', () => {
    render(<IssueTabs {...defaultProps()} />);
    expect(screen.queryByTestId('batch-delete-btn')).not.toBeInTheDocument();
  });

  it('shows batch confirm dialog when batch delete is clicked', () => {
    render(
      <IssueTabs {...defaultProps()} checkedIds={new Set(['id-1', 'id-2'])} />,
    );
    fireEvent.click(screen.getByTestId('batch-delete-btn'));
    expect(screen.getByText('CONFIRM BATCH DELETE')).toBeInTheDocument();
  });

  it('calls onDeleteBatch when batch delete is confirmed', () => {
    const onDeleteBatch = vi.fn();
    render(
      <IssueTabs
        {...defaultProps()}
        checkedIds={new Set(['id-1', 'id-2'])}
        onDeleteBatch={onDeleteBatch}
      />,
    );
    fireEvent.click(screen.getByTestId('batch-delete-btn'));
    fireEvent.click(screen.getByText('DELETE'));
    expect(onDeleteBatch).toHaveBeenCalled();
  });

  it('closes batch dialog when cancel is clicked', () => {
    render(
      <IssueTabs {...defaultProps()} checkedIds={new Set(['id-1'])} />,
    );
    fireEvent.click(screen.getByTestId('batch-delete-btn'));
    expect(screen.getByText('CONFIRM BATCH DELETE')).toBeInTheDocument();
    fireEvent.click(screen.getByText('CANCEL'));
    expect(screen.queryByText('CONFIRM BATCH DELETE')).not.toBeInTheDocument();
  });

  it('shows empty state when no issues', () => {
    render(<IssueTabs {...defaultProps()} issues={[]} />);
    expect(screen.getByText(/No issues found/)).toBeInTheDocument();
  });
});
