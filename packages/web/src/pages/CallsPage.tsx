import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { callsService, getApiError, messageService } from '@/services';
import DialPad from '@/components/calls/DialPad';
import DialerNumberDisplay from '@/components/calls/DialerNumberDisplay';
import CallActions from '@/components/calls/CallActions';
import QuickContacts from '@/components/calls/QuickContacts';
import RecentCalls from '@/components/calls/RecentCalls';
import SupportVideoPanel from '@/components/calls/SupportVideoPanel';
import { useSocketPresence } from '@/hooks/useSocketPresence';
import type { MessageThreadSummary } from '@/types';

const LETTER_TO_DIGIT: Record<string, string> = {
  A: '2', B: '2', C: '2',
  D: '3', E: '3', F: '3',
  G: '4', H: '4', I: '4',
  J: '5', K: '5', L: '5',
  M: '6', N: '6', O: '6',
  P: '7', Q: '7', R: '7', S: '7',
  T: '8', U: '8', V: '8',
  W: '9', X: '9', Y: '9', Z: '9',
};

const sanitizePhone = (value?: string) => {
  const input = (value || '').toUpperCase();
  let output = '';
  for (const ch of input) {
    if (/\d/.test(ch)) output += ch;
    else if (ch === '+' && output.length === 0) output += ch;
    else if (LETTER_TO_DIGIT[ch]) output += LETTER_TO_DIGIT[ch];
  }
  return output;
};

const isValidDialable = (value: string) => /^\+?\d{7,15}$/.test(value);

const formatThreadName = (thread: MessageThreadSummary) => {
  if (thread.guest) return `${thread.guest.firstName} ${thread.guest.lastName}`;
  return thread.subject || 'Guest';
};

type CallLifecycleStatus = 'queued' | 'ringing' | 'connected' | 'failed';
type RecentCallEntry = {
  callId?: string;
  number: string;
  at: string;
  status: CallLifecycleStatus;
};

export default function CallsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emitCallAccept, emitCallDecline } = useSocketPresence();

  const [dialNumber, setDialNumber] = useState('');
  const [isDialing, setIsDialing] = useState(false);
  const [callStatus, setCallStatus] = useState<CallLifecycleStatus | null>(null);
  const [callStatusText, setCallStatusText] = useState('');
  const [recentCalls, setRecentCalls] = useState<RecentCallEntry[]>([]);

  const room = searchParams.get('room') || '';
  const incoming = searchParams.get('incoming') === '1';
  const from = searchParams.get('from') || '';

  const { data: threadData } = useQuery({
    queryKey: ['calls-threads'],
    queryFn: () => messageService.listThreads(''),
    refetchInterval: 15_000,
  });

  const quickContacts = useMemo(
    () =>
      (threadData || [])
        .map((thread) => ({
          id: thread.id,
          name: formatThreadName(thread),
          phone: sanitizePhone(thread.guest?.phone || ''),
        }))
        .filter((entry) => Boolean(entry.phone))
        .slice(0, 8),
    [threadData]
  );

  const pushRecentCall = (entry: RecentCallEntry) => {
    setRecentCalls((prev) => [entry, ...prev].slice(0, 10));
  };

  const appendDigit = (digit: string) => setDialNumber((prev) => `${prev}${digit}`);
  const appendPlus = () => setDialNumber((prev) => `${prev}+`);
  const backspace = () => setDialNumber((prev) => prev.slice(0, -1));

  const dialable = sanitizePhone(dialNumber);
  const canCall = isValidDialable(dialable) && !isDialing;

  const handleCall = async (source: 'dialpad' | 'quick_contact' = 'dialpad') => {
    if (!isValidDialable(dialable)) {
      setCallStatus('failed');
      setCallStatusText('Enter a valid phone number before calling.');
      return;
    }

    setIsDialing(true);
    setCallStatus('queued');
    setCallStatusText('Dialing...');

    try {
      const response = await callsService.createCall({
        to: dialable,
        source,
        metadata: {
          rawInput: dialNumber,
          initiatedAt: new Date().toISOString(),
        },
      });

      setCallStatus(response.status);
      setCallStatusText(
        response.status === 'queued'
          ? 'Call queued. Connecting shortly...'
          : response.status === 'ringing'
            ? 'Ringing...'
            : response.status === 'connected'
              ? 'Call connected.'
              : 'Call failed.'
      );

      pushRecentCall({
        callId: response.callId,
        number: dialable,
        at: new Date().toISOString(),
        status: response.status,
      });
    } catch (error) {
      const apiError = getApiError(error);
      setCallStatus('failed');
      setCallStatusText('Unable to place the call right now. Please try again.');
      pushRecentCall({
        number: dialable,
        at: new Date().toISOString(),
        status: 'failed',
      });
      toast.error(apiError.message || 'Unable to place call');
    } finally {
      setIsDialing(false);
    }
  };

  if (!room) {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
          <section className="rounded-3xl border border-border bg-card p-4 shadow-card">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-text-main">Dialer</h2>
            </div>

            <DialerNumberDisplay
              value={dialNumber}
              onChange={(value) => {
                setDialNumber(value);
                if (callStatusText) {
                  setCallStatus(null);
                  setCallStatusText('');
                }
              }}
              onBackspace={backspace}
              disabled={isDialing}
            />

            <div className="mt-4">
              <DialPad
                onKeyPress={(digit) => {
                  appendDigit(digit);
                  if (callStatusText) {
                    setCallStatus(null);
                    setCallStatusText('');
                  }
                }}
                onPlusInsert={() => {
                  appendPlus();
                  if (callStatusText) {
                    setCallStatus(null);
                    setCallStatusText('');
                  }
                }}
              />
            </div>

            <div className="mt-4">
              <CallActions
                disabled={!canCall}
                dialing={isDialing}
                onCall={() => void handleCall('dialpad')}
                status={callStatus}
                statusLabel={callStatusText || undefined}
              />
            </div>
          </section>

          <div className="space-y-5">
            <QuickContacts
              contacts={quickContacts}
              onSelect={(contact) => {
                setDialNumber(contact.phone);
                setCallStatus(null);
                setCallStatusText('');
              }}
            />
            <RecentCalls items={recentCalls} />
          </div>
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
