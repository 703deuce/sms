import dotenv from "dotenv";
import { cli, defineAgent, ServerOptions } from "@livekit/agents";
import { fileURLToPath } from "node:url";
import type { AnyRuntimeUserData } from "./metadata";
import { applyVoiceRuntimeEnvAliases } from "./env-aliases";
import { runInboundEntry } from "./inbound-entry";
import { resolveOutboundJob, runOutboundLeadQualificationEntry } from "./outbound/entry";

dotenv.config();
applyVoiceRuntimeEnvAliases();

const AGENT_NAME =
  process.env.LIVEKIT_OUTBOUND_AGENT_NAME || "transovo-outbound-runtime";

export default defineAgent<AnyRuntimeUserData>({
  entry: async (ctx) => {
    const outboundJob = await resolveOutboundJob(ctx);
    if (outboundJob) {
      await runOutboundLeadQualificationEntry(ctx, outboundJob);
      return;
    }

    console.warn(
      JSON.stringify({
        service: "transovo-voice-runtime-ts",
        event: "inbound_job_rejected",
        room: ctx.room.name,
        note: "Inbound calls must use Python worker transovo-voice-runtime only",
      }),
    );
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(
    new ServerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: AGENT_NAME,
    }),
  );
}
