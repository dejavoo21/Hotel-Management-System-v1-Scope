import { useEffect, useMemo, useRef, useState } from 'react';
import { messageService } from '@/services';

type VideoState = 'IDLE' | 'CONNECTING' | 'IN_CALL' | 'ERROR';

type Props = {
  roomName: string;
  title?: string;
  compact?: boolean;
};

export default function SupportVideoPanel({ roomName, title = 'Video call', compact = false }: Props) {
  const [state, setState] = useState<VideoState>('IDLE');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);

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
    try {
      roomRef.current?.disconnect?.();
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
    setRemoteCount(0);
    resetContainers();
    setState('IDLE');
  };

  const startVideoCall = async () => {
    setError('');
    setState('CONNECTING');
    resetContainers();
    try {
      const token = await messageService.getSupportVideoToken(safeRoomName);
      const videoSdk: any = await import('twilio-video');
      const room = await videoSdk.connect(token.token, {
        name: token.room,
        audio: true,
        video: { width: 640 },
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

      room.participants?.forEach?.((participant: any) => bindParticipant(participant));
      room.on?.('participantConnected', bindParticipant);
      room.on?.('participantDisconnected', unbindParticipant);
      room.on?.('disconnected', () => {
        endVideoCall();
      });

      setState('IN_CALL');
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

  const toggleCamera = () => {
    const videoTracks = localTracksRef.current.filter((track) => track.kind === 'video');
    const next = !cameraOff;
    videoTracks.forEach((track) => {
      try {
        if (next) track.disable?.();
        else track.enable?.();
      } catch {
        // ignore
      }
    });
    setCameraOff(next);
  };

  useEffect(() => () => endVideoCall(), []);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-2.5' : 'p-3.5'}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className={`font-semibold text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</p>
          <p className="text-[11px] text-slate-500">Room: {safeRoomName}</p>
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
            {state === 'CONNECTING' ? 'Starting…' : 'Start / Join video'}
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
              onClick={toggleCamera}
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
