import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import { messageService } from '@/services';
import type { MessageThreadSummary, SupportVoiceToken } from '@/types';
import type { Device, Call } from '@twilio/voice-sdk';

const sanitizePhone = (value?: string) => (value || '').replace(/[^\d+]/g, '');

const formatThreadName = (thread: MessageThreadSummary) => {
  if (thread.guest) return `${thread.guest.firstName} ${thread.guest.lastName}`;
  return thread.subject || 'Guest';
};

const isValidDialable = (value: string) => /^\+?\d{7,15}$/.test(value);
type RecentCallStatus = 'Dialed' | 'Failed' | 'Ended';

export default function CallsPage() {
  const [dialNumber, setDialNumber] = useState('');
  const [voiceState, setVoiceState] = useState<'IDLE' | 'CONNECTING' | 'IN_CALL' | 'ERROR'>('IDLE');
  const [voiceError, setVoiceError] = useState('');
  const [activeCallTarget, setActiveCallTarget] = useState<string>('');
  const [recentCalls, setRecentCalls] = useState<Array<{ number: string; at: string; status: RecentCallStatus }>>([]);
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

  const appendDigit = (digit: string) => {
    setDialNumber((prev) => `${prev}${digit}`);
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

          <div className="mt-4 grid grid-cols-3 gap-y-4">
            {keypad.map((key) => (
              <button
                key={key.digit}
                type="button"
                onClick={() => appendDigit(key.digit)}
                className="group flex flex-col items-center rounded-xl py-2 text-center text-indigo-700 transition hover:bg-indigo-50/60"
              >
                <span className="text-4xl font-semibold leading-none">{key.digit}</span>
                <span className="mt-1 min-h-[14px] text-xs font-semibold tracking-wide text-indigo-500">
                  {key.letters}
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
