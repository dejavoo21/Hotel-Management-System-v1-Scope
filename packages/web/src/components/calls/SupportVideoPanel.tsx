import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageService } from '@/services';
import { useSocketPresence } from '@/hooks/useSocketPresence';
import CollaborationToolbar from '@/components/collaboration/CollaborationToolbar';

type VideoState = 'IDLE' | 'CONNECTING' | 'IN_CALL' | 'ERROR';

type Props = {
  roomName: string;
  callId?: string;
  title?: string;
  compact?: boolean;
  fullPage?: boolean;
  onInvitePeople?: () => void;
  onHangup?: () => void;
};

export default function SupportVideoPanel({
  roomName,
  callId,
  title = 'Video call',
  compact = false,
  fullPage = false,
  onInvitePeople,
  onHangup,
}: Props) {
  const navigate = useNavigate();
  const { emitPresenceSet } = useSocketPresence();
  const [state, setState] = useState<VideoState>('IDLE');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);
  const screenTrackRef = useRef<any>(null);
  const endedRef = useRef(false);

  const safeRoomName = useMemo(
    () => (roomName || 'laflo-video').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64) || 'laflo-video',
    [roomName]
  );

  const attachTrack = (track: any, container?: HTMLDivElement | null) => {
    if (!track || !container) return;
    try {
      const el = typeof track.attach === 'function' ? track.attach() : null;
      if (!el) return;
      el.classList?.add('h-full', 'w-full', 'object-cover', 'rounded-lg');
      container.appendChild(el);
    } catch {
      // ignore attach failure
    }
  };

  const detachTrack = (track: any) => {
    if (!track || typeof track.detach !== 'function') return;
    try {
      const elements = track.detach();
      (elements || []).forEach((el: HTMLElement) => el.remove());
    } catch {
      // ignore detach failure
    }
  };

  const resetContainers = () => {
    if (localVideoRef.current) localVideoRef.current.innerHTML = '';
    if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = '';
  };

  const bindParticipant = (participant: any) => {
    if (!participant) return;
    const container = remoteVideoRef.current;
    if (!container) return;

    const attachPublishedTrack = (publication: any) => {
      const track = publication?.track;
      if (track) attachTrack(track, container);
    };

    participant.tracks?.forEach?.(attachPublishedTrack);
    participant.on?.('trackSubscribed', (track: any) => attachTrack(track, container));
    participant.on?.('trackUnsubscribed', (track: any) => detachTrack(track));
    setRemoteCount((prev) => prev + 1);
  };

  const unbindParticipant = (participant: any) => {
    participant?.tracks?.forEach?.((publication: any) => {
      if (publication?.track) detachTrack(publication.track);
    });
    setRemoteCount((prev) => Math.max(0, prev - 1));
  };

  const endVideoCall = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    const activeRoom = roomRef.current;
    try {
      if (screenTrackRef.current) {
        activeRoom?.localParticipant?.unpublishTrack?.(screenTrackRef.current);
        screenTrackRef.current.stop?.();
      }
    } catch {
      // ignore
    }
    screenTrackRef.current = null;
    try {
      activeRoom?.disconnect?.();
    } catch {
      // ignore
    }
    roomRef.current = null;
    localTracksRef.current.forEach((track) => {
      try {
        track.stop?.();
        detachTrack(track);
      } catch {
        // ignore
      }
    });
    localTracksRef.current = [];
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
    setRemoteCount(0);
    resetContainers();
    setState('IDLE');
    emitPresenceSet('AVAILABLE');
    onHangup?.();
  };

  const startVideoCall = async () => {
    endedRef.current = false;
    setError('');
    setState('CONNECTING');
    resetContainers();
    try {
      const token = await messageService.getSupportVideoToken(safeRoomName);
      const videoSdk: any = await import('twilio-video');
      const room: any = await videoSdk.connect(token.token, {
        name: token.room,
        audio: true,
        video: false,
      });

      roomRef.current = room;
      localTracksRef.current = room.localParticipant?.videoTracks
        ? Array.from(room.localParticipant.videoTracks.values()).map((pub: any) => pub.track)
        : [];

      const localAudioTracks = room.localParticipant?.audioTracks
        ? Array.from(room.localParticipant.audioTracks.values()).map((pub: any) => pub.track)
        : [];
      localTracksRef.current = [...localTracksRef.current, ...localAudioTracks];

      const localVideoTrack = localTracksRef.current.find((track) => track.kind === 'video');
      if (localVideoTrack) attachTrack(localVideoTrack, localVideoRef.current);
      setCameraOff(!localVideoTrack);

      room.participants?.forEach?.((participant: any) => bindParticipant(participant));
      room.on?.('participantConnected', bindParticipant);
      room.on?.('participantDisconnected', unbindParticipant);
      room.on?.('disconnected', () => {
        endVideoCall();
      });

      setState('IN_CALL');
      emitPresenceSet('BUSY');
    } catch (err: any) {
      roomRef.current = null;
      localTracksRef.current.forEach((track) => {
        try {
          track.stop?.();
          detachTrack(track);
        } catch {
          // ignore
        }
      });
      localTracksRef.current = [];
      resetContainers();
      setRemoteCount(0);
      setError(err?.message || 'Unable to start video call.');
      setState('ERROR');
    }
  };

  const toggleMute = () => {
    const audioTracks = localTracksRef.current.filter((track) => track.kind === 'audio');
    const next = !muted;
    audioTracks.forEach((track) => {
      try {
        if (next) track.disable?.();
        else track.enable?.();
      } catch {
        // ignore
      }
    });
    setMuted(next);
  };

  const toggleCamera = async () => {
    const next = !cameraOff;

    if (next) {
      const publications = roomRef.current?.localParticipant?.videoTracks;
      if (publications) {
        publications.forEach((publication: any) => {
          try {
            roomRef.current?.localParticipant?.unpublishTrack?.(publication.track);
            publication.track?.stop?.();
            detachTrack(publication.track);
          } catch {
            // ignore
          }
        });
      }
      localTracksRef.current = localTracksRef.current.filter((track) => track.kind !== 'video');
      if (localVideoRef.current) localVideoRef.current.innerHTML = '';
      setCameraOff(true);
      return;
    }

    try {
      const videoSdk: any = await import('twilio-video');
      const newTrack = await videoSdk.createLocalVideoTrack({ width: 640 });
      await roomRef.current?.localParticipant?.publishTrack?.(newTrack);
      attachTrack(newTrack, localVideoRef.current);
      localTracksRef.current = [
        ...localTracksRef.current.filter((track) => track.kind !== 'video'),
        newTrack,
      ];
      setCameraOff(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to enable camera.');
      setCameraOff(true);
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      try {
        if (screenTrackRef.current) {
          roomRef.current?.localParticipant?.unpublishTrack?.(screenTrackRef.current);
          screenTrackRef.current.stop?.();
        }
      } catch {
        // ignore
      }
      screenTrackRef.current = null;
      setScreenSharing(false);
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setError('Screen sharing is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const [mediaTrack] = stream.getVideoTracks();
      if (!mediaTrack) return;

      const videoSdk: any = await import('twilio-video');
      const localVideoTrack = new videoSdk.LocalVideoTrack(mediaTrack, { name: 'screen-share' });
      await roomRef.current?.localParticipant?.publishTrack?.(localVideoTrack);
      screenTrackRef.current = localVideoTrack;
      setScreenSharing(true);
      mediaTrack.addEventListener('ended', () => {
        try {
          roomRef.current?.localParticipant?.unpublishTrack?.(localVideoTrack);
          localVideoTrack.stop?.();
        } catch {
          // ignore
        }
        if (screenTrackRef.current === localVideoTrack) screenTrackRef.current = null;
        setScreenSharing(false);
      });
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        setError(err?.message || 'Failed to start screen sharing.');
      }
      setScreenSharing(false);
    }
  };

  useEffect(() => () => endVideoCall(), []);

  if (!fullPage) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-2.5' : 'p-3.5'}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={`font-semibold text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</p>
            <p className="text-[11px] text-slate-500">Internal call</p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              state === 'IN_CALL'
                ? 'bg-emerald-100 text-emerald-700'
                : state === 'CONNECTING'
                  ? 'bg-sky-100 text-sky-700'
                  : state === 'ERROR'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-600'
            }`}
          >
            {state === 'IN_CALL' ? 'In video call' : state === 'CONNECTING' ? 'Connecting' : state === 'ERROR' ? 'Error' : 'Ready'}
          </span>
        </div>

        <div className={`mt-2 grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">You</p>
            <div ref={localVideoRef} className={`overflow-hidden rounded-lg bg-slate-100 ${compact ? 'h-24' : 'h-32'}`} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Remote ({remoteCount})</p>
            <div ref={remoteVideoRef} className={`overflow-hidden rounded-lg bg-slate-100 ${compact ? 'h-24' : 'h-32'}`} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {state !== 'IN_CALL' ? (
            <button
              type="button"
              onClick={() => void startVideoCall()}
              disabled={state === 'CONNECTING'}
              className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === 'CONNECTING' ? 'Starting...' : 'Start / Join video'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={() => void toggleCamera()}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                {cameraOff ? 'Camera on' : 'Camera off'}
              </button>
              <button
                type="button"
                onClick={endVideoCall}
                className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
              >
                End video
              </button>
            </>
          )}
        </div>

        {error ? (
          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(56,189,248,0.35), transparent 45%), radial-gradient(circle at 70% 60%, rgba(168,85,247,0.25), transparent 45%)',
        }}
      />

      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-white/60">Internal call</div>
          {callId ? <div className="truncate text-[10px] text-white/40">ID: {callId}</div> : null}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            state === 'IN_CALL'
              ? 'bg-emerald-500/20 text-emerald-200'
              : state === 'CONNECTING'
                ? 'bg-sky-500/20 text-sky-200'
                : state === 'ERROR'
                  ? 'bg-rose-500/20 text-rose-200'
                  : 'bg-white/10 text-white/70'
          }`}
        >
          {state === 'IN_CALL' ? 'In call' : state === 'CONNECTING' ? 'Connecting...' : state === 'ERROR' ? 'Error' : 'Ready'}
        </span>
      </div>

      <div className="absolute inset-0">
        <div ref={remoteVideoRef} className="h-full w-full" />
        {remoteCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl bg-white/10 px-5 py-3 text-sm text-white/80">
              {state === 'IN_CALL' ? 'Waiting for the other person to join...' : 'Ready to join the call'}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-24 right-5 z-20 w-60">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-white/80">
            <span>You</span>
            <span className="text-white/50">{cameraOff ? 'Camera off' : muted ? 'Muted' : ''}</span>
          </div>
          <div ref={localVideoRef} className="h-36 bg-black/40" />
        </div>
      </div>

      <div className="absolute bottom-5 left-4 right-4 z-30">
        {state !== 'IN_CALL' ? (
          <div className="mx-auto flex w-full max-w-xl items-center justify-center rounded-3xl border border-white/10 bg-black/45 p-3 backdrop-blur">
            <button
              type="button"
              onClick={() => void startVideoCall()}
              disabled={state === 'CONNECTING'}
              className="min-h-11 rounded-2xl bg-violet-500/85 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === 'CONNECTING' ? 'Joining...' : 'Join call'}
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 lg:flex-row lg:items-end">
            <CollaborationToolbar
              className="min-w-0 flex-1"
              cameraOn={!cameraOff}
              microphoneOn={!muted}
              screenSharing={screenSharing}
              onToggleCamera={() => void toggleCamera()}
              onToggleMicrophone={toggleMute}
              onToggleScreenShare={() => void toggleScreenShare()}
              onOpenParticipants={onInvitePeople}
              onSummarizeConversation={() => navigate('/operations-center/ai')}
            />
            <button
              type="button"
              onClick={endVideoCall}
              className="min-h-11 shrink-0 rounded-2xl bg-rose-500/85 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-300"
              title="Hang up"
            >
              Hang up
            </button>
          </div>
        )}
      </div>

      {error ? (
        <div className="absolute bottom-24 left-4 right-4 z-30 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
