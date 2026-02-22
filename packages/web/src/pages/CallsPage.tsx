import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import { messageService } from '@/services';
import SupportVideoPanel from '@/components/calls/SupportVideoPanel';
import type { MessageThreadSummary, SupportVoiceToken } from '@/types';
import type { Device, Call } from '@twilio/voice-sdk';

const LETTER_TO_DIGIT: Record<string, string> = {
  A: '2',
  B: '2',
  C: '2',
  D: '3',
  E: '3',
  F: '3',
  G: '4',
  H: '4',
  I: '4',
  J: '5',
  K: '5',
  L: '5',
  M: '6',
  N: '6',
  O: '6',
  P: '7',
  Q: '7',
  R: '7',
  S: '7',
  T: '8',
  U: '8',
  V: '8',
  W: '9',
  X: '9',
  Y: '9',
  Z: '9',
};

const sanitizePhone = (value?: string) => {
  const input = (value || '').toUpperCase();
  let output = '';
  for (const ch of input) {
    if (/\d/.test(ch)) {
      output += ch;
      continue;
    }
    if (ch === '+' && output.length === 0) {
      output += ch;
      continue;
    }
    if (LETTER_TO_DIGIT[ch]) {
      output += LETTER_TO_DIGIT[ch];
    }
  }
  return output;
};

const formatThreadName = (thread: MessageThreadSummary) => {
  if (thread.guest) return `${thread.guest.firstName} ${thread.guest.lastName}`;
  return thread.subject || 'Guest';
};

const isValidDialable = (value: string) => /^\+?\d{7,15}$/.test(value);
type RecentCallStatus = 'Dialed' | 'Failed' | 'Ended';

export default function CallsPage() {
  const [dialNumber, setDialNumber] = useState('');
  const [keypadMode, setKeypadMode] = useState<'DIGITS' | 'ALT'>('DIGITS');
  const [voiceState, setVoiceState] = useState<'IDLE' | 'CONNECTING' | 'IN_CALL' | 'ERROR'>('IDLE');
  const [voiceError, setVoiceError] = useState('');
  const [activeCallTarget, setActiveCallTarget] = useState<string>('');
  const [recentCalls, setRecentCalls] = useState<Array<{ number: string; at: string; status: RecentCallStatus }>>([]);
  const lastKeypadTapRef = useRef<{ key: string; at: number; index: number } | null>(null);
  const voiceDeviceRef = useRef<Device | null>(null);
  const voiceCallRef = useRef<Call | null>(null);

  const pushRecentCall = (number: string, status: RecentCallStatus) => {
    setRecentCalls((prev) => [{ number, at: new Date().toISOString(), status }, ...prev].slice(0, 10));
  };

  const { data: threadData } = useQuery({
    queryKey: ['calls-threads'],
    queryFn: () => messageService.listThreads(''),
    refetchInterval: 15_000,
  });

  const suggestedContacts = useMemo(
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

  const appendDialKey = (key: { digit: string; letters: string }) => {
    if (keypadMode === 'DIGITS') {
      setDialNumber((prev) => `${prev}${key.digit}`);
      lastKeypadTapRef.current = null;
      return;
    }

    if (key.digit === '0' && key.letters === '+') {
      setDialNumber((prev) => `${prev}+`);
      lastKeypadTapRef.current = null;
      return;
    }

    if (!key.letters) {
      setDialNumber((prev) => `${prev}${key.digit}`);
      lastKeypadTapRef.current = null;
      return;
    }

    const now = Date.now();
    const previousTap = lastKeypadTapRef.current;
    setDialNumber((prev) => {
      const letters = key.letters.split('');
      if (
        previousTap &&
        previousTap.key === key.digit &&
        now - previousTap.at < 1200 &&
        prev.length > 0
      ) {
        const nextIndex = (previousTap.index + 1) % letters.length;
        lastKeypadTapRef.current = { key: key.digit, at: now, index: nextIndex };
        return `${prev.slice(0, -1)}${letters[nextIndex]}`;
      }

      lastKeypadTapRef.current = { key: key.digit, at: now, index: 0 };
      return `${prev}${letters[0]}`;
    });
  };

  const backspace = () => {
    setDialNumber((prev) => prev.slice(0, -1));
  };

  const ensureVoiceDevice = async (): Promise<Device | null> => {
    if (voiceDeviceRef.current) return voiceDeviceRef.current;
    let tokenData: SupportVoiceToken;
    try {
      tokenData = await messageService.getSupportVoiceToken();
    } catch {
      setVoiceError('In-app calling is not configured yet. Use Call via phone dialer.');
      setVoiceState('ERROR');
      return null;
    }
    try {
      const sdk = await import('@twilio/voice-sdk');
      const device = new sdk.Device(tokenData.token, {
        edge: 'ashburn',
        logLevel: 0,
      });
      device.on('error', (error) => {
        setVoiceError(error.message || 'Voice device error');
        setVoiceState('ERROR');
      });
      device.on('tokenWillExpire', async () => {
        try {
          const refreshed = await messageService.getSupportVoiceToken();
          await device.updateToken(refreshed.token);
        } catch {
          setVoiceError('Failed to refresh voice token');
          setVoiceState('ERROR');
        }
      });
      await device.register();
      voiceDeviceRef.current = device;
      return device;
    } catch {
      setVoiceError('Unable to initialize in-app calling on this browser.');
      setVoiceState('ERROR');
      return null;
    }
  };

  const startInAppCall = async () => {
    const phone = sanitizePhone(dialNumber);
    if (!phone || !isValidDialable(phone)) {
      setVoiceError('Enter a valid phone number (7-15 digits).');
      setVoiceState('ERROR');
      return;
    }

    setVoiceError('');
    setVoiceState('CONNECTING');
    setActiveCallTarget(phone);

    const device = await ensureVoiceDevice();
    if (!device) {
      pushRecentCall(phone, 'Failed');
      setActiveCallTarget('');
      return;
    }

    try {
      const call = await device.connect({ params: { To: phone } });
      voiceCallRef.current = call;
      setVoiceState('IN_CALL');
      pushRecentCall(phone, 'Dialed');
      call.on('disconnect', () => {
        setVoiceState('IDLE');
        setActiveCallTarget('');
        pushRecentCall(phone, 'Ended');
        voiceCallRef.current = null;
      });
    } catch {
      setVoiceError('Failed to place in-app call.');
      setVoiceState('ERROR');
      setActiveCallTarget('');
      pushRecentCall(phone, 'Failed');
    }
  };

  const startTwilioPhoneCall = async () => {
    const phone = sanitizePhone(dialNumber);
    if (!phone || !isValidDialable(phone)) {
      setVoiceError('Enter a valid phone number (7-15 digits).');
      setVoiceState('ERROR');
      return;
    }

    setVoiceError('');
    try {
      const call = await messageService.startSupportPhoneCall({ to: phone });
      pushRecentCall(phone, 'Dialed');
      toast.success(`Twilio call started (${call.sid.slice(-8)})`);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to start Twilio phone call';
      pushRecentCall(phone, 'Failed');
      toast.error(message);
    }
  };

  const endInAppCall = () => {
    if (voiceCallRef.current) {
      voiceCallRef.current.disconnect();
      voiceCallRef.current = null;
    }
    setVoiceState('IDLE');
    setActiveCallTarget('');
  };

  useEffect(
    () => () => {
      if (voiceCallRef.current) {
        voiceCallRef.current.disconnect();
      }
      if (voiceDeviceRef.current) {
        void voiceDeviceRef.current.destroy();
      }
    },
    []
  );

  const keypad: Array<{ digit: string; letters: string }> = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ];
  const dialable = sanitizePhone(dialNumber);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className={PAGE_TITLE_CLASS}>Calls</h1>
        <p className="text-xs text-slate-500">Use in-app call or your phone dialer.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Dial Pad</h2>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              placeholder="+1 555 123 4567"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={backspace}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Del
            </button>
          </div>
          <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setKeypadMode('DIGITS')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                keypadMode === 'DIGITS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              123
            </button>
            <button
              type="button"
              onClick={() => setKeypadMode('ALT')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                keypadMode === 'ALT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ABC / +
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {keypadMode === 'ALT'
              ? 'ABC/+ mode: tap 2-9 repeatedly to cycle letters (A-B-C, etc.).'
              : '123 mode: tap to enter dialable digits and symbols.'}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-y-4">
            {keypad.map((key) => (
              <button
                key={key.digit}
                type="button"
                onClick={() => appendDialKey(key)}
                className="group flex flex-col items-center rounded-xl py-2 text-center text-slate-700 transition hover:bg-primary-50/60"
              >
                <span className="text-xl font-semibold leading-none tracking-tight text-slate-700">
                  {keypadMode === 'ALT' && (key.letters || key.digit === '0') ? (key.digit === '0' ? '+' : key.letters) : key.digit}
                </span>
                <span className="mt-1 min-h-[14px] text-[10px] font-semibold tracking-wide text-slate-400">
                  {keypadMode === 'ALT' ? key.digit : key.letters}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void startInAppCall()}
              disabled={voiceState === 'CONNECTING' || voiceState === 'IN_CALL' || !isValidDialable(dialable)}
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {voiceState === 'CONNECTING' ? 'Connecting...' : voiceState === 'IN_CALL' ? 'In call' : 'Call in app'}
            </button>
            <button
              type="button"
              onClick={() => void startTwilioPhoneCall()}
              disabled={!isValidDialable(dialable)}
              className="rounded-xl border border-primary-300 bg-primary-50 px-4 py-2.5 text-center text-sm font-semibold text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Call via Twilio
            </button>
          </div>
          <a
            href={isValidDialable(dialable) ? `tel:${dialable}` : '#'}
            onClick={(event) => {
              if (!isValidDialable(dialable)) event.preventDefault();
            }}
            className={`mt-2 inline-block text-xs font-medium ${
              isValidDialable(dialable) ? 'text-slate-600 hover:text-slate-800' : 'pointer-events-none text-slate-400'
            }`}
          >
            Open phone dialer fallback
          </a>

          {voiceState === 'IN_CALL' ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-800">Connected: {activeCallTarget}</p>
              <button
                type="button"
                onClick={endInAppCall}
                className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                End call
              </button>
            </div>
          ) : null}

          {voiceError ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {voiceError}
            </p>
          ) : null}

          <div className="mt-4">
            <SupportVideoPanel roomName={`laflo-calls-${dialable || 'support'}`} title="In-app video (support)" />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Quick Contacts</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {suggestedContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => setDialNumber(contact.phone)}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
              >
                <p className="text-sm font-semibold text-slate-900">{contact.name}</p>
                <p className="text-xs text-slate-500">{contact.phone}</p>
              </button>
            ))}
            {suggestedContacts.length === 0 ? (
              <p className="text-sm text-slate-500">No guest phone numbers available yet.</p>
            ) : null}
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Calls</h3>
            <div className="mt-2 space-y-2">
              {recentCalls.map((entry, index) => (
                <div key={`${entry.number}-${entry.at}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{entry.number}</p>
                    <p className="text-[11px] text-slate-500">{new Date(entry.at).toLocaleString()}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      entry.status === 'Dialed'
                        ? 'bg-sky-100 text-sky-700'
                        : entry.status === 'Ended'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {entry.status}
                  </span>
                </div>
              ))}
              {recentCalls.length === 0 ? (
                <p className="text-sm text-slate-500">No calls yet.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
