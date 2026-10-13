'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MembershipProductApiRow } from '@/lib/appointments/memberships/membership-form'

const API = '/api/appointments/service-booking/memberships'

export type MembershipsCatalogStats = {
  activeMemberships: number
  activeMembers: number
  pastDue: number
  monthlyRecurringRevenueCents: number
  renewalsThisMonth: number
}

export function useMembershipsCatalog() {
  const [rows, setRows] = useState<MembershipProductApiRow[]>([])
  const [stats, setStats] = useState<MembershipsCatalogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [intervalFilter, setIntervalFilter] = useState<'all' | 'month' | 'quarter' | 'year'>('all')
  const [sort, setSort] = useState<'newest' | 'name' | 'price' | 'members'>('name')

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [listRes, statsRes] = await Promise.all([fetch(API), fetch(`${API}?view=stats`)])
      if (!listRes.ok) throw new Error('failed')
      const listJson = (await listRes.json()) as { data?: MembershipProductApiRow[] }
      const statsJson = statsRes.ok
        ? ((await statsRes.json()) as { data?: MembershipsCatalogStats })
        : { data: null }
      setRows(listJson.data || [])
      setStats(statsJson.data || null)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let next = [...rows]
    const q = search.trim().toLowerCase()
    if (q) {
      next = next.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          (row.description || '').toLowerCase().includes(q),
      )
    }
    if (statusFilter === 'active') next = next.filter((row) => row.active)
    if (statusFilter === 'inactive') next = next.filter((row) => !row.active)
    if (intervalFilter !== 'all') {
      next = next.filter((row) => row.billingInterval === intervalFilter)
    }
    next.sort((a, b) => {
      if (sort === 'price') return b.priceCents - a.priceCents
      if (sort === 'members') return (b.memberCount ?? 0) - (a.memberCount ?? 0)
      if (sort === 'newest') return String(b.id).localeCompare(String(a.id))
      return a.name.localeCompare(b.name)
    })
    return next
  }, [rows, search, sort, statusFilter, intervalFilter])

  const duplicateRow = useCallback(
    async (id: string) => {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', productId: id }),
      })
      await load()
    },
    [load],
  )

  const toggleActive = useCallback(
    async (row: MembershipProductApiRow) => {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, name: row.name, active: !row.active }),
      })
      await load()
    },
    [load],
  )

  return {
    rows,
    stats,
    loading,
    failed,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    intervalFilter,
    setIntervalFilter,
    sort,
    setSort,
    filtered,
    reload: load,
    duplicateRow,
    toggleActive,
  }
}
