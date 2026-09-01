import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle, ArrowRightLeft, Bot, Building2, Clock3, ContactRound, Delete, Mail,
  MessageSquare, Phone, PhoneCall, PhoneMissed, Search, UserRoundCheck, UsersRound,
} from 'lucide-react';
import { bookingService, guestService, messageService } from '@/services';
import { openLafloAssistant } from '@/lib/assistantEvents';
import { canAccess } from '@/lib/access';
import { useAuthStore } from '@/stores/authStore';
import type { Guest } from '@/types';

type CallsTab = 'dialpad' | 'recents' | 'contacts';
type CallFilter = 'all' | 'incoming' | 'outgoing' | 'missed' | 'guest' | 'room' | 'department';
type RecentCall = { id: string; number: string; name: string; guestId?: string; type: 'guest' | 'external'; direction: 'outgoing'; status: string; createdAt: string };

const RECENTS_KEY = 'laflo-calls-recents-v2';
const keys = [['1',''],['2','ABC'],['3','DEF'],['4','GHI'],['5','JKL'],['6','MNO'],['7','PQRS'],['8','TUV'],['9','WXYZ'],['*',''],['0','+'],['#','']];
const normalize = (value: string) => value.replace(/(?!^\+)[^\d*#]/g, '').slice(0, 16);
const validNumber = (value: string) => /^\+?\d{7,15}$/.test(value) || /^\d{1,6}$/.test(value);
const loadRecents = (): RecentCall[] => {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]') as RecentCall[]; } catch { return []; }
};

export default function GuestCallsWorkspace() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canCall = canAccess(user, 'messages');
  const [tab, setTab] = useState<CallsTab>('dialpad');
  const [filter, setFilter] = useState<CallFilter>('all');
  const [dial, setDial] = useState(() => normalize(params.get('number') || ''));
  const [selectedId, setSelectedId] = useState(params.get('guestId') || '');
  const [recents, setRecents] = useState<RecentCall[]>(loadRecents);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null);
  const [note, setNote] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  const voice = useQuery({ queryKey: ['calling-provider-status'], queryFn: messageService.getSupportVoiceToken, retry: false });
  const agents = useQuery({ queryKey: ['support-agents'], queryFn: messageService.listSupportAgents, retry: false });
  const guestsQuery = useQuery({ queryKey: ['call-contacts'], queryFn: () => guestService.getGuests({ page: 1, limit: 100 }), retry: false });
  const selectedGuest = useMemo(() => guestsQuery.data?.data?.find((guest) => guest.id === selectedId) || null, [guestsQuery.data, selectedId]);
  const bookings = useQuery({ queryKey: ['call-guest-bookings', selectedId], queryFn: () => bookingService.getBookings({ guestId: selectedId, page: 1, limit: 5 }), enabled: Boolean(selectedId), retry: false });
  const activeBooking = bookings.data?.data?.find((booking) => booking.status === 'CHECKED_IN') || bookings.data?.data?.[0];
  const providerConnected = Boolean(voice.data?.enabled);
  const providerLabel = voice.isLoading ? 'Checking…' : providerConnected ? 'Connected' : 'Disconnected';

  useEffect(() => { localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 50))); }, [recents]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input, textarea, select')) return;
      if (/^[0-9*#]$/.test(event.key)) setDial((value) => normalize(value + event.key));
      if (event.key === 'Backspace') setDial((value) => value.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filteredGuests = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    return (guestsQuery.data?.data || []).filter((guest) => !query || `${guest.firstName} ${guest.lastName} ${guest.email || ''} ${guest.phone || ''}`.toLowerCase().includes(query));
  }, [contactSearch, guestsQuery.data]);
  const filteredRecents = useMemo(() => recents.filter((call) => {
    if (filter === 'all') return true;
    if (filter === 'guest') return call.type === 'guest';
    if (filter === 'outgoing') return call.direction === 'outgoing';
    return false;
  }), [filter, recents]);

  const selectGuest = (guest: Guest) => {
    setSelectedId(guest.id);
    if (guest.phone) setDial(normalize(guest.phone));
  };
  const openUnavailable = (title: string, body: string) => setDialog({ title, body });
  const placeCall = async (override?: string, guest?: Guest | null) => {
    const number = normalize(override || dial);
    if (!number) return toast.error('Enter a phone number or extension first.');
    if (!validNumber(number)) return toast.error('Enter a valid phone number or extension.');
    if (!canCall) return openUnavailable('Permission required', 'Your role does not allow outbound calling.');
    if (!providerConnected) return openUnavailable('Calling is not connected', 'Connect a calling provider in Integration Manager before placing calls.');
    setBusy(true);
    try {
      const result = await messageService.startSupportPhoneCall({ to: number });
      const contact = guest || selectedGuest;
      const recent: RecentCall = { id: result.sid, number, name: contact ? `${contact.firstName} ${contact.lastName}` : number, guestId: contact?.id, type: contact ? 'guest' : 'external', direction: 'outgoing', status: result.status, createdAt: new Date().toISOString() };
      setRecents((current) => [recent, ...current].slice(0, 50));
      toast.success(`Outbound call ${result.status.toLowerCase()}.`);
    } catch (error: any) {
      openUnavailable('Call could not be started', error?.response?.data?.error || 'The calling provider returned an error. No successful call was recorded.');
    } finally { setBusy(false); }
  };
  const saveNote = async () => {
    if (!selectedGuest) return;
    if (!note.trim()) return toast.error('Enter a note first.');
    try {
      const stamped = `[Call note · ${new Date().toLocaleString()} · ${user?.firstName || 'Staff'}] ${note.trim()}`;
      await guestService.updateGuest(selectedGuest.id, { notes: [selectedGuest.notes, stamped].filter(Boolean).join('\n') });
      await queryClient.invalidateQueries({ queryKey: ['call-contacts'] });
      setNote('');
      toast.success('Call note saved to the guest profile.');
    } catch (error: any) { openUnavailable('Note not saved', error?.response?.data?.error || 'The guest notes service is unavailable or you do not have permission.'); }
  };
  const ask = (prompt: string) => openLafloAssistant({ prompt, context: { page: 'Guest Calls', selectedGuestId: selectedGuest?.id, selectedGuest: selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}` : undefined, dialledNumber: dial || undefined, recentCallSummary: recents.slice(0, 5), visibleFilters: { tab, filter }, availableActions: ['place call', 'open guest profile', 'add call note'], restrictedActions: providerConnected ? [] : ['place call: calling provider disconnected'], sourceState: providerConnected ? 'live' : 'unavailable' } });

  const navItems: Array<{ id: CallsTab; label: string; icon: typeof Phone }> = [
    { id: 'dialpad', label: 'Dial Pad', icon: Phone }, { id: 'recents', label: 'Recents', icon: Clock3 }, { id: 'contacts', label: 'Contacts', icon: ContactRound },
  ];
  const kpis = [
    { label: 'Active Line', value: providerConnected ? '1' : '0', detail: providerLabel, icon: PhoneCall, action: () => openUnavailable('Calling provider status', providerConnected ? `Connected${voice.data?.fromPhone ? ` from ${voice.data.fromPhone}` : ''}.` : 'Calling is not connected. Connect a provider in Integration Manager.') },
    { label: 'Missed Calls Today', value: recents.filter((item) => item.status === 'missed').length, detail: 'View missed calls', icon: PhoneMissed, action: () => { setFilter('missed'); setTab('recents'); } },
    { label: 'Recent Calls', value: recents.length, detail: 'Recorded on this device', icon: Clock3, action: () => setTab('recents') },
    { label: 'Connected Contacts', value: guestsQuery.data?.pagination.total || 0, detail: 'Guest profiles', icon: UsersRound, action: () => setTab('contacts') },
    { label: 'Available Agents', value: agents.data?.filter((agent) => agent.online).length || 0, detail: agents.isError ? 'Availability unavailable' : 'Online now', icon: UserRoundCheck, action: () => openUnavailable('Agent availability', agents.isError ? 'Staff presence is unavailable.' : `${agents.data?.filter((agent) => agent.online).map((agent) => `${agent.firstName} ${agent.lastName}`).join(', ') || 'No agents are currently online.'}`) },
  ];

  return <div className="space-y-4 pb-20">
    <header className="theme-card rounded-2xl border p-5 xl:hidden"><p className="theme-link text-xs font-semibold uppercase tracking-[.16em]">Guest experience</p><p className="mt-1 text-2xl font-bold text-text-main">Guest Calls</p><p className="mt-1 text-sm text-text-muted">Connect with guests, rooms, departments, and external contacts from one place.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:ml-[376px] xl:grid-cols-4" aria-label="Call summary">{kpis.slice(0, 4).map(({ label, value, detail, icon: Icon, action }) => <button key={label} type="button" onClick={action} className="theme-kpi rounded-2xl border p-4 text-left hover:border-primary-300"><span className="flex items-start justify-between"><span><span className="block text-xs font-semibold text-text-muted">{label}</span><strong className="mt-1 block text-2xl text-text-main">{value}</strong></span><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><Icon className="h-4 w-4" /></span></span><span className="mt-2 block text-xs text-text-muted">{detail}</span></button>)}</section>
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
      <aside className="theme-card rounded-2xl border p-3"><div className="mb-4 flex items-start gap-3 border-b border-border p-2 pb-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700"><PhoneCall className="h-5 w-5" /></span><div><h1 className="text-xl font-bold text-text-main">Guest Calls</h1><p className="mt-1 text-xs text-text-muted">Connect with guests quickly and efficiently.</p></div></div><div className="space-y-1">{navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${tab === id ? 'bg-primary-50 text-primary-700' : 'text-text-muted hover:bg-bg'}`}><Icon className="h-4 w-4" />{label}</button>)}</div><div className="my-3 border-t border-border" />
        <section className="rounded-xl border border-border bg-bg p-3"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Line Status</h2><span className={`text-xs font-semibold ${providerConnected ? 'text-emerald-700' : 'text-rose-700'}`}>{providerLabel}</span></div><p className="mt-2 text-xs text-text-muted">{voice.data?.fromPhone || 'No active phone number'}</p><p className="mt-1 text-xs text-text-muted">Provider-managed voice</p><button type="button" onClick={() => navigate('/settings?tab=integrations')} className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold">Change line</button></section>
        <div className="mt-3 grid grid-cols-2 gap-2">{[kpis[0], kpis[1], kpis[2], kpis[4]].map(({ label, value, detail, icon: Icon, action }) => <button key={label} type="button" onClick={action} className="rounded-xl border border-border bg-bg p-3 text-left"><span className="flex items-start justify-between"><span><span className="block text-[10px] font-semibold text-text-muted">{label.replace(' Calls Today',' Today')}</span><strong className="mt-1 block text-lg">{value}</strong></span><Icon className="h-4 w-4 text-primary-700" /></span><span className="mt-1 block text-[9px] text-text-muted">{detail}</span></button>)}</div>
        <h2 className="mt-4 px-1 text-xs font-bold uppercase tracking-wide text-text-muted">Quick actions</h2><div className="mt-2 space-y-1">{['Call Room Directory','Intercom / Departments','Voicemail'].map((label) => <button key={label} type="button" onClick={() => openUnavailable(label, 'No live hotel directory or telephony endpoint is connected for this action.')} className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-xs font-semibold hover:bg-bg"><span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-text-muted" />{label}</span><span aria-hidden>›</span></button>)}</div>
      </aside>

      <main className="min-w-0 space-y-4">
        {tab === 'dialpad' ? <section className="theme-card rounded-2xl border p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Dial Pad</h2><p className="text-xs text-text-muted">Enter a number or select a guest contact.</p></div><button type="button" onClick={() => openUnavailable('Save contact', 'A shared contact provider is not connected. Guest profiles can be created from Guest Directory.')} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Save Contact</button></div>
          {!providerConnected && !voice.isLoading ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><span><strong>Calling is not connected.</strong> Connect a calling provider before placing calls.</span><span className="flex gap-2"><button onClick={() => navigate('/settings?tab=integrations')} className="font-semibold underline">Open Integration Manager</button><button onClick={() => ask('How do I connect calling?')} className="font-semibold underline">Ask LaFlo</button></span></div> : null}
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]"><div><div className="flex rounded-xl border border-border bg-bg"><span className="grid w-16 place-items-center border-r border-border text-xs font-semibold">+ Intl</span><input aria-label="Phone number or extension" value={dial} onChange={(event) => setDial(normalize(event.target.value))} placeholder="Enter number or extension" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none" /><button aria-label="Clear number" onClick={() => setDial('')} className="px-3 text-text-muted">×</button></div><div className="mt-3 grid grid-cols-3 gap-2">{keys.map(([key, letters]) => <button key={key} type="button" onClick={() => setDial((value) => normalize(value + key))} className="rounded-xl border border-border bg-card py-2 text-base font-semibold hover:bg-bg">{key}<span className="block text-[9px] font-medium text-text-muted">{letters || ' '}</span></button>)}</div><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => setDial((value) => value.slice(0,-1))} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-semibold"><Delete className="h-4 w-4" />Backspace</button><button type="button" disabled={busy} onClick={() => void placeCall()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-solid py-2 text-xs font-semibold text-primary-contrast disabled:opacity-50"><Phone className="h-4 w-4" />{busy ? 'Connecting…' : 'Call'}</button><button type="button" onClick={() => openUnavailable('Transfer unavailable', 'Call transfer is unavailable until a compatible calling provider is connected.')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-semibold"><ArrowRightLeft className="h-4 w-4" />Transfer</button></div></div>
            <div><h3 className="text-xs font-bold uppercase tracking-wide text-text-muted">Quick call</h3><div className="mt-2 space-y-2">{['Room Directory','Front Desk','Housekeeping','Maintenance','Security','Manager on Duty'].map((label) => <button key={label} onClick={() => openUnavailable(label, 'No verified extension is available. Connect or configure the hotel extension directory first.')} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-left text-xs font-semibold hover:border-primary-300">{label}<span className="mt-0.5 block font-normal text-text-muted">Extension unavailable</span></button>)}</div></div></div>
        </section> : null}
        {tab === 'contacts' ? <section className="theme-card rounded-2xl border p-4"><h2 className="font-semibold">Guest contacts</h2><div className="relative mt-3"><Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" /><input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search guest contacts" className="input pl-9" /></div><div className="mt-3 max-h-[480px] divide-y divide-border overflow-auto">{guestsQuery.isLoading ? <p className="p-4 text-sm text-text-muted">Loading contacts…</p> : guestsQuery.isError ? <p className="p-4 text-sm text-rose-700">Guest contacts are unavailable.</p> : filteredGuests.length ? filteredGuests.map((guest) => <button key={guest.id} onClick={() => { selectGuest(guest); setTab('dialpad'); }} className="flex w-full items-center justify-between px-2 py-3 text-left hover:bg-bg"><span><strong className="block text-sm">{guest.firstName} {guest.lastName}</strong><span className="text-xs text-text-muted">{guest.phone || 'No phone number'}</span></span><span className="text-xs font-semibold text-primary-700">Select</span></button>) : <p className="p-4 text-sm text-text-muted">No contacts found.</p>}</div></section> : null}
        {tab === 'recents' || tab === 'dialpad' ? <section className="theme-card rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Recent Calls</h2><div className="flex flex-wrap gap-1">{(['all','incoming','outgoing','missed','guest','room','department'] as CallFilter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${filter === item ? 'bg-primary-solid text-primary-contrast' : 'border border-border'}`}>{item}</button>)}</div></div>{filteredRecents.length ? <div className="mt-3 divide-y divide-border">{filteredRecents.map((call) => <div key={call.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><button onClick={() => call.guestId && setSelectedId(call.guestId)} className="text-left"><strong className="block text-sm">{call.name}</strong><span className="text-xs text-text-muted">{call.number} · {call.type}</span></button><span className="text-xs text-text-muted">{new Date(call.createdAt).toLocaleString()}</span><button onClick={() => void placeCall(call.number, guestsQuery.data?.data.find((guest) => guest.id === call.guestId))} className="rounded-lg border border-border p-2" aria-label={`Call back ${call.name}`}><Phone className="h-4 w-4" /></button></div>)}</div> : <div className="mt-3 rounded-xl border border-dashed border-border p-5 text-center"><p className="text-sm font-semibold">No recent calls yet.</p><div className="mt-3 flex justify-center gap-2"><button onClick={() => setTab('dialpad')} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Dial a number</button><button onClick={() => setTab('contacts')} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Open contacts</button><button onClick={() => ask('Who needs a follow-up call?')} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Ask LaFlo</button></div></div>}</section> : null}
      </main>

      <aside className="theme-card rounded-2xl border p-4">{selectedGuest ? <><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-100 font-bold text-primary-700">{selectedGuest.firstName[0]}{selectedGuest.lastName[0]}</span><div><h2 className="font-semibold">{selectedGuest.firstName} {selectedGuest.lastName}</h2><p className="text-xs text-text-muted">{activeBooking?.room ? `Room ${activeBooking.room.number}` : 'No current room'}{selectedGuest.vipStatus ? ' · VIP' : ''}</p><p className="mt-1 text-[10px] text-text-muted">{activeBooking ? `${new Date(activeBooking.checkInDate).toLocaleDateString()} – ${new Date(activeBooking.checkOutDate).toLocaleDateString()}` : 'No booking summary available'}</p></div></div><button onClick={() => navigate(`/guests?guestId=${selectedGuest.id}`)} className="mt-4 w-full rounded-lg border border-border py-2 text-xs font-semibold">Open Guest Profile</button><div className="mt-3 grid grid-cols-3 divide-x divide-border rounded-xl border border-border py-2"><button onClick={() => void placeCall(selectedGuest.phone || '', selectedGuest)} className="grid place-items-center gap-1 text-[10px]"><Phone className="h-4 w-4 text-primary-700" />Call</button><button onClick={() => openUnavailable('Guest messaging unavailable', 'No guest conversation is linked to this profile. No message was sent.')} className="grid place-items-center gap-1 text-[10px]"><MessageSquare className="h-4 w-4 text-sky-600" />Message</button><button onClick={() => selectedGuest.email ? window.location.assign(`mailto:${selectedGuest.email}`) : openUnavailable('Email unavailable', 'This guest has no email address.')} className="grid place-items-center gap-1 text-[10px]"><Mail className="h-4 w-4 text-violet-600" />Email</button></div><div className="mt-4 border-t border-border pt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-text-muted">Contact information</h3><p className="mt-2 text-sm">{selectedGuest.phone || 'No phone number'}</p><p className="text-sm text-text-muted">{selectedGuest.email || 'No email address'}</p></div><div className="mt-4 border-t border-border pt-4"><h3 className="text-sm font-semibold">Call Notes</h3>{selectedGuest.notes ? <p className="mt-2 whitespace-pre-wrap rounded-xl bg-amber-50 p-3 text-xs text-amber-950">{selectedGuest.notes}</p> : <p className="mt-2 text-xs text-text-muted">No notes recorded.</p>}<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a call note" className="input mt-3 min-h-20" /><button onClick={() => void saveNote()} className="mt-2 w-full rounded-lg bg-primary-solid py-2 text-xs font-semibold text-primary-contrast">Save note</button></div><button onClick={() => ask(`Summarise ${selectedGuest.firstName} ${selectedGuest.lastName} before I call.`)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 py-2.5 text-xs font-semibold text-primary-700"><Bot className="h-4 w-4" />Ask LaFlo about this guest</button></> : <div className="grid min-h-64 place-items-center text-center"><div><ContactRound className="mx-auto h-8 w-8 text-text-muted" /><h2 className="mt-3 font-semibold">Select a guest contact</h2><p className="mt-1 text-xs text-text-muted">Choose a contact to see booking context, contact options, and notes.</p><button onClick={() => setTab('contacts')} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-semibold">Open contacts</button></div></div>}</aside>
    </div>
    <button onClick={() => ask('Help me with this call.')} className="fixed bottom-5 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-primary-solid px-5 py-3 text-sm font-semibold text-primary-contrast shadow-xl"><Bot className="h-4 w-4" />Ask LaFlo</button>
    {dialog ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={dialog.title}><div className="theme-card w-full max-w-md rounded-2xl border p-5 shadow-xl"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" /><div><h2 className="font-semibold">{dialog.title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{dialog.body}</p></div></div><div className="mt-5 flex justify-end gap-2">{dialog.title.includes('Calling') || dialog.title.includes('provider') ? <button onClick={() => navigate('/settings?tab=integrations')} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Open Integration Manager</button> : null}<button onClick={() => setDialog(null)} className="rounded-lg bg-primary-solid px-4 py-2 text-xs font-semibold text-primary-contrast">Close</button></div></div></div> : null}
  </div>;
}
