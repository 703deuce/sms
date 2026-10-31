'use client'

import { useEffect, type RefObject } from 'react'

/**
 * FV4e: close a small popover menu on a pointer-down outside `ref` or on Escape (the "+ Track"
 * menu used to stay open and intercept clicks until an item was picked).
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return
    const onPointer = (e: Event) => {
      const el = ref.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [ref, open, onClose])
}
