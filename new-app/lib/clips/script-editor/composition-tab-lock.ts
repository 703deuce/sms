const CHANNEL_PREFIX = 'transovo-script-composition'

export type TabLockMessage =
  | { type: 'claim'; tabId: string; at: number }
  | { type: 'release'; tabId: string }
  | { type: 'ping'; tabId: string; at: number }

export function compositionTabChannel(compositionId: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(`${CHANNEL_PREFIX}:${compositionId}`)
}

export function createTabId(): string {
  return `tab_${crypto.randomUUID().replace(/-/g, '')}`
}
