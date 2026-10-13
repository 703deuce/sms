'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PackageProductApiRow } from '@/lib/appointments/packages/package-form'
import type { PackageCreditRule } from '@/lib/appointments/service-booking/types'

const API = '/api/appointments/service-booking/packages'

export type PackagesCatalogStats = {
  activePackages: number
  customerPackages: number
  availableCredits: number
  redeemedThisMonth: number
  packageRevenueCents: number
}

export function usePackagesCatalog() {
  const [rows, setRows] = useState<PackageProductApiRow[]>([])
  const [stats, setStats] = useState<PackagesCatalogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sort, setSort] = useState<'newest' | 'name' | 'price'>('name')

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [listRes, statsRes] = await Promise.all([fetch(API), fetch(`${API}?view=stats`)])
      if (!listRes.ok) throw new Error('failed')
      const listJson = (await listRes.json()) as { data?: PackageProductApiRow[] }
      const statsJson = statsRes.ok
        ? ((await statsRes.json()) as { data?: PackagesCatalogStats })
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
    next.sort((a, b) => {
      if (sort === 'price') return b.priceCents - a.priceCents
      if (sort === 'newest') return String(b.id).localeCompare(String(a.id))
      return a.name.localeCompare(b.name)
    })
    return next
  }, [rows, search, sort, statusFilter])

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
    async (row: PackageProductApiRow) => {
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
    sort,
    setSort,
    filtered,
    reload: load,
    duplicateRow,
    toggleActive,
  }
}

export function packageCreditsTotal(rules: PackageCreditRule[]): number {
  return rules.filter((r) => r.quantity > 0).reduce((sum, r) => sum + r.quantity, 0)
}
