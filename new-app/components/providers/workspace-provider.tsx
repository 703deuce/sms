'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ROUTE_POLICY_DEFAULT, type RoutePolicy } from '@/lib/data'
import {
  fetchCalls,
  fetchRingingInbound,
  fetchRouting,
  fetchWebRtcToken,
  reportWebRtcPresence,
  linkCallControl,
  registerInboundAnswer,
  registerInboundReject,
  registerOutboundCall,
  saveRouting,
  transferCall as transferCallApi,
} from '@/lib/phone-api'
import { phoneClientLog } from '@/lib/phone-client-log'
import { phoneClientTrace } from '@/lib/phone-client-trace'
import {
  answerInboundSdkCall,
  ensureTelnyxWebRtcClient,
  getSharedTelnyxClient,
  hangupSdkCall,
  resolveInboundSdkCall,
  subscribeTelnyxError,
  subscribeTelnyxNotifications,
  subscribeTelnyxReady,
  subscribeTelnyxWarning,
  type TelnyxSdkNotification,
} from '@/lib/telnyx-webrtc-session'

type CallStatus = 'idle' | 'connecting' | 'ringing' | 'live' | 'ended' | 'failed'

export type ActiveCall = {
  id: string
  humanCallId: string
  name: string
  number: string
  callerId: string
  status: CallStatus
  startedAt?: number
  muted: boolean
  onHold: boolean
  source: 'dialer' | 'power_dialer' | 'callback' | 'inbound'
  webrtcId?: string
  error?: string
  direction?: 'inbound' | 'outbound'
}

export type IncomingCallOffer = {
  webrtcId: string
  from: string
  to: string
  humanCallId?: string
}

type WorkspaceState = {
  routePolicy: RoutePolicy
  updateRoutePolicy: (patch: Partial<RoutePolicy>, origin: string) => Promise<void>
  activeCall: ActiveCall | null
  webrtcStatus: 'offline' | 'connecting' | 'ready' | 'error'
  webrtcError: string | null
  startCall: (args: {
    name: string
    number: string
    callerId: string
    source?: ActiveCall['source']
    powerDialerAttemptId?: string
    idempotencyKey?: string
  }) => boolean
  endCall: () => void
  toggleMute: () => void
  toggleHold: () => void
  elapsed: number
  refreshRouting: () => Promise<void>
  incomingCall: IncomingCallOffer | null
  incomingAnswering: boolean
  answerIncoming: () => void
  rejectIncoming: () => void
  transferActiveCall: (toE164: string) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

function mapTelnyxState(state: string): CallStatus {
  const s = state.toLowerCase()
  if (s.includes('active') || s.includes('answered')) return 'live'
  if (s.includes('ring')) return 'ringing'
  if (s.includes('connect')) return 'connecting'
  if (s.includes('hangup') || s.includes('destroy')) return 'ended'
  if (s.includes('fail')) return 'failed'
  return 'connecting'
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [routePolicy, setRoutePolicy] = useState<RoutePolicy>(ROUTE_POLICY_DEFAULT)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [webrtcStatus, setWebrtcStatus] = useState<WorkspaceState['webrtcStatus']>('offline')
  const [webrtcError, setWebrtcError] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallOffer | null>(null)
  const [incomingAnswering, setIncomingAnswering] = useState(false)

  const telnyxClientRef = useRef<unknown>(null)
  const telnyxCallRef = useRef<unknown>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const activeWebrtcIdRef = useRef<string | null>(null)
  const activeCallRef = useRef<ActiveCall | null>(null)
  const incomingCallRef = useRef<IncomingCallOffer | null>(null)
  const inboundSdkCallRef = useRef<{ id?: string; answer?: () => void; hangup?: () => void } | null>(null)
  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])
  useEffect(() => {
    incomingCallRef.current = incomingCall
  }, [incomingCall])

  const refreshRouting = useCallback(async () => {
    try {
      const data = await fetchRouting()
      setRoutePolicy({
        numberId: data.numberId || ROUTE_POLICY_DEFAULT.numberId,
        duringHours: data.duringHours as RoutePolicy['duringHours'],
        ringStrategy: data.ringStrategy as RoutePolicy['ringStrategy'],
        ringTimeout: data.ringTimeout,
        noAnswer: data.noAnswer as RoutePolicy['noAnswer'],
        afterHours: data.afterHours as RoutePolicy['afterHours'],
        aiCoverage: data.aiCoverage as RoutePolicy['aiCoverage'],
        mctbEnabled: data.mctbEnabled,
        externalForwardE164: data.externalForwardE164 || '',
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      })
    } catch {
      // keep defaults until API available
    }
  }, [])

  useEffect(() => {
    void refreshRouting()
  }, [refreshRouting])

  useEffect(() => {
    let cancelled = false
    let TelnyxRTCClass: Awaited<typeof import('@telnyx/webrtc')>['TelnyxRTC'] | null = null

    const ensureRemoteAudio = () => {
      if (remoteAudioRef.current) return remoteAudioRef.current
      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.setAttribute('playsinline', '')
      audio.id = 'telnyx-remote-audio'
      audio.style.display = 'none'
      document.body.appendChild(audio)
      remoteAudioRef.current = audio
      return audio
    }

    const handleNotification = (notification: TelnyxSdkNotification) => {
      if (cancelled || notification.type !== 'callUpdate' || !notification.call) return
      if (!TelnyxRTCClass) return

      const call = TelnyxRTCClass.telnyxStateCall(
        notification.call as Parameters<typeof TelnyxRTCClass.telnyxStateCall>[0],
      ) as TelnyxSdkNotification['call']

      phoneClientLog('webrtc', 'notification', {
        type: notification.type,
        callId: call?.id,
        direction: call?.direction,
        state: call?.state,
      })
      if (!call?.id) return

      const pending = incomingCallRef.current
      if (call.direction === 'inbound' && pending?.webrtcId === call.id) {
        inboundSdkCallRef.current = call
      }

      if (
        call.direction === 'inbound' &&
        (call.state === 'ringing' || call.state === 'new' || call.state === 'trying')
      ) {
        const current = activeCallRef.current
        const hasActive = current && current.status !== 'ended' && current.status !== 'failed'
        if (hasActive) {
          phoneClientLog('webrtc', 'inbound_ignored_busy')
          return
        }
        const webrtcId = call.id
        const from = call.remoteCallerNumber || 'Unknown'
        const to = call.localCallerNumber || ''
        inboundSdkCallRef.current = call
        phoneClientLog('webrtc', 'inbound_ringing_ui', { webrtcId, from, to })
        phoneClientTrace('inbound_ringing_ui', { webrtcCallId: webrtcId, callState: call.state })
        setIncomingCall({ webrtcId, from, to })
        void fetchRingingInbound()
          .then((row) => {
            if (!row) return
            const display = row.callerName || row.fromE164
            phoneClientTrace('inbound_human_call_linked', {
              humanCallId: row.humanCallId,
              webrtcCallId: webrtcId,
            })
            setIncomingCall((prev) =>
              prev && prev.webrtcId === webrtcId
                ? { ...prev, humanCallId: row.humanCallId, from: display }
                : prev,
            )
          })
          .catch(() => undefined)
        return
      }

      if (
        call.direction === 'inbound' &&
        pending?.webrtcId === call.id &&
        call.state &&
        /hangup|destroy|done|failed/i.test(call.state)
      ) {
        phoneClientLog('webrtc', 'inbound_ended_before_answer', { state: call.state })
        phoneClientTrace('inbound_ended_before_answer', {
          webrtcCallId: call.id,
          callState: call.state,
          humanCallId: pending.humanCallId,
        })
        inboundSdkCallRef.current = null
        setIncomingCall(null)
        setIncomingAnswering(false)
        return
      }

      const tracked = activeWebrtcIdRef.current
      if (!tracked || call.id !== tracked) return
      const status = mapTelnyxState(call.state || '')
      phoneClientTrace('active_call_state', {
        webrtcCallId: call.id,
        callState: call.state,
        humanCallId: activeCallRef.current?.humanCallId,
      })
      setActiveCall((c) =>
        c ? { ...c, status, startedAt: status === 'live' && !c.startedAt ? Date.now() : c.startedAt } : c,
      )
      if (status === 'ended' || status === 'failed') {
        telnyxCallRef.current = null
        activeWebrtcIdRef.current = null
        inboundSdkCallRef.current = null
      }
    }

    async function boot() {
      setWebrtcStatus('connecting')
      phoneClientLog('webrtc', 'boot_start')
      try {
        const tokenRes = await fetchWebRtcToken()
        phoneClientLog('webrtc', 'token_fetched', { mode: tokenRes.mode, hasToken: Boolean(tokenRes.loginToken) })
        if (tokenRes.mode !== 'telnyx' || !tokenRes.loginToken) {
          phoneClientLog('webrtc', 'token_failed', { error: tokenRes.error })
          setWebrtcStatus('error')
          setWebrtcError(tokenRes.error || 'WebRTC credentials are not configured')
          return
        }
        const mod = await import('@telnyx/webrtc')
        TelnyxRTCClass = mod.TelnyxRTC
        if (cancelled) return

        const audio = ensureRemoteAudio()
        phoneClientLog('webrtc', 'connecting')
        const client = await ensureTelnyxWebRtcClient(tokenRes.loginToken)
        if (cancelled) return
        telnyxClientRef.current = client
        const rtc = client as { remoteElement?: HTMLAudioElement }
        rtc.remoteElement = audio

        const registered = await (client as { getIsRegistered?: () => Promise<boolean> }).getIsRegistered?.()
        if (registered && !cancelled) {
          setWebrtcStatus('ready')
          setWebrtcError(null)
        }
      } catch (e) {
        phoneClientLog('webrtc', 'boot_failed', { error: e instanceof Error ? e.message : 'unknown' })
        setWebrtcStatus('error')
        setWebrtcError(e instanceof Error ? e.message : 'Failed to initialize WebRTC')
      }
    }

    const unsubNotification = subscribeTelnyxNotifications(handleNotification)
    const unsubReady = subscribeTelnyxReady(() => {
      phoneClientLog('webrtc', 'telnyx_ready')
      phoneClientTrace('telnyx_ready')
      void reportWebRtcPresence(true).catch(() => undefined)
      if (!cancelled) {
        setWebrtcStatus('ready')
        setWebrtcError(null)
      }
    })
    const unsubError = subscribeTelnyxError((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Telnyx client error'
      phoneClientLog('webrtc', 'telnyx_error', { message: msg })
      phoneClientTrace('telnyx_error', { detail: msg })
      setWebrtcStatus('error')
      setWebrtcError(msg)
    })
    const unsubWarning = subscribeTelnyxWarning((event: unknown) => {
      const payload = event as { code?: number; message?: string; callId?: string }
      phoneClientLog('webrtc', 'telnyx_warning', {
        code: payload?.code,
        message: payload?.message,
      })
      phoneClientTrace('telnyx_warning', {
        detail: payload?.message,
        webrtcCallId: payload?.callId,
      })
    })

    void boot()
    return () => {
      cancelled = true
      unsubNotification()
      unsubReady()
      unsubError()
      unsubWarning()
      void reportWebRtcPresence(false).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (webrtcStatus !== 'ready') return
    const tick = () => {
      void reportWebRtcPresence(true).catch(() => undefined)
    }
    tick()
    const id = window.setInterval(tick, 45_000)
    return () => window.clearInterval(id)
  }, [webrtcStatus])

  const updateRoutePolicy = useCallback(async (patch: Partial<RoutePolicy>, origin: string) => {
    const next = {
      ...routePolicy,
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy: `Operator · via ${origin}`,
    }
    setRoutePolicy(next)
    try {
      await saveRouting({
        policy: patch,
        greetingText: undefined,
      })
    } catch (e) {
      toast.error('Could not save call handling', {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }, [routePolicy])

  const startCall: WorkspaceState['startCall'] = useCallback(
    ({ name, number, callerId, source = 'dialer', powerDialerAttemptId, idempotencyKey }) => {
      if (activeCall && activeCall.status !== 'ended' && activeCall.status !== 'failed') {
        toast.error('A call is already in progress', { description: 'End the current call before starting another.' })
        return false
      }
      if (webrtcStatus !== 'ready' || !telnyxClientRef.current) {
        toast.error('Calling not ready', { description: webrtcError || 'Wait for browser registration or configure Telnyx credentials.' })
        return false
      }

      void (async () => {
        try {
          const reg = await registerOutboundCall({
            to: number,
            from: callerId,
            source,
            powerDialerAttemptId,
            idempotencyKey,
          })
          const humanCallId = reg.call.id
          const client = telnyxClientRef.current as {
            newCall: (opts: {
              destinationNumber: string
              callerNumber?: string
              remoteElement?: HTMLAudioElement
              clientState?: string
            }) => { id?: string; hangup?: () => void; muteAudio?: () => void; unmuteAudio?: () => void; hold?: () => void; unhold?: () => void }
          }

          const webrtcCall = client.newCall({
            destinationNumber: number,
            callerNumber: callerId,
            remoteElement: remoteAudioRef.current || undefined,
            clientState: btoa(JSON.stringify({ humanCallId, kind: 'human' })),
          })
          const webrtcId = webrtcCall.id || `webrtc-${Date.now()}`
          telnyxCallRef.current = webrtcCall
          activeWebrtcIdRef.current = webrtcId

          setActiveCall({
            id: webrtcId,
            humanCallId,
            name,
            number,
            callerId,
            status: 'connecting',
            muted: false,
            onHold: false,
            source,
            webrtcId,
            startedAt: undefined,
          })

          void linkCallControl({ humanCallId, webrtcCallId: webrtcId }).catch(() => undefined)
        } catch (e) {
          toast.error('Call failed', { description: e instanceof Error ? e.message : undefined })
          setActiveCall(null)
        }
      })()

      return true
    },
    [activeCall, webrtcStatus, webrtcError],
  )

  const endCall = useCallback(() => {
    const call = telnyxCallRef.current as { hangup?: () => void } | null
    call?.hangup?.()
    telnyxCallRef.current = null
    setActiveCall((c) => (c ? { ...c, status: 'ended' } : c))
    window.setTimeout(() => setActiveCall(null), 1500)
  }, [])

  const toggleMute = useCallback(() => {
    const call = telnyxCallRef.current as { muteAudio?: () => void; unmuteAudio?: () => void } | null
    setActiveCall((c) => {
      if (!c) return c
      const muted = !c.muted
      if (muted) call?.muteAudio?.()
      else call?.unmuteAudio?.()
      return { ...c, muted }
    })
  }, [])

  const answerIncoming = useCallback(() => {
    const inc = incomingCall
    if (!inc || incomingAnswering) return
    void (async () => {
      setIncomingAnswering(true)
      let humanCallId = inc.humanCallId
      let displayFrom = inc.from
      if (!humanCallId) {
        try {
          const row = await fetchRingingInbound()
          if (row) {
            humanCallId = row.humanCallId
            displayFrom = row.callerName || row.fromE164
          }
        } catch {
          // continue — still attempt WebRTC answer
        }
      }
      phoneClientLog('webrtc', 'inbound_answer_clicked', { humanCallId, webrtcId: inc.webrtcId })
      phoneClientTrace('inbound_answer_clicked', { humanCallId, webrtcCallId: inc.webrtcId })
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (e) {
        setIncomingAnswering(false)
        toast.error('Microphone access is required to answer calls', {
          description: e instanceof Error ? e.message : undefined,
        })
        return
      }

      const client = getSharedTelnyxClient() || (telnyxClientRef.current as ReturnType<typeof getSharedTelnyxClient>)
      const audio = remoteAudioRef.current
      if (audio) void audio.play().catch(() => undefined)
      let liveCall
      try {
        liveCall = await resolveInboundSdkCall(client, inc.webrtcId, inboundSdkCallRef.current)
        await answerInboundSdkCall(liveCall, { remoteElement: audio || undefined })
        phoneClientTrace('inbound_answer_promise_resolved', {
          humanCallId,
          webrtcCallId: inc.webrtcId,
        })
      } catch (e) {
        phoneClientLog('webrtc', 'inbound_answer_failed', {
          error: e instanceof Error ? e.message : 'unknown',
        })
        phoneClientTrace('inbound_answer_failed', {
          humanCallId,
          webrtcCallId: inc.webrtcId,
          detail: e instanceof Error ? e.message : 'unknown',
        })
        setIncomingAnswering(false)
        toast.error('Could not connect the call', {
          description: e instanceof Error ? e.message : undefined,
        })
        return
      }
      telnyxCallRef.current = liveCall
      activeWebrtcIdRef.current = inc.webrtcId
      inboundSdkCallRef.current = liveCall
      setActiveCall({
        id: inc.webrtcId,
        humanCallId: humanCallId || inc.webrtcId,
        name: displayFrom,
        number: displayFrom,
        callerId: inc.to,
        status: 'connecting',
        muted: false,
        onHold: false,
        source: 'inbound',
        direction: 'inbound',
        webrtcId: inc.webrtcId,
      })
      setIncomingCall(null)
      setIncomingAnswering(false)
      if (humanCallId) {
        void registerInboundAnswer(humanCallId, inc.webrtcId).catch(() => undefined)
        void linkCallControl({ humanCallId, webrtcCallId: inc.webrtcId }).catch(() => undefined)
      }
    })()
  }, [incomingCall, incomingAnswering])

  const rejectIncoming = useCallback(() => {
    const inc = incomingCall
    if (!inc) return
    phoneClientLog('webrtc', 'inbound_reject_clicked', { humanCallId: inc.humanCallId })
    const client = getSharedTelnyxClient() || (telnyxClientRef.current as ReturnType<typeof getSharedTelnyxClient>)
    void resolveInboundSdkCall(client, inc.webrtcId, inboundSdkCallRef.current)
      .then((live) => hangupSdkCall(live))
      .catch(() => hangupSdkCall(inboundSdkCallRef.current))
    inboundSdkCallRef.current = null
    if (inc.humanCallId) {
      void registerInboundReject(inc.humanCallId).catch(() => undefined)
    }
    setIncomingCall(null)
    setIncomingAnswering(false)
  }, [incomingCall])

  const transferActiveCall = useCallback(
    async (toE164: string) => {
      const c = activeCall
      if (!c?.humanCallId) throw new Error('No active call')
      if (c.status !== 'live' && c.status !== 'ringing') throw new Error('Call is not connected')
      await transferCallApi(c.humanCallId, toE164)
      const call = telnyxCallRef.current as { hangup?: () => void } | null
      call?.hangup?.()
      telnyxCallRef.current = null
      setActiveCall((prev) => (prev ? { ...prev, status: 'ended' } : prev))
      window.setTimeout(() => setActiveCall(null), 800)
      toast.success('Call transferred')
    },
    [activeCall],
  )

  const toggleHold = useCallback(() => {
    const call = telnyxCallRef.current as { hold?: () => void; unhold?: () => void } | null
    setActiveCall((c) => {
      if (!c) return c
      const onHold = !c.onHold
      if (onHold) call?.hold?.()
      else call?.unhold?.()
      return { ...c, onHold }
    })
  }, [])

  useEffect(() => {
    if (activeCall?.status !== 'live' || !activeCall.startedAt) return
    const started = activeCall.startedAt
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [activeCall?.status, activeCall?.startedAt])

  const value = useMemo(
    () => ({
      routePolicy,
      updateRoutePolicy,
      activeCall,
      webrtcStatus,
      webrtcError,
      startCall,
      endCall,
      toggleMute,
      toggleHold,
      elapsed,
      refreshRouting,
      incomingCall,
      incomingAnswering,
      answerIncoming,
      rejectIncoming,
      transferActiveCall,
    }),
    [
      routePolicy,
      updateRoutePolicy,
      activeCall,
      webrtcStatus,
      webrtcError,
      startCall,
      endCall,
      toggleMute,
      toggleHold,
      elapsed,
      refreshRouting,
      incomingCall,
      incomingAnswering,
      answerIncoming,
      rejectIncoming,
      transferActiveCall,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
