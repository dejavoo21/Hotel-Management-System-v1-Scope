import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import GuestCallsWorkspace from '@/components/calls/GuestCallsWorkspace';
import SupportVideoPanel from '@/components/calls/SupportVideoPanel';
import { useSocketPresence } from '@/hooks/useSocketPresence';
import { usePresenceStore } from '@/stores/presenceStore';
import { useAuthStore } from '@/stores/authStore';

export default function CallsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emitCallAccept, emitCallDecline, emitCallInvite, emitPresenceSet } = useSocketPresence();
  const user = useAuthStore((state) => state.user);
  const presenceMap = usePresenceStore((state) => state.presenceMap);
  const room = searchParams.get('room') || '';
  const callId = searchParams.get('callId') || '';
  const incoming = searchParams.get('incoming') === '1';
  const from = searchParams.get('from') || '';
  const returnTo = searchParams.get('returnTo') || '/messages';
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUserIds, setInviteUserIds] = useState<string[]>([]);
  const ringIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const onlineUsers = useMemo(() => Array.from(presenceMap.values()).filter((entry) => entry.isOnline && entry.userId !== user?.id), [presenceMap, user?.id]);

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
        const context = audioContextRef.current;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.36);
      } catch { /* browser audio may be blocked until user interaction */ }
    };
    playTone();
    ringIntervalRef.current = window.setInterval(playTone, 1100);
    return () => { if (ringIntervalRef.current) window.clearInterval(ringIntervalRef.current); };
  }, [incoming, room]);

  if (!room) return <GuestCallsWorkspace />;

  if (incoming) {
    return <div className="flex h-full min-h-[70vh] items-center justify-center bg-slate-950 p-4 text-white"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-white/60">Incoming call</p><h1 className="mt-1 text-xl font-semibold">Internal call</h1>{from ? <p className="mt-1 text-sm text-white/60">From: {from}</p> : null}<div className="mt-6 flex gap-3"><button onClick={() => { emitCallAccept(room, callId || undefined); navigate(`/calls?room=${encodeURIComponent(room)}${callId ? `&callId=${encodeURIComponent(callId)}` : ''}&returnTo=${encodeURIComponent(returnTo)}`, { replace: true }); }} className="flex-1 rounded-xl bg-primary-solid py-2.5 font-semibold">Accept</button><button onClick={() => { emitCallDecline(room, callId || undefined); navigate(returnTo, { replace: true }); }} className="flex-1 rounded-xl bg-white/10 py-2.5 font-semibold">Decline</button></div></section></div>;
  }

  return <div className="h-full min-h-[70vh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800"><SupportVideoPanel roomName={room} callId={callId} title="Call" fullPage onInvitePeople={() => { setInviteUserIds([]); setShowInviteModal(true); }} onHangup={() => { emitPresenceSet('AVAILABLE'); navigate(returnTo, { replace: true }); }} />{showInviteModal ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 text-white shadow-xl"><div className="flex items-center justify-between"><h2 className="font-semibold">Add people</h2><button onClick={() => setShowInviteModal(false)} className="rounded-lg border border-white/20 px-3 py-1 text-xs">Close</button></div><div className="mt-3 max-h-64 space-y-2 overflow-auto">{onlineUsers.length ? onlineUsers.map((entry) => <label key={entry.userId} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm"><input type="checkbox" checked={inviteUserIds.includes(entry.userId)} onChange={(event) => setInviteUserIds((current) => event.target.checked ? [...new Set([...current, entry.userId])] : current.filter((id) => id !== entry.userId))} /><span>{entry.email}</span></label>) : <p className="rounded-lg border border-white/10 p-3 text-sm text-white/70">No online users available.</p>}</div><button disabled={!callId || !inviteUserIds.length} onClick={() => { emitCallInvite({ callId, userIds: inviteUserIds }); toast.success(`Invited ${inviteUserIds.length} participant${inviteUserIds.length === 1 ? '' : 's'}.`); setShowInviteModal(false); }} className="mt-4 w-full rounded-xl bg-primary-solid py-2.5 text-sm font-semibold disabled:opacity-40">Send invite</button></section></div> : null}</div>;
}
