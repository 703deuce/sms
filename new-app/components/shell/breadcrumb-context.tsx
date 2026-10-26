'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Titles = { project?: string; clip?: string }

const BreadcrumbTitleContext = createContext<{
  titles: Titles
  setTitle: (key: keyof Titles, title?: string) => void
} | null>(null)

export function BreadcrumbTitleProvider({ children }: { children: React.ReactNode }) {
  const [titles, setTitles] = useState<Titles>({})
  const setTitle = useCallback((key: keyof Titles, title?: string) => {
    setTitles((t) => ({ ...t, [key]: title }))
  }, [])
  const value = useMemo(() => ({ titles, setTitle }), [titles, setTitle])
  return <BreadcrumbTitleContext.Provider value={value}>{children}</BreadcrumbTitleContext.Provider>
}

export function useBreadcrumbTitles() {
  const ctx = useContext(BreadcrumbTitleContext)
  if (!ctx) throw new Error('useBreadcrumbTitles outside provider')
  return ctx
}

export function useSetBreadcrumbTitle(key: keyof Titles, title?: string) {
  const { setTitle } = useBreadcrumbTitles()
  useEffect(() => {
    setTitle(key, title)
  }, [key, title, setTitle])
}
