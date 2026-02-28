import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import SupportVideoPanel from '@/components/calls/SupportVideoPanel';
import DialPad from '@/components/calls/DialPad';
import { messageService } from '@/services';
import { useSocketPresence } from '@/hooks/useSocketPresence';

type CallsTab = 'dialpad' | 'recents' | 'contacts';
type ContactType = 'Staff' | 'Guest' | 'External';

type CallContact = {
  id: string;
  name: string;
  phone: string;
  type: ContactType;
};

type RecentCall = {
  id: string;
  number: string;
  createdAt: string;
};

const CONTACTS_KEY = 'laflo-calls-contacts';
const RECENTS_KEY = 'laflo-calls-recents';

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

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function CallsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emitCallAccept, emitCallDecline, emitPresenceSet } = useSocketPresence();

  const room = searchParams.get('room') || '';
  const incoming = searchParams.get('incoming') === '1';
  const from = searchParams.get('from') || '';
  const returnTo = searchParams.get('returnTo') || '/messages';

  const [activeTab, setActiveTab] = useState<CallsTab>('dialpad');
  const [dial, setDial] = useState('');
  const [recents, setRecents] = useState<RecentCall[]>([]);
  const [contacts, setContacts] = useState<CallContact[]>([]);
  const [contactQuery, setContactQuery] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactType, setNewContactType] = useState<ContactType>('External');

  const dialable = useMemo(() => sanitizePhone(dial), [dial]);
  const ringIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
    );
  }, [contacts, contactQuery]);

  useEffect(() => {
    setContacts(loadJson<CallContact[]>(CONTACTS_KEY, []));
    setRecents(loadJson<RecentCall[]>(RECENTS_KEY, []));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  }, [recents]);

  useEffect(() => {
    if (!room || incoming) return;
    emitPresenceSet('BUSY');
  }, [room, incoming, emitPresenceSet]);

  useEffect(() => {
    if (!incoming || !room) return;

    const playTone = () => {
      try {
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        if (!audioContextRef.current) audioContextRef.current = new Ctx();
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.36);
      } catch {
        // ignore audio playback errors
      }
    };

    playTone();
    ringIntervalRef.current = window.setInterval(playTone, 1100);

    return () => {
      if (ringIntervalRef.current) {
        window.clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
    };
  }, [incoming, room]);

  const placeExternalCall = async (rawNumber: string) => {
    const normalized = sanitizePhone(rawNumber);
    if (!/^\+?\d{7,15}$/.test(normalized)) {
      toast.error('Enter a valid phone number.');
      return;
    }

    try {
      const started = await messageService.startSupportPhoneCall({ to: normalized });
      setDial(normalized);
      setRecents((prev) => [
        { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, number: normalized, createdAt: new Date().toISOString() },
        ...prev,
      ].slice(0, 20));
      toast.success(`Call started (${started.sid.slice(-8)})`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to start call');
    }
  };

  const addContact = () => {
    const name = newContactName.trim();
    const phone = sanitizePhone(newContactPhone);
    if (!name) {
      toast.error('Contact name is required.');
      return;
    }
    if (!/^\+?\d{7,15}$/.test(phone)) {
      toast.error('Enter a valid contact phone number.');
      return;
    }

    setContacts((prev) => [
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, phone, type: newContactType },
      ...prev,
    ]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactType('External');
    setShowAddContact(false);
    toast.success('Contact added');
  };

  if (!room) {
    return (
      <div className="h-[calc(100vh-0px)] w-full bg-slate-50">
        <div className="mx-auto flex h-full w-full max-w-7xl gap-5 px-6 py-6">
          <aside className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="px-2 pb-2 text-lg font-semibold text-slate-900">Calls</div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('dialpad')}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                  activeTab === 'dialpad' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Dial pad
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('recents')}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                  activeTab === 'recents' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Recents
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('contacts')}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                  activeTab === 'contacts' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Contacts
              </button>
            </div>
          </aside>

          <main className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {activeTab === 'dialpad' ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-4 text-center">
                  <div className="text-xl font-semibold text-slate-900">Dial pad</div>
                  <div className="mt-1 text-sm text-slate-500">Call external numbers quickly</div>
                </div>
                <DialPad
                  value={dial}
                  onChange={setDial}
                  disabled={!/^\+?\d{7,15}$/.test(dialable)}
                  onCall={() => void placeExternalCall(dial)}
                  onOpenContacts={() => setActiveTab('contacts')}
                />
              </div>
            ) : null}

            {activeTab === 'recents' ? (
              <div className="h-full">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">Recent calls</h2>
                  <button
                    type="button"
                    onClick={() => setRecents([])}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clear all
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {recents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No recent calls yet.
                    </div>
                  ) : (
                    recents.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                        <div>
                          <div className="font-semibold text-slate-900">{entry.number}</div>
                          <div className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDial(entry.number);
                              setActiveTab('dialpad');
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Use
                          </button>
                          <button
                            type="button"
                            onClick={() => void placeExternalCall(entry.number)}
                            className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                          >
                            Call
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === 'contacts' ? (
              <div className="h-full">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">Contacts</h2>
                  <button
                    type="button"
                    onClick={() => setShowAddContact(true)}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Add contact
                  </button>
                </div>

                <div className="mt-4">
                  <input
                    value={contactQuery}
                    onChange={(e) => setContactQuery(e.target.value)}
                    placeholder="Search contacts"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {filteredContacts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No contacts found.
                    </div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                        <div>
                          <div className="font-semibold text-slate-900">{contact.name}</div>
                          <div className="text-xs text-slate-500">{contact.phone}  {contact.type}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void placeExternalCall(contact.phone)}
                          className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                        >
                          Call
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </main>
        </div>

        {showAddContact ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-900">Add contact</h3>
              <div className="mt-4 space-y-3">
                <input
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Name"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
                <select
                  value={newContactType}
                  onChange={(e) => setNewContactType(e.target.value as ContactType)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Staff">Staff</option>
                  <option value="Guest">Guest</option>
                  <option value="External">External</option>
                </select>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addContact}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
                navigate(
                  `/calls?room=${encodeURIComponent(room)}&returnTo=${encodeURIComponent(returnTo)}`,
                  { replace: true }
                );
              }}
            >
              Accept
            </button>
            <button
              className="flex-1 rounded-xl bg-white/10 py-2.5 font-semibold hover:bg-white/15"
              onClick={() => {
                emitCallDecline(room);
                navigate(returnTo, { replace: true });
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
        onHangup={() => {
          emitPresenceSet('AVAILABLE');
          navigate(returnTo, { replace: true });
        }}
      />
    </div>
  );
}
