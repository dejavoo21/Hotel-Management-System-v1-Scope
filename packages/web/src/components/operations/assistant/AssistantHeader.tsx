import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadTranscript } from '@/utils/downloadTranscript';
import api from '@/services/api';

export type ChatMode = 'operations' | 'pricing' | 'weather' | 'general';

export default function AssistantHeader({
  mode,
  setMode,
  conversationId,
}: {
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
  conversationId?: string;
}) {
  const [openMenu, setOpenMenu] = useState(false);

  async function shareTranscript() {
    try {
      if (!conversationId) {
        toast.error('No conversation yet');
        return;
      }
      const recipientUserId = prompt('Enter staff user ID to share transcript:');
      if (!recipientUserId) return;

      await api.post(`/conversations/${conversationId}/share-transcript`, {
        recipientUserId,
      });

      toast.success('Transcript shared');
      setOpenMenu(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to share transcript');
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <select
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        value={mode}
        onChange={(e) => setMode(e.target.value as ChatMode)}
      >
        <option value="operations">Operations mode</option>
        <option value="pricing">Pricing mode</option>
        <option value="weather">Weather mode</option>
        <option value="general">General mode</option>
      </select>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
        >
          ⋯
        </button>

        {openMenu && (
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            <button
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={async () => {
                if (!conversationId) {
                  toast.error('No conversation yet');
                  return;
                }
                await downloadTranscript(conversationId);
                setOpenMenu(false);
              }}
            >
              Download transcript
            </button>

            <button
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={shareTranscript}
            >
              Share to staff
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              disabled
              className="w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm text-slate-400"
            >
              Email transcript (coming soon)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
