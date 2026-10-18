'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ROUTE_POLICY_DEFAULT, type RoutePolicy } from '@/lib/data'

type CallStatus = 'idle' | 'connecting' | 'ringing' | 'live' | 'ended' | 'failed'

export type ActiveCall = {
  id: string
  name: string
  number: string
  callerId: string
  status: CallStatus
  startedAt?: number
  muted: boolean
  onHold: boolean
  source: 'dialer' | 'power_dialer'
}

type WorkspaceState = {
  routePolicy: RoutePolicy
  updateRoutePolicy: (patch: Partial<RoutePolicy>, origin: string) => void
  activeCall: ActiveCall | null
  startCall: (args: { name: string; number: string; callerId: string; source?: ActiveCall['source'] }) => boolean
  endCall: () => void
  toggleMute: () => void
  toggleHold: () => void
  elapsed: number
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [routePolicy, setRoutePolicy] = useState<RoutePolicy>(ROUTE_POLICY_DEFAULT)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const updateRoutePolicy = useCallback((patch: Partial<RoutePolicy>, origin: string) => {
    setRoutePolicy((prev) => ({
      ...prev,
      ...patch,
      updatedAt: new Date(Date.UTC(2026, 9, 18, 16, 40)).toISOString(),
      updatedBy: `Maya Okafor · via ${origin}`,
    }))
  }, [])

  const startCall: WorkspaceState['startCall'] = useCallback(
    ({ name, number, callerId, source = 'dialer' }) => {
      if (activeCall && activeCall.status !== 'ended' && activeCall.status !== 'failed') {
        toast.error('A call is already in progress', { description: 'End the current call before starting another.' })
        return false
      }
      timers.current.forEach(clearTimeout)
      const id = `live_${Date.now()}`
      setElapsed(0)
      setActiveCall({ id, name, number, callerId, status: 'connecting', muted: false, onHold: false, source })
      timers.current = [
        setTimeout(() => setActiveCall((c) => (c?.id === id ? { ...c, status: 'ringing' } : c)), 700),
        setTimeout(
          () => setActiveCall((c) => (c?.id === id ? { ...c, status: 'live', startedAt: Date.now() } : c)),
          2600,
        ),
      ]
      return true
    },
    [activeCall],
  )

  const endCall = useCallback(() => {
    timers.current.forEach(clearTimeout)
    setActiveCall((c) => (c ? { ...c, status: 'ended' } : c))
    timers.current = [setTimeout(() => setActiveCall(null), 1800)]
  }, [])

  const toggleMute = useCallback(() => setActiveCall((c) => (c ? { ...c, muted: !c.muted } : c)), [])
  const toggleHold = useCallback(() => setActiveCall((c) => (c ? { ...c, onHold: !c.onHold } : c)), [])

  useEffect(() => {
    if (activeCall?.status !== 'live' || !activeCall.startedAt) return
    const started = activeCall.startedAt
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [activeCall?.status, activeCall?.startedAt])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const value = useMemo(
    () => ({ routePolicy, updateRoutePolicy, activeCall, startCall, endCall, toggleMute, toggleHold, elapsed }),
    [routePolicy, updateRoutePolicy, activeCall, startCall, endCall, toggleMute, toggleHold, elapsed],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
