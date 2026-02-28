import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import SupportVideoPanel from '@/components/calls/SupportVideoPanel';
import DialPad from '@/components/calls/DialPad';
import { messageService } from '@/services';
import { useSocketPresence } from '@/hooks/useSocketPresence';

const sanitizePhone = (value?: string) => {
  const input = (value || '').toUpperCase();
  let output = '';
  const LETTER_TO_DIGIT: Record<string, string> = {
    A: '2', B: '2', C: '2', D: '3', E: '3', F: '3', G: '4', H: '4', I: '4',
    J: '5', K: '5', L: '5', M: '6', N: '6', O: '6', P: '7', Q: '7', R: '7', S: '7',
    T: '8', U: '8', V: '8', W: '9', X: '9', Y: '9', Z: '9',
  };
  for (const ch of input) {
    if (/\d/.test(ch)) {
      output += ch;
      continue;
    }
    if (ch === '+' && output.length === 0) {
      output += ch;
      continue;
    }
    if (LETTER_TO_DIGIT[ch]) output += LETTER_TO_DIGIT[ch];
  }
  return output;
};

export default function CallsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emitCallAccept, emitCallDecline, emitPresenceSet } = useSocketPresence();

  const room = searchParams.get('room') || '';
  const incoming = searchParams.get('incoming') === '1';
  const from = searchParams.get('from') || '';

  const [dial, setDial] = useState('');
  const dialable = useMemo(() => sanitizePhone(dial), [dial]);

  useEffect(() => {
    if (!room || incoming) return;
    emitPresenceSet('BUSY');
  }, [room, incoming, emitPresenceSet]);

  if (!room) {
    return (
      <div className="flex h-[calc(100vh-0px)] w-full bg-slate-50">
        <div className="flex w-full flex-col items-center justify-center px-6">
          <div className="mb-4 text-center">
            <div className="text-xl font-semibold text-slate-900">Calls</div>
            <div className="mt-1 text-sm text-slate-500">Dial a number to start an audio call</div>
          </div>

          <DialPad
            value={dial}
            onChange={setDial}
            disabled={!/^\+?\d{7,15}$/.test(dialable)}
            onCall={async () => {
              if (!/^\+?\d{7,15}$/.test(dialable)) {
                toast.error('Enter a valid phone number.');
                return;
              }
              try {
                const started = await messageService.startSupportPhoneCall({ to: dialable });
                toast.success(`Call started (${started.sid.slice(-8)})`);
              } catch (err: any) {
                toast.error(err?.response?.data?.error || 'Failed to start call');
              }
            }}
          />
        </div>
      </div>
    );
  }

  if (incoming) {
    return (
      <div className="flex h-[calc(100vh-0px)] w-full items-center justify-center bg-slate-950 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Incoming call</div>
          <div className="mt-1 text-xl font-semibold">Internal call</div>
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
    <div className="h-[calc(100vh-0px)] w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <SupportVideoPanel
        roomName={room}
        title="Call"
        fullPage
        onHangup={() => emitPresenceSet('AVAILABLE')}
      />
    </div>
  );
}
