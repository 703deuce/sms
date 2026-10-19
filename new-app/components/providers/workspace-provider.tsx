'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ROUTE_POLICY_DEFAULT, type RoutePolicy } from '@/lib/data'
import {
  fetchCalls,
  fetchRouting,
  fetchWebRtcToken,
  reportWebRtcPresence,
  linkCallControl,
  registerInboundAnswer,
  registerInboundReject,
  registerOutboundCall,
  saveRouting,
} from '@/lib/phone-api'
import { phoneClientLog } from '@/lib/phone-client-log'

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
  webrtcCall: { answer?: () => void; hangup?: () => void }
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
  answerIncoming: () => void
  rejectIncoming: () => void
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

  const telnyxClientRef = useRef<unknown>(null)
  const telnyxCallRef = useRef<unknown>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const activeWebrtcIdRef = useRef<string | null>(null)
  const activeCallRef = useRef<ActiveCall | null>(null)
  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

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
        const { TelnyxRTC } = await import('@telnyx/webrtc')
        if (cancelled) return
        const audio = document.createElement('audio')
        audio.autoplay = true
        audio.id = 'telnyx-remote-audio'
        audio.style.display = 'none'
        document.body.appendChild(audio)
        remoteAudioRef.current = audio

        const client = new TelnyxRTC({ login_token: tokenRes.loginToken })
        telnyxClientRef.current = client

        client.on('telnyx.ready', () => {
          phoneClientLog('webrtc', 'telnyx_ready')
          void reportWebRtcPresence(true).catch(() => undefined)
          if (!cancelled) {
            setWebrtcStatus('ready')
            setWebrtcError(null)
          }
        })
        client.on('telnyx.error', (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Telnyx client error'
          phoneClientLog('webrtc', 'telnyx_error', { message: msg })
          setWebrtcStatus('error')
          setWebrtcError(msg)
        })
        client.on(
          'telnyx.notification',
          (notification: {
            type?: string
            call?: {
              id?: string
              state?: string
              direction?: string
              remoteCallerNumber?: string
              localCallerNumber?: string
              answer?: () => void
              hangup?: () => void
            }
          }) => {
            const call = notification.call
            phoneClientLog('webrtc', 'notification', {
              type: notification.type,
              callId: call?.id,
              direction: call?.direction,
              state: call?.state,
            })
            if (!call?.id) return

            if (
              notification.type === 'callUpdate' &&
              call.direction === 'inbound' &&
              (call.state === 'ringing' || call.state === 'new')
            ) {
              const current = activeCallRef.current
              const hasActive =
                current && current.status !== 'ended' && current.status !== 'failed'
              if (hasActive) {
                phoneClientLog('webrtc', 'inbound_ignored_busy')
                return
              }
              const webrtcId = call.id
              const from = call.remoteCallerNumber || 'Unknown'
              const to = call.localCallerNumber || ''
              phoneClientLog('webrtc', 'inbound_ringing_ui', { webrtcId, from, to })
              void fetchCalls({ direction: 'inbound', limit: 5, filter: undefined }).then((res) => {
                const digits = from.replace(/\D/g, '').slice(-10)
                const match = res.data.find(
                  (r) =>
                    r.callerNumber === from ||
                    r.callerNumber.replace(/\D/g, '').endsWith(digits),
                )
                setIncomingCall({
                  webrtcId,
                  from,
                  to,
                  humanCallId: match?.id,
                  webrtcCall: call,
                })
              }).catch(() => {
                setIncomingCall({ webrtcId, from, to, webrtcCall: call })
              })
              return
            }

            const tracked = activeWebrtcIdRef.current
            if (!call || !tracked) return
            if (notification.type === 'callUpdate' && call.id === tracked) {
              const status = mapTelnyxState(call.state || '')
              setActiveCall((c) =>
                c ? { ...c, status, startedAt: status === 'live' && !c.startedAt ? Date.now() : c.startedAt } : c,
              )
              if (status === 'ended' || status === 'failed') {
                telnyxCallRef.current = null
                activeWebrtcIdRef.current = null
              }
            }
          },
        )

        phoneClientLog('webrtc', 'connecting')
        client.connect()
      } catch (e) {
        phoneClientLog('webrtc', 'boot_failed', { error: e instanceof Error ? e.message : 'unknown' })
        setWebrtcStatus('error')
        setWebrtcError(e instanceof Error ? e.message : 'Failed to initialize WebRTC')
      }
    }
    void boot()
    return () => {
      cancelled = true
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
    if (!inc) return
    phoneClientLog('webrtc', 'inbound_answer_clicked', { humanCallId: inc.humanCallId, webrtcId: inc.webrtcId })
    inc.webrtcCall.answer?.()
    telnyxCallRef.current = inc.webrtcCall
    activeWebrtcIdRef.current = inc.webrtcId
    const humanCallId = inc.humanCallId || inc.webrtcId
    setActiveCall({
      id: inc.webrtcId,
      humanCallId,
      name: inc.from,
      number: inc.from,
      callerId: inc.to,
      status: 'connecting',
      muted: false,
      onHold: false,
      source: 'inbound',
      direction: 'inbound',
      webrtcId: inc.webrtcId,
    })
    setIncomingCall(null)
    if (inc.humanCallId) {
      void registerInboundAnswer(inc.humanCallId, inc.webrtcId).catch(() => undefined)
      void linkCallControl({ humanCallId: inc.humanCallId, webrtcCallId: inc.webrtcId }).catch(() => undefined)
    }
  }, [incomingCall])

  const rejectIncoming = useCallback(() => {
    const inc = incomingCall
    if (!inc) return
    phoneClientLog('webrtc', 'inbound_reject_clicked', { humanCallId: inc.humanCallId })
    inc.webrtcCall.hangup?.()
    if (inc.humanCallId) {
      void registerInboundReject(inc.humanCallId).catch(() => undefined)
    }
    setIncomingCall(null)
  }, [incomingCall])

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
      answerIncoming,
      rejectIncoming,
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
      answerIncoming,
      rejectIncoming,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
