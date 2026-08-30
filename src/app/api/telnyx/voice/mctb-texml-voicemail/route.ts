import { NextResponse } from "next/server";
import { wrapMctbConsentTexmlBody } from "@/lib/mctb/consent-prompt/texml-response";
import {
  getMctbTexmlVoicemailSession,
  markMctbTexmlVoicemailRecorded,
  markMctbTexmlVoicemailRecording,
  wasMctbTexmlVoicemailRecorded,
} from "@/lib/mctb/texml-ingress/voicemail-session";
import { resolveMctbTexmlVoicemailMessage } from "@/lib/mctb/texml-ingress/voicemail-lookup";
import { traceMctbTexml } from "@/lib/mctb/texml-ingress/trace";

export const runtime = "nodejs";

const TEXML_CONTENT_TYPE = "text/xml; charset=utf-8";

async function parseFields(request: Request): Promise<Record<string, string>> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const form = await request.formData().catch(() => new FormData());
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    out[key] = String(value);
  });
  return out;
}

function pick(fields: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = fields[key];
    if (val?.trim()) return val.trim();
  }
  return "";
}

function texmlHangup() {
  const xml = wrapMctbConsentTexmlBody("<Hangup/>");
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": TEXML_CONTENT_TYPE },
  });
}

/** TeXML &lt;Record&gt; recordingStatusCallback — attach voicemail + transcription. */
export async function POST(request: Request) {
  try {
    const fields = await parseFields(request);
    const callSid = pick(fields, "CallSid", "call_sid");
    const recordingStatus = pick(fields, "RecordingStatus", "recording_status").toLowerCase();
    const recordingUrl = pick(fields, "RecordingUrl", "recording_url");
    const durationRaw = pick(fields, "RecordingDuration", "recording_duration", "Duration");
    const from = pick(fields, "From", "from", "Caller");
    const to = pick(fields, "To", "to", "Called");

    traceMctbTexml("MCTB_VOICEMAIL_RECORD", {
      callSid,
      recordingStatus: recordingStatus || null,
      hasRecordingUrl: Boolean(recordingUrl),
    });

    if (!callSid) {
      return texmlHangup();
    }

    if (recordingStatus === "in-progress" || recordingStatus === "in_progress") {
      markMctbTexmlVoicemailRecording(callSid);
      return texmlHangup();
    }

    if (wasMctbTexmlVoicemailRecorded(callSid)) {
      return texmlHangup();
    }

    let session = getMctbTexmlVoicemailSession(callSid);
    if (!session) {
      const resolved = await resolveMctbTexmlVoicemailMessage({
        callSid,
        callerE164: from || null,
        transovoNumberE164: to || null,
      });
      if (!resolved) return texmlHangup();
      session = {
        workspaceId: resolved.workspaceId,
        messageId: resolved.messageId,
        phase: "recording",
        recordingSaved: false,
      };
    }

    if (recordingStatus && recordingStatus !== "completed") {
      return texmlHangup();
    }

    if (!recordingUrl) {
      return texmlHangup();
    }

    const prisma = (await import("@/lib/db")).getPrisma();
    const existing = await prisma.voicemailMessage.findFirst({
      where: { id: session.messageId, workspaceId: session.workspaceId },
      select: { recordingUrl: true },
    });
    if (existing?.recordingUrl) {
      markMctbTexmlVoicemailRecorded(callSid);
      return texmlHangup();
    }

    const durationSeconds = durationRaw ? Number(durationRaw) || null : null;
    const { attachVoicemailRecordingAndTranscribe } = await import("@/lib/phone/voicemail-service");
    await attachVoicemailRecordingAndTranscribe({
      workspaceId: session.workspaceId,
      messageId: session.messageId,
      recordingUrl,
      durationSeconds,
      upstreamProvider: "telnyx",
      alwaysTranscribe: true,
    });

    markMctbTexmlVoicemailRecorded(callSid);

    traceMctbTexml("MCTB_VOICEMAIL_RECORDED", {
      callSid,
      workspaceId: session.workspaceId,
      messageId: session.messageId,
      durationSeconds,
    });

    return texmlHangup();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({ source: "mctb-texml-voicemail", event: "handler_error", error: message }),
    );
    return texmlHangup();
  }
}

export async function GET() {
  return texmlHangup();
}
