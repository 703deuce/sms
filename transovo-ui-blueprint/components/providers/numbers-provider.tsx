'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  CONNECTIONS_SEED,
  OWNED_SEED,
  PORTS_SEED,
  type Assignment,
  type ExternalConnection,
  type OwnedNumber,
  type PortRequest,
} from '@/lib/numbers'

/**
 * In-memory demo store for the Global Numbers workspace. State survives
 * client navigation within a session only — nothing is written to storage,
 * and sensitive porting fields are kept masked.
 */
type NumbersCtx = {
  owned: OwnedNumber[]
  connections: ExternalConnection[]
  ports: PortRequest[]
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
}

const Ctx = createContext<NumbersCtx | null>(null)

export function NumbersProvider({ children }: { children: React.ReactNode }) {
  const [owned, setOwned] = useState(OWNED_SEED)
  const [connections, setConnections] = useState(CONNECTIONS_SEED)
  const [ports, setPorts] = useState(PORTS_SEED)

  const updateOwned = useCallback((id: string, patch: Partial<OwnedNumber>) => {
    setOwned((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }, [])

  const value = useMemo<NumbersCtx>(
    () => ({
      owned,
      connections,
      ports,
      renameNumber: (id, nickname) => updateOwned(id, { nickname }),
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
    }),
    [owned, connections, ports, updateOwned],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNumbers() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNumbers must be used inside NumbersProvider')
  return ctx
}
