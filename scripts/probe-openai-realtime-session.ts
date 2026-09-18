/**
 * Minimal OpenAI Realtime session probe (GA session.update shape — same as bridge).
 */
import WebSocket from "ws";
import { getOpenAiApiKey } from "@/lib/voice/telnyx/openai-realtime-bridge/config";
import { OPENAI_REALTIME_MINI_MODEL_ID } from "@/lib/voice/telnyx/openai-realtime-bridge/flags";
import { buildOpenAiRealtimeGaSessionUpdate } from "@/lib/voice/telnyx/openai-realtime-bridge/ga-session";
import { buildOpenAiRealtimeVoiceV2Tools } from "@/lib/voice/telnyx/openai-realtime-bridge/realtime-tools";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-receptionist-wizard/after-hours-handling-config";
import { loadOpenAiRealtimeSessionInstructions } from "@/lib/voice/telnyx/openai-realtime-bridge/instructions";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

async function main() {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const config = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  const parsed = parseVoiceAgentConfig(config);
  const handling = resolveAfterHoursHandlingFromAgentConfig(parsed);
  const { instructions } = await loadOpenAiRealtimeSessionInstructions({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  });
  const tools = buildOpenAiRealtimeVoiceV2Tools({
    config: parsed,
    transferEnabled: Boolean(handling?.transferEnabled),
  });

  const model = OPENAI_REALTIME_MINI_MODEL_ID;
  const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
  console.log("model", model);

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const timer = setTimeout(() => {
      console.log("TIMEOUT still open");
      ws.close();
      resolve();
    }, 12000);

    let sentUpdate = false;

    ws.on("open", () => {
      console.log("OPENAI_WS_OPEN");
    });

    ws.on("message", (raw) => {
      const ev = JSON.parse(String(raw)) as { type?: string; error?: unknown };
      console.log("evt", ev.type, ev.type === "error" ? JSON.stringify(ev) : "");
      if (ev.type === "session.created" && !sentUpdate) {
        sentUpdate = true;
        console.log("OPENAI_SEND session.update");
        ws.send(JSON.stringify(buildOpenAiRealtimeGaSessionUpdate({ instructions, tools })));
      }
      if (ev.type === "session.updated") {
        clearTimeout(timer);
        console.log("OK session.updated");
        ws.close();
        resolve();
      }
    });

    ws.on("close", (code, reason) => {
      console.log("close", code, reason.toString());
      clearTimeout(timer);
      resolve();
    });

    ws.on("error", (err) => {
      console.error("ws error", err);
      clearTimeout(timer);
      reject(err);
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
