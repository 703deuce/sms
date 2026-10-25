/** Legacy shell context cookie — clips app keeps workspace-only persistence. */

export type PersistedShellContext = 'workspace'

export function readPersistedShellContext(): PersistedShellContext | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.match(/(?:^|; )transovo_shell_context=([^;]+)/)?.[1]
  return raw === 'workspace' ? 'workspace' : null
}

export function writePersistedShellContext(_value: PersistedShellContext) {
  document.cookie = `transovo_shell_context=workspace; path=/; max-age=31536000; samesite=lax`
}

export function syncShellContextFromPath(_pathname: string) {
  writePersistedShellContext('workspace')
}

export function shellContextToNavKey(_persisted: PersistedShellContext | null): null {
  return null
}
