import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_LAFLO_ASSISTANT_EVENT } from '@/lib/assistantEvents';
import AssistantDock from './AssistantDock';

const healthMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/assistant', () => ({
  assistantService: { health: healthMock },
}));

describe('AssistantDock', () => {
  beforeEach(() => {
    healthMock.mockReset();
    healthMock.mockResolvedValue({ enabled: true, model: 'hotel-brain' });
  });

  it('routes Operations Concierge questions into the global Ask LaFlo assistant', async () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
    render(<AssistantDock context={null} />);

    expect(screen.queryByPlaceholderText('Ask a question...')).not.toBeInTheDocument();
    expect(screen.getByText('Operational context powered by Hotel Brain.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Ask LaFlo' }));

    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ mode: 'operations' });
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
  });
});
