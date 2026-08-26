const TRACE_PREFIX = "__mctb_vm_trace__:";

export type StoredVoicemailLifecycleTrace = {
  version: 1;
  providerCallId?: string | null;
  buildSha?: string | null;
  events: Array<{
    at: string;
    event: string;
    payload?: Record<string, unknown>;
  }>;
};

function parseStoredTrace(raw: string | null | undefined): StoredVoicemailLifecycleTrace {
  if (!raw?.startsWith(TRACE_PREFIX)) {
    return { version: 1, events: [] };
  }
  try {
    const parsed = JSON.parse(raw.slice(TRACE_PREFIX.length)) as StoredVoicemailLifecycleTrace;
    if (parsed?.version === 1 && Array.isArray(parsed.events)) {
      return parsed;
    }
  } catch {
    // ignore corrupt trace blob
  }
  return { version: 1, events: [] };
}

export function parseMctbVoicemailLifecycleTrace(
  internalNotes?: string | null,
): StoredVoicemailLifecycleTrace | null {
  if (!internalNotes?.startsWith(TRACE_PREFIX)) return null;
  return parseStoredTrace(internalNotes);
}

export function serializeMctbVoicemailLifecycleTrace(trace: StoredVoicemailLifecycleTrace): string {
  return `${TRACE_PREFIX}${JSON.stringify(trace)}`;
}

export { TRACE_PREFIX, parseStoredTrace };
