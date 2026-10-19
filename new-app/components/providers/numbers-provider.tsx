'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  type Assignment,
  type ExternalConnection,
  type OwnedNumber,
  type PortRequest,
} from '@/lib/numbers'
import { fetchNumbersInventory, patchNumber, purchaseNumber } from '@/lib/numbers-api'

type NumbersCtx = {
  owned: OwnedNumber[]
  connections: ExternalConnection[]
  ports: PortRequest[]
  platform: { id: string; number: string; label: string } | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  renameNumber: (id: string, nickname: string) => void
  setAssignments: (id: string, assignments: Assignment[]) => void
  addOwned: (n: OwnedNumber) => void
  requestRelease: (id: string) => void
  updateOwned: (id: string, patch: Partial<OwnedNumber>) => void
  addConnection: (c: ExternalConnection) => void
  updateConnection: (id: string, patch: Partial<ExternalConnection>) => void
  disconnect: (id: string) => void
  addPort: (p: PortRequest) => void
  updatePort: (id: string, patch: Partial<PortRequest>) => void
  purchaseOwned: (phoneNumber: string, nickname?: string) => Promise<OwnedNumber>
}

const Ctx = createContext<NumbersCtx | null>(null)

export function NumbersProvider({ children }: { children: React.ReactNode }) {
  const [owned, setOwned] = useState<OwnedNumber[]>([])
  const [connections, setConnections] = useState<ExternalConnection[]>([])
  const [ports, setPorts] = useState<PortRequest[]>([])
  const [platform, setPlatform] = useState<NumbersCtx['platform']>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNumbersInventory(true)
      setOwned(data.owned)
      setConnections(data.connections)
      setPorts(data.ports)
      setPlatform(data.platform)
      setLive(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load numbers')
      setLive(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateOwned = useCallback((id: string, patch: Partial<OwnedNumber>) => {
    setOwned((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }, [])

  const purchaseOwned = useCallback(async (phoneNumber: string, nickname?: string) => {
    const row = await purchaseNumber(phoneNumber, nickname)
    setOwned((list) => [row, ...list.filter((x) => x.id !== row.id)])
    setLive(true)
    return row
  }, [])

  const value = useMemo<NumbersCtx>(
    () => ({
      owned,
      connections,
      ports,
      platform,
      loading,
      error,
      refresh,
      renameNumber: (id, nickname) => {
        updateOwned(id, { nickname })
        if (live) {
          void patchNumber(id, { nickname }).catch(() => {
            void refresh()
          })
        }
      },
      setAssignments: (id, assignments) =>
        setOwned((list) =>
          list.map((n) =>
            n.id === id
              ? {
                  ...n,
                  assignments,
                  destination: [...assignments].sort((a, b) => a.priority - b.priority)[0]?.target ?? 'Not routed',
                }
              : n,
          ),
        ),
      addOwned: (n) => setOwned((list) => [n, ...list.filter((x) => x.id !== n.id)]),
      requestRelease: (id) => updateOwned(id, { status: 'releasing' }),
      updateOwned,
      addConnection: (c) => setConnections((list) => [c, ...list]),
      updateConnection: (id, patch) => setConnections((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      disconnect: (id) => setConnections((list) => list.filter((c) => c.id !== id)),
      addPort: (p) => setPorts((list) => [p, ...list]),
      updatePort: (id, patch) => setPorts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      purchaseOwned,
    }),
    [owned, connections, ports, platform, loading, error, refresh, updateOwned, purchaseOwned, live],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNumbers() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNumbers must be used inside NumbersProvider')
  return ctx
}
