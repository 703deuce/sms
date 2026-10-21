/**
 * Voice V3 runtime authority marker (server-only consumers).
 *
 * Production new-app executes tools through synced copies under
 * `new-app/lib/server/voice-v3/` that are byte-identical to this tree for
 * core executors. Session resolve / Phone foundation remain new-app adapters.
 */
export const VOICE_V3_RUNTIME_AUTHORITY_ROOT = "src/lib/voice-v3";

export const VOICE_V3_RUNTIME_AUTHORITY_LABEL =
  "@transovo/voice-v3-runtime → src/lib/voice-v3";

/** New-app connector entry — only supported LiveKit tool execution host. */
export const VOICE_V3_NEW_APP_EXECUTION_CONNECTOR =
  "new-app/lib/server/voice-v3-runtime-connector/execution-host";

export const VOICE_V3_NEW_APP_INTERNAL_API =
  "new-app/app/api/internal/voice-runtime/route.ts";
