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

/** Inbound front desk — less eager VAD to reduce false interrupts on phone audio. */
export function resolveFrontDeskInboundRealtimeTurnDetection(): OutboundRealtimeTurnDetectionConfig {
  const base = resolveOutboundRealtimeTurnDetectionWithOptions();
  if (base.turnDetection.type === "semantic_vad") {
    const envEagerness = process.env.VOICE_REALTIME_VAD_EAGERNESS?.trim().toLowerCase();
    const eagerness: OutboundRealtimeVadEagerness =
      envEagerness &&
      (["auto", "low", "medium", "high"] as const).includes(envEagerness as OutboundRealtimeVadEagerness)
        ? (envEagerness as OutboundRealtimeVadEagerness)
        : "medium";
    return {
      mode: base.mode,
      turnDetection: {
        ...base.turnDetection,
        eagerness,
        interrupt_response: parseBoolEnv(process.env.VOICE_REALTIME_INTERRUPT_RESPONSE, true),
      },
    };
  }
  if (base.turnDetection.type === "server_vad") {
    return {
      mode: base.mode,
      turnDetection: {
        ...base.turnDetection,
        threshold: Math.max(base.turnDetection.threshold ?? 0.75, 0.75),
        silence_duration_ms: Math.max(base.turnDetection.silence_duration_ms ?? 500, 500),
      },
    };
  }
  return base;
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
      interrupt_response: cfg.turnDetection.interrupt_response ?? true,
    };
  }
  return {
    type: "semantic_vad",
    eagerness: cfg.turnDetection.eagerness ?? "high",
    interrupt_response: cfg.turnDetection.interrupt_response ?? true,
  };
}
