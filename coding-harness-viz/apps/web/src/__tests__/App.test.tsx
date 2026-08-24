import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useHarness', () => ({
  useIssues: () => ({ data: { issues: [] }, error: null, refetch: vi.fn() }),
  useHarness: () => ({ snapshot: null, error: null, transition: null }),
  useCodingStats: () => ({ stats: null, loading: false, error: null, fetchStats: vi.fn() }),
  useIssueGraph: () => ({ data: null, error: null }),
  useStatusTimeline: () => ({ data: null, error: null }),
}));

import { App } from '../App';

describe('App header', () => {
  it('does not render a live clock in the header', () => {
    const { container } = render(<App />);
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});
