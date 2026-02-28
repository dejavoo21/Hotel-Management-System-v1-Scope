export default function AssistantChatPanel() {
  const prompts = [
    'Should we increase prices this weekend?',
    'Are arrivals at risk due to weather?',
    'What needs attention today?',
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-sm font-semibold text-slate-900">Operations Assistant</div>
      <p className="mt-1 text-xs text-slate-500">Live assistant integration point (LLM hookup next phase).</p>
      <div className="mt-3 space-y-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
