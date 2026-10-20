const buffers = new Map<string, { partial: string; lastCommitted: string }>();

export function appendCallerTranscriptDelta(liveSessionId: string, delta: string): void {
  const id = liveSessionId.trim();
  if (!id || !delta) return;
  const row = buffers.get(id) ?? { partial: "", lastCommitted: "" };
  row.partial += delta;
  buffers.set(id, row);
}

/** Commit buffered caller speech (e.g. before delegation). */
export function commitCallerTranscript(liveSessionId: string): string {
  const id = liveSessionId.trim();
  const row = buffers.get(id);
  if (!row) return "";
  const combined = `${row.lastCommitted} ${row.partial}`.trim();
  if (combined) {
    row.lastCommitted = combined;
  }
  row.partial = "";
  buffers.set(id, row);
  return row.lastCommitted;
}

export function getLastCommittedCallerUtterance(liveSessionId: string): string {
  const id = liveSessionId.trim();
  const row = buffers.get(id);
  if (!row) return "";
  const tail = row.partial.trim();
  if (tail) return `${row.lastCommitted} ${tail}`.trim();
  return row.lastCommitted.trim();
}

export function clearCallerTurnBuffer(liveSessionId: string): void {
  buffers.delete(liveSessionId.trim());
}
