import { useNavigate, useSearchParams } from 'react-router-dom';
import SupportVideoPanel from '@/components/calls/SupportVideoPanel';
import { useSocketPresence } from '@/hooks/useSocketPresence';

export default function CallsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emitCallAccept, emitCallDecline } = useSocketPresence();

  const room = searchParams.get('room') || '';
  const incoming = searchParams.get('incoming') === '1';
  const from = searchParams.get('from') || '';

  if (!room) {
    return (
      <div className="flex h-[calc(100vh-0px)] w-full items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">Calls</div>
          <div className="mt-1 text-sm text-white/60">No active call</div>
        </div>
      </div>
    );
  }

  if (incoming) {
    return (
      <div className="flex h-[calc(100vh-0px)] w-full items-center justify-center bg-slate-950 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Incoming call</div>
          <div className="mt-1 text-xl font-semibold">Support call</div>
          {from ? <div className="mt-1 text-sm text-white/60">From: {from}</div> : null}

          <div className="mt-6 flex gap-3">
            <button
              className="flex-1 rounded-xl bg-sky-600 py-2.5 font-semibold hover:bg-sky-700"
              onClick={() => {
                emitCallAccept(room);
                navigate(`/calls?room=${encodeURIComponent(room)}`, { replace: true });
              }}
            >
              Accept
            </button>
            <button
              className="flex-1 rounded-xl bg-white/10 py-2.5 font-semibold hover:bg-white/15"
              onClick={() => {
                emitCallDecline(room);
                navigate('/messages', { replace: true });
              }}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-0px)] w-full bg-slate-950">
      <SupportVideoPanel roomName={room} title="Call" fullPage />
    </div>
  );
}
