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
    const launcher = screen.getByRole('button', { name: 'Open LaFlo Assistant' });
    expect(launcher).toHaveTextContent('Ask LaFlo');
    expect(launcher).toHaveClass('bg-primary-solid');
    expect(launcher).not.toHaveClass('bg-slate-950');
    expect(launcher.querySelector('img')).toHaveAttribute('src', '/laflo-logo.png');
    expect(launcher.querySelector('img')).not.toHaveClass('rounded-xl');
    expect(launcher).toHaveClass('min-h-11');
    expect(launcher.parentElement).toHaveClass('bottom-2');
    expect(launcher.parentElement).toHaveClass('sm:bottom-3');

    fireEvent.click(launcher);
    expect(screen.getByRole('dialog', { name: 'LaFlo Assistant' })).toHaveClass('max-h-[calc(100dvh-1.5rem)]');
    expect(screen.getByPlaceholderText('Ask anything about LaFlo…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }));
    act(() => openLafloAssistant({ mode: 'operations', prompt: 'Explain today’s AI operational briefing.' }));

    expect(await screen.findByDisplayValue('Explain today’s AI operational briefing.')).toBeInTheDocument();
  });

  it('uses the original branded launcher consistently on Enterprise Search', () => {
    render(<MemoryRouter initialEntries={['/operations-center/search']}><AppChatbot /></MemoryRouter>);

    const launcher = screen.getByRole('button', { name: 'Open LaFlo Assistant' });
    expect(launcher).toHaveTextContent('Ask LaFlo');
    expect(launcher).toHaveClass('rounded-2xl');
    expect(launcher).toHaveClass('bg-primary-solid');
    expect(launcher.querySelector('img')).toHaveAttribute('src', '/laflo-logo.png');
    expect(launcher).toHaveClass('text-xs');
  });
});
