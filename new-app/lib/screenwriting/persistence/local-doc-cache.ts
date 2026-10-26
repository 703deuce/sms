/** Client-side IndexedDB key helpers (y-indexeddb wiring in W9 UI). */
export function scriptCacheKey(scriptId: string): string {
  return `sw:script:${scriptId}`
}

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error'
