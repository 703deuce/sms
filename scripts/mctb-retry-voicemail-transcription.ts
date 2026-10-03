/**
 * Re-queue transcription for a failed/pending voicemail message (ops).
 *
 * Usage:
 *   WORKSPACE_ID=... VOICEMAIL_MESSAGE_ID=... npx tsx scripts/mctb-retry-voicemail-transcription.ts
 */
import { getPrisma } from "@/lib/db";
import { enqueueTranscriptionJob } from "@/lib/transcription/service";

const workspaceId = process.env.WORKSPACE_ID?.trim();
const messageId = process.env.VOICEMAIL_MESSAGE_ID?.trim();

if (!workspaceId || !messageId) {
  console.error("Set WORKSPACE_ID and VOICEMAIL_MESSAGE_ID");
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();
  const msg = await prisma.voicemailMessage.findFirst({
    where: { id: messageId, workspaceId },
  });
  if (!msg?.recordingUrl) {
    console.error("Voicemail not found or missing recordingUrl");
    process.exit(1);
  }
  const result = await enqueueTranscriptionJob({
    workspaceId,
    sourceType: "voicemail_message",
    sourceId: messageId,
    recordingUrl: msg.recordingUrl,
    durationSeconds: msg.durationSeconds,
    bypassEntitlement: true,
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
