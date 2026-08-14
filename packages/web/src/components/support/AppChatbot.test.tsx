import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openLafloAssistant } from '@/lib/assistantEvents';
import { useAuthStore } from '@/stores/authStore';
import AppChatbot from './AppChatbot';

const serviceMocks = vi.hoisted(() => ({
  status: vi.fn(),
}));

vi.mock('@/services', () => ({
  assistantService: {
    status: serviceMocks.status,
    send: vi.fn(),
    downloadTranscript: vi.fn(),
    emailTranscript: vi.fn(),
  },
  conciergeService: { create: vi.fn() },
  messageService: { getOrCreateLiveSupportThread: vi.fn() },
}));

describe('AppChatbot', () => {
  beforeEach(() => {
    localStorage.clear();
    serviceMocks.status.mockReturnValue(new Promise(() => {}));
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', email: 'admin@demo.hotel' } as never });
  });

  it('opens and prepares the global Ask LaFlo conversation from a page briefing action', async () => {
    render(<MemoryRouter initialEntries={['/operations-center/ai']}><AppChatbot /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Open LaFlo Assistant' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open LaFlo Assistant' }));
    expect(screen.getByPlaceholderText('Ask anything about LaFlo…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }));
    act(() => openLafloAssistant({ mode: 'operations', prompt: 'Explain today’s AI operational briefing.' }));

    expect(await screen.findByDisplayValue('Explain today’s AI operational briefing.')).toBeInTheDocument();
  });
});
