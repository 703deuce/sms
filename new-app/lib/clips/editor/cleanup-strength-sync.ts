/** Sync CleanupPanel strength from defaultStrength, without overriding a user pick. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { cleanupPanelDefaultStrength } from './clean-take-review'
import { type CleanupStrength } from './cleanup-strength'

export function useSyncedCleanupPanelStrength(defaultStrength?: CleanupStrength): {
  strength: CleanupStrength
  setStrength: (next: CleanupStrength) => void
} {
  const [strength, setStrengthState] = useState<CleanupStrength>(() => cleanupPanelDefaultStrength(defaultStrength))
  const touchedRef = useRef(false)
  useEffect(() => {
    if (touchedRef.current) return
    setStrengthState(cleanupPanelDefaultStrength(defaultStrength))
  }, [defaultStrength])
  const setStrength = useCallback((next: CleanupStrength) => {
    touchedRef.current = true
    setStrengthState(next)
  }, [])
  return { strength, setStrength }
}
