import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CollaborationHeader from '@/components/collaboration/CollaborationHeader';

function renderHeader(toolbar?: false | Record<string, never>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CollaborationHeader
          workspace="operations"
          title="Operations"
          subtitle="Coordinate hotel operations."
          {...(toolbar === undefined ? {} : { toolbar })}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(cleanup);

describe('collaboration session toolbar visibility', () => {
  it('is hidden by default in shared workspace headers', () => {
    renderHeader();
    expect(screen.queryByLabelText('Collaboration toolbar')).not.toBeInTheDocument();
  });

  it('renders only when a session explicitly opts in', () => {
    renderHeader({});
    expect(screen.getByLabelText('Collaboration toolbar')).toBeInTheDocument();
  });
});
