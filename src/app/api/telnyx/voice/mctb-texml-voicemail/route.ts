import { NextResponse } from "next/server";
import { wrapMctbConsentTexmlBody } from "@/lib/mctb/consent-prompt/texml-response";
import {
  getMctbTexmlVoicemailSession,
  markMctbTexmlVoicemailRecorded,
  markMctbTexmlVoicemailRecording,
  wasMctbTexmlVoicemailRecorded,
} from "@/lib/mctb/texml-ingress/voicemail-session";
import { resolveMctbTexmlVoicemailMessage } from "@/lib/mctb/texml-ingress/voicemail-lookup";
import {
  parseMctbTexmlFields,
  pickMctbTexmlField,
} from "@/lib/mctb/texml-ingress/parse-texml-fields";
import { traceMctbTexml } from "@/lib/mctb/texml-ingress/trace";

export const runtime = "nodejs";

const TEXML_CONTENT_TYPE = "text/xml; charset=utf-8";

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
    const fields = await parseMctbTexmlFields(request);
    const callSid = pickMctbTexmlField(fields, "CallSid", "call_sid");
    const recordingStatus = pickMctbTexmlField(
      fields,
      "RecordingStatus",
      "recording_status",
    ).toLowerCase();
    const recordingUrl = pickMctbTexmlField(fields, "RecordingUrl", "recording_url");
    const durationRaw = pickMctbTexmlField(
      fields,
      "RecordingDuration",
      "recording_duration",
      "Duration",
    );
    const from = pickMctbTexmlField(fields, "From", "from", "Caller");
    const to = pickMctbTexmlField(fields, "To", "to", "Called");

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
      const { resolveMctbTexmlIngressConfig } = await import(
        "@/lib/mctb/texml-ingress/config-cache"
      );
      const ingressConfig = to ? await resolveMctbTexmlIngressConfig(to).catch(() => null) : null;
      const resolved = await resolveMctbTexmlVoicemailMessage({
        callSid,
        workspaceId: ingressConfig?.workspaceId || null,
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
    const claimed = await prisma.voicemailMessage.updateMany({
      where: {
        id: session.messageId,
        workspaceId: session.workspaceId,
        recordingUrl: null,
      },
      data: { transcriptStatus: "processing" },
    });
    if (claimed.count === 0) {
      const existing = await prisma.voicemailMessage.findFirst({
        where: { id: session.messageId, workspaceId: session.workspaceId },
        select: { recordingUrl: true },
      });
      if (existing?.recordingUrl) {
        markMctbTexmlVoicemailRecorded(callSid);
      }
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
