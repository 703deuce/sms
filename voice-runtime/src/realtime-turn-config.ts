/** OpenAI Realtime turn detection — Semantic VAD (default) or Server VAD. */

export type OutboundRealtimeVadMode = "semantic" | "server";

export type OutboundRealtimeVadEagerness = "auto" | "low" | "medium" | "high";

export type SemanticVadTurnDetection = {
  type: "semantic_vad";
  eagerness?: OutboundRealtimeVadEagerness;
  create_response?: boolean;
  interrupt_response?: boolean;
};

export type ServerVadTurnDetection = {
  type: "server_vad";
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  create_response?: boolean;
  interrupt_response?: boolean;
};

export type OutboundRealtimeTurnDetection =
  | SemanticVadTurnDetection
  | ServerVadTurnDetection;

export type OutboundRealtimeTurnDetectionConfig = {
  mode: OutboundRealtimeVadMode;
  turnDetection: OutboundRealtimeTurnDetection;
};

function parseBoolEnv(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return fallback;
}

function parseNumberEnv(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : fallback;
}

export function resolveOutboundRealtimeVadMode(): OutboundRealtimeVadMode {
  const raw = (process.env.VOICE_REALTIME_VAD_MODE || "semantic").trim().toLowerCase();
  if (raw === "server" || raw === "server_vad") return "server";
  return "semantic";
}

export function resolveOutboundRealtimeTurnDetection(): OutboundRealtimeTurnDetectionConfig {
  return resolveOutboundRealtimeTurnDetectionWithOptions();
}

/** Inbound front desk — Semantic VAD by default; server_vad via env for A/B. */
export function resolveFrontDeskInboundRealtimeTurnDetection(
  config?: Pick<{ advanced?: Record<string, unknown> }, "advanced">,
): OutboundRealtimeTurnDetectionConfig {
  const mode = resolveOutboundRealtimeVadMode();
  const interruptResponse = parseBoolEnv(process.env.VOICE_REALTIME_INTERRUPT_RESPONSE, true);

  if (mode === "server") {
    const vad = config?.advanced?.realtimeVad as
      | {
          threshold?: number;
          silenceDurationMs?: number;
          prefixPaddingMs?: number;
        }
      | undefined;

    const threshold =
      typeof vad?.threshold === "number" && Number.isFinite(vad.threshold)
        ? vad.threshold
        : parseNumberEnv(process.env.VOICE_REALTIME_VAD_THRESHOLD, 0.65);
    const silenceDurationMs =
      typeof vad?.silenceDurationMs === "number" && Number.isFinite(vad.silenceDurationMs)
        ? vad.silenceDurationMs
        : parseNumberEnv(process.env.VOICE_REALTIME_VAD_SILENCE_MS, 700);
    const prefixPaddingMs =
      typeof vad?.prefixPaddingMs === "number" && Number.isFinite(vad.prefixPaddingMs)
        ? vad.prefixPaddingMs
        : parseNumberEnv(process.env.VOICE_REALTIME_VAD_PREFIX_MS, 300);

    return {
      mode: "server",
      turnDetection: {
        type: "server_vad",
        threshold,
        prefix_padding_ms: prefixPaddingMs,
        silence_duration_ms: silenceDurationMs,
        create_response: true,
        interrupt_response: interruptResponse,
      },
    };
  }

  const eagernessRaw = (process.env.VOICE_REALTIME_VAD_EAGERNESS || "medium").trim().toLowerCase();
  const eagerness: OutboundRealtimeVadEagerness = (
    ["auto", "low", "medium", "high"] as const
  ).includes(eagernessRaw as OutboundRealtimeVadEagerness)
    ? (eagernessRaw as OutboundRealtimeVadEagerness)
    : "medium";

  return {
    mode: "semantic",
    turnDetection: {
      type: "semantic_vad",
      eagerness,
      create_response: true,
      interrupt_response: interruptResponse,
    },
  };
}

function resolveOutboundRealtimeTurnDetectionWithOptions(): OutboundRealtimeTurnDetectionConfig {
  const mode = resolveOutboundRealtimeVadMode();
  const interruptResponse = parseBoolEnv(process.env.VOICE_REALTIME_INTERRUPT_RESPONSE, true);

  if (mode === "server") {
    return {
      mode,
      turnDetection: {
        type: "server_vad",
        threshold: parseNumberEnv(process.env.VOICE_REALTIME_VAD_THRESHOLD, 0.75),
        prefix_padding_ms: parseNumberEnv(process.env.VOICE_REALTIME_VAD_PREFIX_MS, 300),
        silence_duration_ms: parseNumberEnv(process.env.VOICE_REALTIME_VAD_SILENCE_MS, 500),
        create_response: true,
        interrupt_response: interruptResponse,
      },
    };
  }

  const eagernessRaw = (process.env.VOICE_REALTIME_VAD_EAGERNESS || "medium").trim().toLowerCase();
  const eagerness: OutboundRealtimeVadEagerness = (
    ["auto", "low", "medium", "high"] as const
  ).includes(eagernessRaw as OutboundRealtimeVadEagerness)
    ? (eagernessRaw as OutboundRealtimeVadEagerness)
    : "high";

  return {
    mode,
    turnDetection: {
      type: "semantic_vad",
      eagerness,
      create_response: true,
      interrupt_response: interruptResponse,
    },
  };
}

export function describeOutboundRealtimeTurnDetection(
  cfg: OutboundRealtimeTurnDetectionConfig,
): Record<string, unknown> {
  if (cfg.turnDetection.type === "server_vad") {
    return {
      type: "server_vad",
      threshold: cfg.turnDetection.threshold,
      prefix_padding_ms: cfg.turnDetection.prefix_padding_ms,
      silence_duration_ms: cfg.turnDetection.silence_duration_ms,
      create_response: cfg.turnDetection.create_response ?? true,
      interrupt_response: cfg.turnDetection.interrupt_response ?? true,
    };
  }
  return {
    type: "semantic_vad",
    eagerness: cfg.turnDetection.eagerness ?? "high",
    create_response: cfg.turnDetection.create_response ?? true,
    interrupt_response: cfg.turnDetection.interrupt_response ?? true,
  };
}
