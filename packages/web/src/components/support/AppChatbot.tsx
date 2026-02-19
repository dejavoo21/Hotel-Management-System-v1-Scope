import { useMemo, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
};

const quickPrompts = [
  'How do I add a booking?',
  'How do I update room status?',
  'Where can I send an invoice?',
  'How do I request access?',
];

function getBotReply(input: string) {
  const text = input.toLowerCase();
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
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hi, I am LaFlo Assistant. Ask me how to do tasks in this app.',
    },
  ]);

  const sendMessage = (text: string) => {
    const value = text.trim();
    if (!value) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: value };
    const botMsg: ChatMessage = {
      id: `b-${Date.now()}-${Math.random()}`,
      role: 'bot',
      text: getBotReply(value),
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
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

