'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type Participant,
  type RemoteParticipant,
} from 'livekit-client'
import {
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  ScrollText,
  Settings,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'
import { TeleprompterPanel } from '@/components/recording/editor/teleprompter-panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RoomsFullPage } from './rooms-layout-shell'
import { PeoplePanel, ParticipantVideoTile, type PeopleRow } from './people-panel'
import { RoomsUploadCard } from './upload-card'
import { parseRecControlPayload, parseRecordingRoomMetadata, type RecControlMessage } from '@/lib/recording/rec-control'
import { computeLocalPublishSubscriptionPermissions } from '@/lib/recording/producer-subscriptions'
import { bestOffsetFromSamples, offsetFromSample, scheduleAtHostMs } from '@/lib/recording/clock-sync'
import {
  encodeDataPacketForLiveKit,
  parseDataPacket,
  pttPacketSchema,
  spotlightPacketSchema,
} from '@/lib/recording/ptt'
import { startLocalTrackRecorder } from '@/lib/recording/local-track-recorder'
import { TrackUploadManager, type TrackUploadProgress } from '@/lib/recording/track-upload-manager'
import {
  assertLiveKitWsUrl,
  formatLiveKitConnectError,
} from '@/lib/recording/livekit-connect'
import { readJoinPayload, type RoomsJoinPayload } from '@/lib/recording/rooms-join-storage'
import { createId } from '@/lib/supabase/id'
import { RoomsInvitePopover } from './rooms-invite-popover'

type JoinPayload = RoomsJoinPayload

const RECORD_COUNTDOWN_MS = 3000

function roleIsHost(role: string) {
  return role.toUpperCase() === 'HOST'
}

const TOPIC_REC = 'rec-control'
const TOPIC_PTT = 'ptt'
const TOPIC_SPOT = 'spotlight'
const TOPIC_CAPTIONS = 'rooms-captions'

export function RoomsStudioApp({
  sessionId,
  sessionTitle,
  captionsAvailable = false,
}: {
  sessionId: string
  sessionTitle: string
  captionsAvailable?: boolean
}) {
  const router = useRouter()
  const [payload, setPayload] = useState<JoinPayload | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [spotlight, setSpotlight] = useState<string | null>(null)
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null)
  const [captions, setCaptions] = useState<string>('')
  const [captionsOn, setCaptionsOn] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [uploadRows, setUploadRows] = useState<TrackUploadProgress[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [showRecStartedModal, setShowRecStartedModal] = useState(false)
  const [hideRecModal, setHideRecModal] = useState(false)
  const [producerMode, setProducerMode] = useState(false)
  const [pttTarget, setPttTarget] = useState<string | null>(null)
  const [pttActive, setPttActive] = useState(false)
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [micOn, setMicOn] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const [devicesPrompt, setDevicesPrompt] = useState(false)
  const [connected, setConnected] = useState(false)
  const [recordedIdentities, setRecordedIdentities] = useState<Set<string>>(new Set())
  const [noTracksRecorded, setNoTracksRecorded] = useState(false)
  const [networkBanner, setNetworkBanner] = useState<string | null>(null)
  const [peopleOpen, setPeopleOpen] = useState(true)
  const [screenShareIdentity, setScreenShareIdentity] = useState<string | null>(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showChooseFiles, setShowChooseFiles] = useState(false)
  const [chooseCloudBackup, setChooseCloudBackup] = useState(false)
  const [dismissedQualityBanner, setDismissedQualityBanner] = useState(false)
  const [teleprompterOpen, setTeleprompterOpen] = useState(false)
  const [removedFromCall, setRemovedFromCall] = useState(false)
  const recStartedAtRef = useRef<number | null>(null)
  const uploadMgr = useRef<TrackUploadManager | null>(null)
  const recordersRef = useRef<{ stop: () => Promise<void> }[]>([])
  const hostIdentityRef = useRef<string | null>(null)

  const isHost = payload ? roleIsHost(payload.role) : false
  const isProducer = payload?.role.toLowerCase() === 'producer'

  useEffect(() => {
    const parsed = readJoinPayload(sessionId)
    if (!parsed) {
      router.replace(`/app/rooms/${sessionId}`)
      return
    }
    setPayload(parsed)
    setEchoCancellation(parsed.headphones === 'yes')
    setMicOn(Boolean(parsed.micEnabled))
    setCamOn(Boolean(parsed.camEnabled))
    if (!parsed.micEnabled && !parsed.camEnabled) setDevicesPrompt(true)
    if (parsed.role.toLowerCase() === 'producer') setProducerMode(true)
    uploadMgr.current = new TrackUploadManager(sessionId, setUploadRows)
  }, [router, sessionId])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => {
      if (recStartedAtRef.current) {
        setRecSeconds(Math.max(0, Math.floor((Date.now() - recStartedAtRef.current) / 1000)))
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [recording])

  const syncParticipants = useCallback((r: Room) => {
    const list: Participant[] = [r.localParticipant, ...Array.from(r.remoteParticipants.values())]
    setParticipants(list)
    const host = list.find((p) => p.attributes?.role === 'host')
    hostIdentityRef.current = host?.identity ?? null
  }, [])

  useEffect(() => {
    if (!payload) return
    let wsUrl: string
    try {
      wsUrl = assertLiveKitWsUrl(payload.url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[rooms] invalid LiveKit URL', { url: payload.url, msg })
      setNetworkBanner(msg)
      return
    }

    const lkRoom = new Room({ adaptiveStream: true, dynacast: true })
    setRoom(lkRoom)
    setConnected(false)

    lkRoom.on(RoomEvent.ParticipantConnected, () => {
      syncParticipants(lkRoom)
      const host = lkRoom.remoteParticipants.values().next().value
      const hostId =
        Array.from(lkRoom.remoteParticipants.values()).find((p) => p.attributes?.role === 'host')?.identity ??
        host?.identity
      if (!roleIsHost(payload.role) && hostId) void runClockSync(lkRoom, hostId)
    })
    lkRoom.on(RoomEvent.ParticipantDisconnected, (p) => {
      syncParticipants(lkRoom)
      if (screenShareIdentity === p.identity) setScreenShareIdentity(null)
    })
    lkRoom.on(RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.source === Track.Source.ScreenShare) setScreenShareIdentity(lkRoom.localParticipant.identity)
    })
    lkRoom.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (pub.source === Track.Source.ScreenShare) setScreenShareIdentity(participant.identity)
    })
    lkRoom.on(RoomEvent.TrackUnsubscribed, (_track, pub, participant) => {
      if (pub.source === Track.Source.ScreenShare && screenShareIdentity === participant.identity) {
        setScreenShareIdentity(null)
      }
    })
    lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setActiveSpeaker(speakers[0]?.identity ?? null)
    })
    lkRoom.on(RoomEvent.ConnectionQualityChanged, (quality, p) => {
      if (p?.isLocal && (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost)) {
        setNetworkBanner('Weak network — recordings continue locally and upload when stable.')
      }
    })
    lkRoom.on(RoomEvent.TranscriptionReceived, (segments) => {
      const line = segments.map((s) => s.text).join(' ')
      if (line) setCaptions(line)
    })
    lkRoom.on(RoomEvent.DataReceived, (data, participant, _k, topic) => {
      if (topic === TOPIC_REC) {
        const msg = parseRecControlPayload(data)
        if (msg) handleRecControl(lkRoom, msg)
      }
      if (topic === TOPIC_PTT) {
        const pkt = parseDataPacket(data, pttPacketSchema)
        if (pkt && pkt.toIdentity === payload.identity) setPttActive(pkt.active)
      }
      if (topic === TOPIC_SPOT) {
        const pkt = parseDataPacket(data, spotlightPacketSchema)
        if (pkt) setSpotlight(pkt.identity)
      }
      if (topic === TOPIC_CAPTIONS && captionsOn) {
        try {
          const json = JSON.parse(new TextDecoder().decode(data)) as { text?: string }
          if (json.text) setCaptions(json.text)
        } catch {
          /* ignore */
        }
      }
    })
    lkRoom.on(RoomEvent.RoomMetadataChanged, (meta) => {
      const parsed = parseRecordingRoomMetadata(meta)
      if (parsed?.recState === 'recording' && parsed.takeId && !recording) {
        void startLocalRecording(lkRoom, parsed.takeId, parsed.startAtHostMs ?? Date.now())
      }
    })

    lkRoom
      .connect(wsUrl, payload.token)
      .then(async () => {
        setConnected(true)
        syncParticipants(lkRoom)
        try {
          await lkRoom.localParticipant.setMicrophoneEnabled(micOn, {
            echoCancellation: echoCancellation,
          })
        } catch (e) {
          console.warn('[rooms] microphone enable failed', e)
          setMicOn(false)
          setDevicesPrompt(true)
        }
        try {
          await lkRoom.localParticipant.setCameraEnabled(camOn)
        } catch (e) {
          console.warn('[rooms] camera enable failed', e)
          setCamOn(false)
          setDevicesPrompt(true)
        }
        if (roleIsHost(payload.role)) {
          lkRoom.registerRpcMethod('clock.now', async () =>
            String(performance.timeOrigin + performance.now()),
          )
        }
        syncParticipants(lkRoom)
        const hostId = Array.from(lkRoom.remoteParticipants.values()).find(
          (p) => p.attributes?.role === 'host',
        )?.identity
        if (!roleIsHost(payload.role) && hostId) void runClockSync(lkRoom, hostId)
      })
      .catch((err) => {
        const reason = formatLiveKitConnectError(err)
        console.error('[rooms] LiveKit connect failed', { url: wsUrl, reason, err })
        setNetworkBanner(`Could not connect to the room: ${reason}`)
      })

    return () => {
      lkRoom.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect once per join payload
  }, [payload])

  useEffect(() => {
    if (!room || !connected) return
    void room.localParticipant.setMicrophoneEnabled(micOn, { echoCancellation })
  }, [room, connected, echoCancellation, micOn])

  useEffect(() => {
    if (!room || !connected) return
    void room.localParticipant.setCameraEnabled(camOn)
  }, [room, connected, camOn])

  useEffect(() => {
    if (!room || !payload) return
    const plan = computeLocalPublishSubscriptionPermissions({
      localIdentity: payload.identity,
      localRole: payload.role,
      producerMode,
      pttActive,
      pttTargetIdentity: pttTarget,
      participantIdentities: participants.map((p) => ({
        identity: p.identity,
        role: (p.attributes?.role as string) || 'guest',
      })),
    })
    room.localParticipant.setTrackSubscriptionPermissions(
      plan.allParticipantsAllowed,
      plan.participantTrackPermissions,
    )
  }, [room, payload, producerMode, pttActive, pttTarget, participants])

  async function runClockSync(r: Room, hostId: string) {
    const samples = []
    for (let i = 0; i < 8; i++) {
      const t0 = performance.timeOrigin + performance.now()
      try {
        const res = await r.localParticipant.performRpc({
          destinationIdentity: hostId,
          method: 'clock.now',
          payload: '',
          responseTimeout: 2000,
        })
        const t1 = performance.timeOrigin + performance.now()
        samples.push(offsetFromSample(t0, t1, Number(res)))
      } catch {
        /* ignore */
      }
    }
    setClockOffsetMs(bestOffsetFromSamples(samples))
  }

  async function handleRecControl(r: Room, msg: RecControlMessage) {
    const kind = 't' in msg ? msg.t : msg.type
    if (kind === 'start' || kind === 'sync') {
      const startAt = 'startAtHostMs' in msg ? msg.startAtHostMs : 0
      runCountdownThenRecord(r, async () => msg.takeId, startAt)
    }
    if (kind === 'stop') {
      const stopAt = 'stopAtHostMs' in msg ? msg.stopAtHostMs : Date.now()
      await stopLocalRecording(msg.takeId, stopAt)
    }
  }

  function runCountdownThenRecord(
    r: Room,
    resolveTakeId: () => Promise<string | null>,
    startAtHostMs: number,
  ) {
    let left = Math.min(3, Math.max(1, Math.ceil((startAtHostMs - Date.now()) / 1000)))
    setCountdown(left)
    const tick = window.setInterval(() => {
      left -= 1
      if (left <= 0) {
        window.clearInterval(tick)
        setCountdown(null)
      } else setCountdown(left)
    }, 1000)
    const cancel = scheduleAtHostMs(startAtHostMs, clockOffsetMs, async () => {
      setCountdown(null)
      window.clearInterval(tick)
      const takeId = await resolveTakeId()
      if (!takeId) {
        setNetworkBanner('Recording could not start — no take id from server.')
        return
      }
      void startLocalRecording(r, takeId, startAtHostMs)
    })
    return cancel
  }

  async function startLocalRecording(r: Room, takeId: string, startAtHostMs: number) {
    setRecording(true)
    setNoTracksRecorded(false)
    setActiveTakeId(takeId)
    setRecordedIdentities((prev) => new Set(prev).add(payload!.identity))
    setRecSeconds(0)
    if (!hideRecModal && !isHost) setShowRecStartedModal(true)
    recStartedAtRef.current = Date.now()
    const actualStartHostMs = Math.round(startAtHostMs)
    const displayName = payload?.displayName ?? payload?.identity ?? 'Participant'
    const camPub = r.localParticipant.getTrackPublication(Track.Source.Camera)
    const micPub = r.localParticipant.getTrackPublication(Track.Source.Microphone)
    const streams: { kind: 'CAMERA' | 'MICROPHONE'; stream: MediaStream; trackId: string }[] = []
    if (camPub?.track?.mediaStream) {
      const trackId = createId('rtrk')
      streams.push({ kind: 'CAMERA', stream: new MediaStream([camPub.track.mediaStreamTrack]), trackId })
    }
    if (micPub?.track?.mediaStream) {
      const trackId = createId('rtrk')
      streams.push({ kind: 'MICROPHONE', stream: new MediaStream([micPub.track.mediaStreamTrack]), trackId })
    }
    recordersRef.current = []
    for (const s of streams) {
      await fetch('/api/recording/tracks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          takeId,
          trackId: s.trackId,
          participantId: payload!.identity,
          kind: s.kind,
          mimeType: s.kind === 'CAMERA' ? 'video/webm' : 'audio/webm',
          actualStartHostMs,
        }),
      })
      const handle = startLocalTrackRecorder({
        sessionId,
        takeId,
        trackId: s.trackId,
        kind: s.kind,
        stream: s.stream,
        onChunk: () => uploadMgr.current?.pump(s.trackId),
      })
      recordersRef.current.push(handle)
      await uploadMgr.current?.registerTrack({
        trackId: s.trackId,
        sessionId,
        takeId,
        mimeType: handle.mimeType,
        kind: s.kind,
        participantId: payload!.identity,
        displayName,
        actualStartHostMs,
        clockOffsetMs,
      })
    }
    if (!streams.length) {
      setNoTracksRecorded(true)
      setShowUpload(true)
      await uploadMgr.current?.registerNoTracks({
        participantId: payload!.identity,
        displayName,
        takeId,
      })
    }
    if (hostIdentityRef.current && !isHost) {
      await r.localParticipant.performRpc({
        destinationIdentity: hostIdentityRef.current,
        method: 'rec.ack',
        payload: JSON.stringify({ takeId, state: 'recording' }),
      })
    }
  }

  async function stopLocalRecording(takeId: string, _stopAt: number) {
    setRecording(false)
    for (const rec of recordersRef.current) await rec.stop()
    recordersRef.current = []
    const metas = await import('@/lib/recording/chunk-store').then((m) => m.listTrackMetaForSession(sessionId))
    for (const meta of metas.filter((m) => m.takeId === takeId)) {
      await uploadMgr.current?.pump(meta.trackId, true)
    }
    setShowUpload(true)
  }

  const peopleRows: PeopleRow[] = useMemo(() => {
    return participants.map((p) => {
      const mine = uploadRows.filter((u) => u.participantId === p.identity)
      const uploadPct =
        mine.length > 0
          ? Math.round(mine.reduce((a, u) => a + u.percent, 0) / mine.length)
          : undefined
      const didRecord = recordedIdentities.has(p.identity)
      return {
        identity: p.identity,
        name: p.name || p.identity,
        role: (p.attributes?.role as string) || 'guest',
        isLocal: p.isLocal,
        micOn: p.isMicrophoneEnabled,
        camOn: p.isCameraEnabled,
        quality: p.connectionQuality ?? ConnectionQuality.Unknown,
        recording: didRecord || (recording && p.isLocal),
        uploadPct,
      }
    })
  }, [participants, recording, uploadRows, recordedIdentities])

  const recorded = peopleRows.filter((r) => r.recording)
  const notRecorded = peopleRows.filter((r) => !r.recording)

  async function hostStartRecord() {
    if (!room || !isHost) return
    const startAtHostMs = Date.now() + RECORD_COUNTDOWN_MS
    let takeId: string | null = null
    const takePromise = fetch(`/api/recording/sessions/${sessionId}/takes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start', startAtHostMs }),
    })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Could not start take')
        takeId = json.data?.takeId as string
        setActiveTakeId(takeId)
        const msg = { t: 'start', takeId, startAtHostMs }
        await room.localParticipant.publishData(encodeDataPacketForLiveKit(msg), {
          reliable: true,
          topic: TOPIC_REC,
        })
        return takeId
      })
      .catch((e) => {
        setNetworkBanner(e instanceof Error ? e.message : 'Could not start recording')
        return null
      })

    runCountdownThenRecord(room, () => takePromise, startAtHostMs)
  }

  async function hostStopRecord() {
    if (!room || !activeTakeId) return
    const stopAtHostMs = Date.now() + clockOffsetMs
    await fetch(`/api/recording/sessions/${sessionId}/takes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'stop', takeId: activeTakeId, stopAtHostMs }),
    })
    const msg = { t: 'stop', takeId: activeTakeId, stopAtHostMs }
    await room.localParticipant.publishData(encodeDataPacketForLiveKit(msg), { reliable: true, topic: TOPIC_REC })
    await stopLocalRecording(activeTakeId, stopAtHostMs)
  }

  if (!payload) return null

  if (removedFromCall) {
    return (
      <RoomsFullPage>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-[400px] rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-lg font-semibold">You were removed from the call</p>
            <Button className="mt-4" onClick={() => router.push('/app/clips')}>Return home</Button>
          </div>
        </div>
      </RoomsFullPage>
    )
  }

  const stageTiles = screenShareIdentity
    ? participants.filter((p) => p.identity !== screenShareIdentity)
    : participants
  const screenSharer = screenShareIdentity
    ? participants.find((p) => p.identity === screenShareIdentity)
    : null

  return (
    <RoomsFullPage>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Link href={sessionTitle ? `/app/clips` : '/app/clips'} className="text-[13px] text-muted-foreground hover:text-foreground">
          ← Back to editor
        </Link>
        <span className="flex-1 truncate text-center text-sm font-semibold">{sessionTitle}</span>
        {isHost ? <RoomsInvitePopover sessionId={sessionId} disabled={!connected} /> : null}
      </header>
      {producerMode && (
        <div className="flex h-10 items-center justify-between bg-[oklch(0.35_0.05_100)] px-4 text-[13px]">
          <span>Producer mode — only producers can hear you</span>
          <div className="flex items-center gap-2">
            <select className="h-8 rounded-lg border border-border bg-background px-2 text-xs" value={pttTarget ?? ''} onChange={(e) => setPttTarget(e.target.value)}>
              <option value="">To: everyone</option>
              {participants.filter((p) => !p.isLocal).map((p) => (
                <option key={p.identity} value={p.identity}>{p.name || p.identity}</option>
              ))}
            </select>
            <Button
              size="sm"
              className={cn('h-8', pttActive && 'bg-destructive')}
              onPointerDown={async () => {
                if (!room || !pttTarget) return
                setPttActive(true)
                await room.localParticipant.publishData(
                  encodeDataPacketForLiveKit({ t: 'ptt', fromIdentity: payload.identity, toIdentity: pttTarget, active: true }),
                  { reliable: true, topic: TOPIC_PTT },
                )
              }}
              onPointerUp={async () => {
                if (!room || !pttTarget) return
                setPttActive(false)
                await room.localParticipant.publishData(
                  encodeDataPacketForLiveKit({ t: 'ptt', fromIdentity: payload.identity, toIdentity: pttTarget, active: false }),
                  { reliable: true, topic: TOPIC_PTT },
                )
              }}
            >
              <Hand className="mr-1 size-4" /> Push to talk
            </Button>
          </div>
        </div>
      )}
      {!dismissedQualityBanner && (
        <div className="flex h-10 items-center justify-between bg-muted/40 px-4 text-[13px]">
          <span>Videos in the Room may appear lower resolution — recordings are full quality.</span>
          <Button variant="ghost" size="sm" onClick={() => setDismissedQualityBanner(true)}>Dismiss</Button>
        </div>
      )}
      {devicesPrompt && connected && (
        <div className="flex h-10 items-center justify-between bg-muted/50 px-4 text-[13px]">
          <span>Camera and microphone are off. Enable devices when you are ready to be seen or heard.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await room?.localParticipant.setMicrophoneEnabled(true, { echoCancellation })
                setMicOn(true)
              } catch {
                /* no device */
              }
              try {
                await room?.localParticipant.setCameraEnabled(true)
                setCamOn(true)
              } catch {
                /* no device */
              }
              if (room?.localParticipant.isMicrophoneEnabled || room?.localParticipant.isCameraEnabled) {
                setDevicesPrompt(false)
              }
            }}
          >
            Enable devices
          </Button>
        </div>
      )}
      {networkBanner && (
        <div className="flex h-10 items-center justify-between bg-warning/15 px-4 text-[13px]">
          <span>{networkBanner}</span>
          <Button variant="ghost" size="sm" onClick={() => setNetworkBanner(null)}>Dismiss</Button>
        </div>
      )}
      <div className="relative flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col bg-[oklch(0.1_0_0)] p-4">
          {screenSharer ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <ParticipantVideoTile
                participant={screenSharer}
                name={screenSharer.name || screenSharer.identity}
                active={activeSpeaker === screenSharer.identity}
                pinned={spotlight === screenSharer.identity}
                isScreenShare
              />
              <div className="flex h-24 gap-2 overflow-x-auto">
                {stageTiles.map((p) => (
                  <div key={p.identity} className="h-24 w-40 shrink-0">
                    <ParticipantVideoTile
                      participant={p}
                      name={p.name || p.identity}
                      active={activeSpeaker === p.identity}
                      pinned={spotlight === p.identity}
                      pttHighlight={pttActive && p.identity === pttTarget}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
              {participants.map((p) => (
                <ParticipantVideoTile
                  key={p.identity}
                  participant={p}
                  name={p.name || p.identity}
                  active={activeSpeaker === p.identity}
                  pinned={spotlight === p.identity}
                  pttHighlight={pttActive && p.identity === pttTarget}
                />
              ))}
            </div>
          )}
          {captionsAvailable && captionsOn && captions ? (
            <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-black/60 px-3 py-2 text-center text-base text-white">
              {captions}
            </div>
          ) : null}
          {countdown != null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="flex size-40 items-center justify-center rounded-full bg-black/60 text-7xl font-bold text-white">
                {countdown}
              </div>
            </div>
          )}
          {showUpload && (
            <div className="absolute bottom-4 right-4 z-20">
              <RoomsUploadCard
                rows={uploadRows}
                noTracksRecorded={noTracksRecorded}
                onCopyRecoveryLink={() =>
                  navigator.clipboard.writeText(`${window.location.origin}/app/rooms/${sessionId}/upload`)
                }
                onStartEditing={() => setShowChooseFiles(true)}
                onDone={async () => {
                  if (activeTakeId && isHost) {
                    const allDone = uploadRows.every((r) => r.done)
                    if (!allDone) {
                      setShowChooseFiles(true)
                      return
                    }
                    const res = await fetch(`/api/recording/sessions/${sessionId}/takes/${activeTakeId}/import`, {
                      method: 'POST',
                    })
                    const json = await res.json()
                    if (json.data?.scriptUrl) router.push(json.data.scriptUrl)
                    else if (json.error) setNetworkBanner(json.error)
                  } else router.push(`/app/rooms/${sessionId}/upload`)
                }}
              />
            </div>
          )}
        </main>
        {peopleOpen && (
          <PeoplePanel
            room={room}
            rows={peopleRows}
            recorded={recorded}
            notRecorded={notRecorded}
            sessionId={sessionId}
            hostIdentity={isHost ? payload.identity : hostIdentityRef.current ?? ''}
            localIdentity={payload.identity}
            echoCancellation={echoCancellation}
            onEchoChange={async (on) => {
              setEchoCancellation(on)
              await room?.localParticipant.setMicrophoneEnabled(micOn, { echoCancellation: on })
            }}
            onKick={async (identity) => {
              const res = await fetch(`/api/recording/sessions/${sessionId}/participants/${identity}`, {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ actorParticipantId: payload.identity }),
              })
              if (res.ok && identity === payload.identity) setRemovedFromCall(true)
            }}
            onMute={async (identity, _trackSid, muted) => {
              const p = participants.find((x) => x.identity === identity) as RemoteParticipant | undefined
              const pub = p?.getTrackPublication(Track.Source.Microphone)
              if (pub?.trackSid && isHost) {
                await fetch(`/api/recording/sessions/${sessionId}/participants/${identity}`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    action: 'mute',
                    actorParticipantId: payload.identity,
                    trackSid: pub.trackSid,
                    muted,
                  }),
                })
              }
            }}
            onPin={async (identity) => {
              setSpotlight(identity)
              await room?.localParticipant.publishData(
                encodeDataPacketForLiveKit({ t: 'spotlight', identity }),
                { reliable: true, topic: TOPIC_SPOT },
              )
            }}
          />
        )}
        <nav className="flex w-20 shrink-0 flex-col items-center gap-2 border-l border-border bg-card py-3">
          <RailBtn icon={Users} label="People" active={peopleOpen} onClick={() => setPeopleOpen((v) => !v)} />
          <RailBtn icon={MessageSquare} label="Chat" />
          <RailBtn icon={Settings} label="Settings" onClick={() => setProducerMode((v) => !v)} />
        </nav>
      </div>
      <footer className="flex h-[72px] shrink-0 items-center justify-center gap-4 border-t border-border bg-background px-4">
        {recording && (
          <span className="rounded-full bg-lane-record px-3 py-1 font-mono text-[11px] tabular-nums text-white">
            ● REC {Math.floor(recSeconds / 60)}:{(recSeconds % 60).toString().padStart(2, '0')} | Rooms
          </span>
        )}
        <RecordButton recording={recording} onStart={hostStartRecord} onStop={hostStopRecord} disabled={!isHost && !recording} />
        <RoundBtn icon={micOn ? Mic : MicOff} label="Mic" onClick={async () => {
          const next = !micOn
          setMicOn(next)
          await room?.localParticipant.setMicrophoneEnabled(next, { echoCancellation })
        }} />
        <RoundBtn icon={camOn ? Video : VideoOff} label="Video" onClick={async () => {
          const next = !camOn
          setCamOn(next)
          await room?.localParticipant.setCameraEnabled(next)
        }} />
        <RoundBtn
          icon={MonitorUp}
          label={screenShareIdentity === payload.identity ? 'Stop share' : 'Share'}
          onClick={async () => {
            if (screenShareIdentity === payload.identity) {
              await room?.localParticipant.setScreenShareEnabled(false)
              setScreenShareIdentity(null)
            } else {
              await room?.localParticipant.setScreenShareEnabled(true, { selfBrowserSurface: 'exclude' })
            }
          }}
        />
        <RoundBtn icon={ScrollText} label="Teleprompter" onClick={() => setTeleprompterOpen(true)} />
        {captionsAvailable && (
          <RoundBtn
            icon={MessageSquare}
            label={captionsOn ? 'Captions on' : 'Captions off'}
            onClick={() => setCaptionsOn((v) => !v)}
          />
        )}
        <Button variant="outline" className="h-10 rounded-full border-destructive/40 bg-destructive/10 text-destructive" onClick={() => {
          if (showUpload && uploadRows.some((r) => !r.done)) {
            setShowLeaveModal(true)
            return
          }
          room?.disconnect()
          router.push('/app/clips')
        }}>
          <PhoneOff className="mr-2 size-4" /> Leave
        </Button>
      </footer>
      <TeleprompterPanel
        open={teleprompterOpen}
        onClose={() => setTeleprompterOpen(false)}
        scriptText=""
        playing={recording}
        onTogglePlay={() => undefined}
      />
      {showLeaveModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-[400px] rounded-xl border border-border bg-popover p-4 shadow-lg">
            <p className="text-sm font-semibold">Are you sure you want to leave?</p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Your upload will stop if you close this tab. Stay in the Room until uploads finish.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLeaveModal(false)}>Stay in the Room</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowLeaveModal(false)
                  room?.disconnect()
                  router.push('/app/clips')
                }}
              >
                Leave the Room
              </Button>
            </div>
          </div>
        </div>
      )}
      {showChooseFiles && isHost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-[480px] rounded-xl border border-border bg-popover p-4 shadow-lg">
            <p className="text-sm font-semibold">Choose files to edit</p>
            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                <input type="radio" checked={!chooseCloudBackup} onChange={() => setChooseCloudBackup(false)} />
                <span>
                  <span className="block text-[13px] font-semibold">High quality (Partial)</span>
                  <span className="text-xs text-muted-foreground">
                    {uploadRows.filter((r) => r.done).length} of {uploadRows.length} tracks uploaded
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                <input type="radio" checked={chooseCloudBackup} onChange={() => setChooseCloudBackup(true)} />
                <span>
                  <span className="block text-[13px] font-semibold">Cloud backup</span>
                  <span className="text-xs text-muted-foreground">Lower quality, complete</span>
                </span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowChooseFiles(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  setShowChooseFiles(false)
                  if (!activeTakeId) return
                  const res = await fetch(`/api/recording/sessions/${sessionId}/takes/${activeTakeId}/import`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ preferCloudBackup: chooseCloudBackup }),
                  })
                  const json = await res.json()
                  if (json.data?.scriptUrl) router.push(json.data.scriptUrl)
                  else setNetworkBanner(json.error ?? 'Import failed')
                }}
              >
                Start editing
              </Button>
            </div>
          </div>
        </div>
      )}
      {showRecStartedModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-[400px] rounded-xl border border-border bg-popover p-4 shadow-lg">
            <p className="text-sm font-semibold">The host has started a recording</p>
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={hideRecModal} onChange={(e) => setHideRecModal(e.target.checked)} />
              Don&apos;t show this again
            </label>
            <Button className="mt-4 h-9 w-full" onClick={() => setShowRecStartedModal(false)}>OK</Button>
          </div>
        </div>
      )}
    </RoomsFullPage>
  )
}

function RecordButton({ recording, onStart, onStop, disabled }: { recording: boolean; onStart: () => void; onStop: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} className="flex flex-col items-center gap-1 disabled:opacity-50" onClick={recording ? onStop : onStart}>
      <span className={cn('flex size-12 items-center justify-center rounded-full text-white', recording ? 'bg-destructive' : 'bg-lane-record')}>
        {recording ? '■' : '●'}
      </span>
      <span className="text-[11px]">{recording ? 'Stop' : 'Start'}</span>
    </button>
  )
}

function RoundBtn({ icon: Icon, label, onClick }: { icon: typeof Mic; label: string; onClick?: () => void }) {
  return (
    <button type="button" className="flex flex-col items-center gap-1" onClick={onClick}>
      <span className="flex size-11 items-center justify-center rounded-full bg-white/10 text-foreground">
        <Icon className="size-[18px]" />
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </button>
  )
}

function RailBtn({ icon: Icon, label, active, onClick }: { icon: typeof Users; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-lg text-[10px]', active && 'bg-accent')}>
      <Icon className="size-[18px]" />
      {label}
    </button>
  )
}
