import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { conciergeService } from '@/services';
import { useAuthStore } from '@/stores/authStore';

type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
};

type ChatModeId = 'general' | 'reservations' | 'operations' | 'financials';

const modeConfig: Record<
  ChatModeId,
  { label: string; prompts: string[] }
> = {
  general: {
    label: 'General',
    prompts: [
      'How do I add a booking?',
      'How do I update room status?',
      'Where can I send an invoice?',
      'How do I request access?',
    ],
  },
  reservations: {
    label: 'Reservations',
    prompts: [
      'How do I create a walk-in booking?',
      'How do I check in a guest?',
      'How do I change check-out date?',
      'How do I assign a room quickly?',
    ],
  },
  operations: {
    label: 'Operations',
    prompts: [
      'How do I mark a room as dirty/clean?',
      'How do I update room images?',
      'How do I track inventory reorder?',
      'How do I schedule housekeeping tasks?',
    ],
  },
  financials: {
    label: 'Financials',
    prompts: [
      'How do I generate an invoice?',
      'How do I download a receipt?',
      'How do I view expense by category?',
      'How do I track payment status?',
    ],
  },
};

function getBotReply(mode: ChatModeId, input: string) {
  const text = input.toLowerCase();
  if (mode === 'reservations') {
    if (text.includes('walk') || text.includes('booking') || text.includes('reservation')) {
      return 'Go to Reservation, click New booking, choose guest, room, dates, then confirm payment.';
    }
    if (text.includes('check in')) {
      return 'Open Reservation, select the booking, then use Check-In action and confirm room assignment.';
    }
  }
  if (mode === 'operations') {
    if (text.includes('housekeeping') || text.includes('dirty') || text.includes('clean')) {
      return 'Use Housekeeping page to move rooms between Ready, Cleaning in Progress, Needs Cleaning, and Inspection.';
    }
    if (text.includes('inventory')) {
      return 'Use Inventory page to review stock, status tags, and reorder items before shortages impact operations.';
    }
  }
  if (mode === 'financials') {
    if (text.includes('invoice')) {
      return 'Use Invoicing page to create and send invoices. You can print or download receipt from booking/guest billing actions.';
    }
    if (text.includes('expense') || text.includes('payment')) {
      return 'Use Expenses and Invoicing filters to review paid/unpaid records and export transaction reports.';
    }
  }
  if (text.includes('booking')) {
    return 'Go to Reservation, click New booking, select guest and room, then confirm dates and payment.';
  }
  if (text.includes('room') || text.includes('housekeeping')) {
    return 'Open Rooms for room assignment and status. Use Housekeeping for cleaning workflow and room readiness.';
  }
  if (text.includes('invoice') || text.includes('payment')) {
    return 'Open Invoicing to create/send invoices. Use Financials > Expenses for cost tracking and downloads.';
  }
  if (text.includes('access') || text.includes('user')) {
    return 'Use Settings > Access Requests to review new requests, approve users, and trigger password setup.';
  }
  return 'I can help with bookings, rooms, housekeeping, guests, invoices, and access setup. Ask one of those.';
}

export default function AppChatbot() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatModeId>('general');
  const [input, setInput] = useState('');
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [handoffText, setHandoffText] = useState('');
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hi, I am LaFlo Assistant. Pick a mode and I can guide you quickly.',
    },
  ]);

  const quickPrompts = modeConfig[mode].prompts;

  const sendMessage = (text: string) => {
    const value = text.trim();
    if (!value) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: value };
    const botMsg: ChatMessage = {
      id: `b-${Date.now()}-${Math.random()}`,
      role: 'bot',
      text: getBotReply(mode, value),
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
  };

  const requestHumanHandoff = async () => {
    const note = handoffText.trim();
    if (!note) {
      toast.error('Please add a short issue summary.');
      return;
    }
    setHandoffLoading(true);
    try {
      const transcript = messages
        .slice(-6)
        .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
        .join('\n');
      await conciergeService.create({
        title: `Chatbot handoff (${modeConfig[mode].label})`,
        details: [
          `Requested by: ${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
          `Email: ${user?.email || '-'}`,
          `Mode: ${modeConfig[mode].label}`,
          `Issue: ${note}`,
          '',
          'Recent chat transcript:',
          transcript,
        ].join('\n'),
        source: 'CHATBOT',
        notifySupport: true,
        priority: 'MEDIUM',
        status: 'PENDING',
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `b-handoff-${Date.now()}`,
          role: 'bot',
          text: 'I have escalated this to the helpdesk. Open Concierge to continue with a human admin.',
        },
      ]);
      setHandoffRequested(false);
      setHandoffText('');
      toast.success('Escalated to helpdesk');
    } catch {
      toast.error('Failed to escalate right now. Please try again.');
    } finally {
      setHandoffLoading(false);
    }
  };

  const showPrompts = useMemo(() => messages.length <= 2, [messages.length]);

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="w-[330px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">LaFlo Assistant</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
              aria-label="Close assistant"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="border-b border-slate-100 bg-white px-3 py-2">
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as ChatModeId)}
              className="input h-9 w-full text-sm"
            >
              <option value="general">General mode</option>
              <option value="reservations">Reservations mode</option>
              <option value="operations">Operations mode</option>
              <option value="financials">Financials mode</option>
            </select>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto p-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-primary-500 text-slate-900'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {message.text}
              </div>
            ))}
            {showPrompts && (
              <div className="mt-2 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            {!handoffRequested ? (
              <button
                type="button"
                onClick={() => setHandoffRequested(true)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Escalate to human helpdesk
              </button>
            ) : (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="mb-1 text-xs font-medium text-slate-700">Handoff summary</p>
                <textarea
                  value={handoffText}
                  onChange={(event) => setHandoffText(event.target.value)}
                  rows={3}
                  className="input w-full text-xs"
                  placeholder="Describe what you need help with..."
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={requestHumanHandoff}
                    disabled={handoffLoading}
                    className="btn-primary h-8 px-3 text-xs"
                  >
                    {handoffLoading ? 'Sending...' : 'Send to helpdesk'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHandoffRequested(false);
                      setHandoffText('');
                    }}
                    className="btn-outline h-8 px-3 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
            className="border-t border-slate-100 p-3"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="input h-10"
                placeholder="Ask a question..."
              />
              <button type="submit" className="btn-primary h-10 px-3">
                Send
              </button>
            </div>
          </form>
          <div className="border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/concierge');
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Open live helpdesk
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-primary-500 p-3 text-slate-900 shadow-lg hover:bg-primary-400"
          aria-label="Open assistant"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5l-1.5 3L2 16a8 8 0 1115 0h-4"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
