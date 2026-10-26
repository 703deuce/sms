export interface PageLock {
  label: string
  startElementId: string
  startOffset: number
  level: number
}

export interface LockState {
  locks: PageLock[]
}

export function overflowLabel(base: string, index: number, level: number): string {
  if (level <= 1) {
    const suffix = String.fromCharCode(65 + (index % 26))
    return `${base}${suffix}`
  }
  const suffix = 'A'.repeat(index + 1)
  return `${base}${suffix}`
}

export function mergeRangeLabel(a: string, b: string): string {
  return `${a}-${b}`
}

export function unlockOneLevel(state: LockState, label: string): LockState {
  return {
    locks: state.locks.map((l) => (l.label === label ? { ...l, level: Math.max(0, l.level - 1) } : l)),
  }
}

export function adjustLockedPage(state: LockState, label: string, newLabel: string): LockState {
  return {
    locks: state.locks.map((l) => (l.label === label ? { ...l, label: newLabel } : l)),
  }
}
