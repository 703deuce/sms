/** [HOOK:AUTH] — dev actor until billing/login ship. */
export type SwActor = { id: string; name: string; role: 'OWNER' }

export function getActor(): SwActor {
  return { id: 'dev_actor', name: 'Writer', role: 'OWNER' }
}

export function assertRole(_actor: SwActor, _roles: SwActor['role'][]): void {
  /* stub */
}
