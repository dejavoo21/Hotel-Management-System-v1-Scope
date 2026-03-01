import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { assistantService } from '@/services';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export default function AssistantChatPanel() {
  const prompts = [
    'Should we increase prices this weekend?',
    'Are arrivals at risk due to weather?',
    'What needs attention today?',
  ];
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const askAssistant = useMutation({
    mutationFn: (message: string) => assistantService.ops(message),
    onSuccess: (reply, message) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: message },
        { role: 'assistant', text: reply || 'Done.' },
      ]);
      setInput('');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.message || 'Assistant unavailable';
      toast.error(message);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || askAssistant.isPending) return;
    askAssistant.mutate(message);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-sm font-semibold text-slate-900">Operations Assistant</div>
      <p className="mt-1 text-xs text-slate-500">Ask for recommendations or create tasks from live context.</p>

      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            No messages yet.
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-lg px-3 py-2 text-xs ${
                message.role === 'assistant'
                  ? 'border border-slate-200 bg-white text-slate-700'
                  : 'bg-slate-900 text-white'
              }`}
            >
              {message.text}
            </div>
          ))
        )}
      </div>

      <div className="mt-3 space-y-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={askAssistant.isPending}
            onClick={() => askAssistant.mutate(prompt)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={submit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask operations assistant..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none ring-slate-200 focus:ring-2"
        />
        <button
          type="submit"
          disabled={askAssistant.isPending || !input.trim()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {askAssistant.isPending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
