import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import { callsService, getApiError, messageService } from '@/services';
import DialPad from '@/components/calls/DialPad';
import DialerNumberDisplay from '@/components/calls/DialerNumberDisplay';
import CallActions from '@/components/calls/CallActions';
import QuickContacts from '@/components/calls/QuickContacts';
import RecentCalls from '@/components/calls/RecentCalls';
import SupportVideoPanel from '@/components/calls/SupportVideoPanel';
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
type RecentCall = {
  callId?: string;
  number: string;
  at: string;
  status: CallLifecycleStatus;
};

export default function CallsPage() {
  const [searchParams] = useSearchParams();
  const [dialNumber, setDialNumber] = useState('');
  const [isDialing, setIsDialing] = useState(false);
  const [callStatus, setCallStatus] = useState<CallLifecycleStatus | null>(null);
  const [callStatusText, setCallStatusText] = useState('');
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);

  // Support internal calls via ?room= query param
  const roomParam = searchParams.get('room');
  const isInternalCall = roomParam?.startsWith('laflo-internal-');

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

  const pushRecentCall = (entry: RecentCall) => {
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
    setCallStatusText('Dialing…');

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
          ? 'Call queued. Connecting shortly…'
          : response.status === 'ringing'
            ? 'Ringing…'
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={PAGE_TITLE_CLASS}>{isInternalCall ? 'Internal Call' : 'Calls'}</h1>
          <p className="text-sm text-text-muted">
            {isInternalCall
              ? 'Staff-to-staff video call. Join the room below to connect.'
              : 'Place internal or external calls from one dialer interface.'}
          </p>
        </div>
      </div>

      {/* Show internal call video panel prominently when room param is present */}
      {isInternalCall && roomParam && (
        <section className="rounded-3xl border-2 border-primary-200 bg-primary-50 p-4 shadow-card">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-primary-700">Internal Video Call</h2>
            <p className="text-sm text-primary-600 mt-1">Room: {roomParam}</p>
          </div>
          <SupportVideoPanel roomName={roomParam} title="Join Call" />
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-card p-4 shadow-card">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text-main">{isInternalCall ? 'Phone Dialer' : 'Dialer'}</h2>
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

          <div className="mt-4 border-t border-border pt-4">
            <SupportVideoPanel roomName={`laflo-calls-${dialable || 'support'}`} title="Video Session" />
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
