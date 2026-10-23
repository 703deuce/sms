import { telnyxRequest } from "@/lib/server/telnyx/client";
import { telnyxCallControlPath } from "@/lib/server/phone/telnyx-call-actions";

export async function startVoicemailDropPlayback(input: {
  telnyxCallControlId: string;
  audioUrl: string;
}) {
  if (process.env.POWER_DIALER_VM_DROP_MOCK === "1") {
    return { ok: true, mocked: true };
  }
  await telnyxRequest(telnyxCallControlPath(input.telnyxCallControlId, "/actions/playback_start"), {
    method: "POST",
    body: { audio_url: input.audioUrl },
  });
  return { ok: true };
}
