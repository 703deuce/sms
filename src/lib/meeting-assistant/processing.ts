import "server-only";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { openAiChatCompletion } from "@/lib/ai/openai";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { transcribeAudioUrlWithDeepgram } from "@/lib/transcription/deepgram-prerecorded";
import {
  telnyxFetchMeetingRecordings,
  telnyxFetchMeetingTranscript,
  telnyxRequestMeetingArtifact,
} from "./telnyx-provider";
import { notifyMeetingRecapReady } from "./notifications";
import { onMeetingRecapReady } from "./workflow-triggers";

type ParsedSegment = {
  speakerName?: string;
  speakerId?: string;
  startMs?: number;
  endMs?: number;
  text: string;
  confidence?: number;
  sequence: number;
};

function parseTranscriptSegments(raw: unknown): ParsedSegment[] {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : Array.isArray((raw as { segments?: unknown }).segments)
        ? (raw as { segments: unknown[] }).segments
        : [];
  return list
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const text = String(o.text || o.content || "").trim();
      if (!text) return null;
      const relativeTs = typeof o.relative_ts === "number" ? o.relative_ts : undefined;
      const seq = typeof o.seq === "number" ? o.seq : index;
      return {
        speakerName:
          typeof o.speaker_label === "string"
            ? o.speaker_label
            : typeof o.speaker_name === "string"
              ? o.speaker_name
              : undefined,
        speakerId: typeof o.speaker_id === "string" ? o.speaker_id : undefined,
        startMs:
          typeof o.start_ms === "number"
            ? o.start_ms
            : relativeTs !== undefined
              ? Math.round(relativeTs * 1000)
              : undefined,
        endMs: typeof o.end_ms === "number" ? o.end_ms : undefined,
        text,
        confidence: typeof o.confidence === "number" ? o.confidence : undefined,
        sequence: seq,
      };
    })
    .filter(Boolean) as ParsedSegment[];
}

async function persistTranscriptSegments(
  sessionId: string,
  workspaceId: string,
  segments: ParsedSegment[],
) {
  const prisma = getPrisma();
  if (!segments.length) return "";
  await prisma.meetingTranscriptSegment.deleteMany({ where: { meetingSessionId: sessionId } });
  const sorted = [...segments].sort((a, b) => a.sequence - b.sequence);
  await prisma.meetingTranscriptSegment.createMany({
    data: sorted.map((s, i) => ({
      meetingSessionId: sessionId,
      workspaceId,
      speakerName: s.speakerName,
      speakerId: s.speakerId,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
      sequence: i,
    })),
  });
  return sorted.map((s) => `${s.speakerName || "Speaker"}: ${s.text}`).join("\n");
}

async function copyRecordingToStorage(
  url: string,
  session: { id: string; workspaceId: string },
): Promise<string | null> {
  try {
    const { uploadFromUrl } = await import("@/lib/storage/upload-from-url");
    const { isTelnyxStorageConfigured } = await import("@/lib/voice/telnyx/storage");
    if (!isTelnyxStorageConfigured()) {
      console.warn(
        "[meeting-recordings] TELNYX_STORAGE not configured — keeping provider URL as temporary fallback only.",
      );
      return null;
    }
    return await uploadFromUrl({
      url,
      key: `meetings/${session.workspaceId}/${session.id}.mp4`,
      contentType: "video/mp4",
      workspaceId: session.workspaceId,
    });
  } catch {
    return null;
  }
}

async function ingestExternalRecording(session: {
  id: string;
  workspaceId: string;
  providerSessionId: string | null;
  recordingEnabled: boolean;
}) {
  if (!session.recordingEnabled || !session.providerSessionId || !process.env.TELNYX_API_KEY) {
    return;
  }
  const prisma = getPrisma();
  const recordings = await telnyxFetchMeetingRecordings(session.providerSessionId).catch(() => null);
  const recList = Array.isArray(recordings)
    ? recordings
    : Array.isArray((recordings as { data?: unknown })?.data)
      ? (recordings as { data: unknown[] }).data
      : [];
  const firstRec = recList[0] as { download_url?: string; url?: string; type?: string } | undefined;
  const recordingUrl = firstRec?.download_url || firstRec?.url;
  if (!recordingUrl) return;

  const storagePath = await copyRecordingToStorage(recordingUrl, session);
  await prisma.meetingSession.update({
    where: { id: session.id },
    data: {
      recordingProviderUrl: recordingUrl,
      recordingStoragePath: storagePath,
      recordingStatus: "ready",
    },
  });
}

async function ingestTransovoVideoTranscript(session: {
  id: string;
  workspaceId: string;
  recordingProviderUrl: string | null;
  recordingStoragePath: string | null;
  transcriptEnabled: boolean;
}) {
  if (!session.transcriptEnabled) return "";
  const recordingUrl = session.recordingProviderUrl;
  if (!recordingUrl) return "";

  const result = await transcribeAudioUrlWithDeepgram(recordingUrl, { diarize: true });
  if (!result.text?.trim()) return "";

  const lines = result.text.split("\n").filter(Boolean);
  const segments: ParsedSegment[] = lines.map((line, i) => ({
    text: line,
    sequence: i,
    speakerName: "Speaker",
  }));
  return persistTranscriptSegments(session.id, session.workspaceId, segments);
}

async function generateSummaryAndActionItems(
  session: {
    id: string;
    workspaceId: string;
    providerSessionId: string | null;
    summaryEnabled: boolean;
    actionItemsEnabled: boolean;
    followUpEnabled: boolean;
    summaryTemplate: string;
  },
  transcriptText: string,
) {
  const prisma = getPrisma();
  let summary: string | null = null;

  if (session.summaryEnabled) {
    const templateHint =
      session.summaryTemplate !== "general"
        ? `Use a ${session.summaryTemplate.replace(/_/g, " ")} meeting summary style.`
        : "";
    summary = await openAiChatCompletion(
      "You summarize business meetings concisely with decisions and next steps.",
      `${templateHint}\n\nSummarize this meeting transcript:\n\n${transcriptText.slice(0, 12000)}`,
      { maxTokens: 900 },
    );

    if (!summary && process.env.TELNYX_API_KEY && session.providerSessionId) {
      const artifact = await telnyxRequestMeetingArtifact(session.providerSessionId, "summary").catch(
        () => null,
      );
      const data = (artifact as { data?: { content?: string; summary?: string } })?.data;
      summary = data?.content || data?.summary || null;
    }
  }

  summary = summary || (transcriptText ? "Meeting captured. Review the transcript for details." : null);

  const actionItems: Array<{ description: string; assigneeText?: string }> = [];
  if (session.actionItemsEnabled && transcriptText.length >= 40) {
    const actionItemsRaw = await openAiChatCompletion(
      "Return JSON array only. Each item: {description, assigneeText}.",
      `Extract action items from:\n\n${transcriptText.slice(0, 10000)}`,
      { temperature: 0.2, maxTokens: 600 },
    );
    if (actionItemsRaw) {
      try {
        const parsed = JSON.parse(actionItemsRaw.replace(/```json|```/g, "").trim());
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item === "object" && item.description) {
              actionItems.push({
                description: String(item.description),
                assigneeText: item.assigneeText ? String(item.assigneeText) : undefined,
              });
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    if (!actionItems.length && session.providerSessionId && process.env.TELNYX_API_KEY) {
      const artifact = await telnyxRequestMeetingArtifact(
        session.providerSessionId,
        "action_items",
      ).catch(() => null);
      const items = (artifact as { data?: { items?: unknown[] } })?.data?.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && typeof item === "object") {
            const o = item as Record<string, unknown>;
            const desc = String(o.description || o.text || "").trim();
            if (desc) {
              actionItems.push({
                description: desc,
                assigneeText: o.assignee ? String(o.assignee) : undefined,
              });
            }
          }
        }
      }
    }
  }

  let followUpEmail: string | null = null;
  if (session.followUpEnabled && summary) {
    followUpEmail = await openAiChatCompletion(
      "Draft a professional follow-up email based on the meeting. No subject line.",
      `Summary:\n${summary}\n\nAction items:\n${actionItems.map((a) => a.description).join("\n")}`,
      { maxTokens: 500 },
    );
  }

  await prisma.meetingActionItem.deleteMany({ where: { meetingSessionId: session.id } });
  if (actionItems.length) {
    await prisma.meetingActionItem.createMany({
      data: actionItems.map((a) => ({
        meetingSessionId: session.id,
        workspaceId: session.workspaceId,
        description: a.description,
        assigneeText: a.assigneeText,
      })),
    });
  }

  const hasRecapContent = Boolean(summary || actionItems.length || transcriptText.length >= 40);
  await prisma.meetingSession.update({
    where: { id: session.id },
    data: {
      status: hasRecapContent ? "completed" : "no_recap",
      summaryText: summary,
      summaryOriginal: summary,
      summaryStatus: summary ? "ready" : session.summaryEnabled ? "failed" : "pending",
      actionItemsStatus: actionItems.length
        ? "ready"
        : session.actionItemsEnabled
          ? "failed"
          : "pending",
      followUpEmailDraft: followUpEmail,
      followUpStatus: followUpEmail ? "ready" : session.followUpEnabled ? "pending" : "pending",
      endedAt: new Date(),
    },
  });

  return { hasRecapContent, summary, actionItems };
}

export async function processMeetingSessionArtifacts(sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.deletedAt) return { skipped: true };

  await prisma.meetingSession.update({
    where: { id: sessionId },
    data: {
      status: "processing",
      summaryStatus: session.summaryEnabled ? "processing" : session.summaryStatus,
      actionItemsStatus: session.actionItemsEnabled ? "processing" : session.actionItemsStatus,
      transcriptStatus:
        session.transcriptEnabled && session.transcriptStatus !== "ready"
          ? "processing"
          : session.transcriptStatus,
    },
  });

  let transcriptText = "";

  if (session.meetingSource === "transovo_video") {
    if (session.transcriptEnabled && session.transcriptStatus !== "ready") {
      transcriptText = await ingestTransovoVideoTranscript(session);
      if (transcriptText) {
        await prisma.meetingSession.update({
          where: { id: sessionId },
          data: { transcriptStatus: "ready" },
        });
      }
    } else if (session.transcriptStatus === "ready") {
      const segments = await prisma.meetingTranscriptSegment.findMany({
        where: { meetingSessionId: sessionId },
        orderBy: { sequence: "asc" },
      });
      transcriptText = segments.map((s) => `${s.speakerName || "Speaker"}: ${s.text}`).join("\n");
    }
  } else if (session.providerSessionId && process.env.TELNYX_API_KEY) {
    if (session.transcriptEnabled) {
      const raw = await telnyxFetchMeetingTranscript(session.providerSessionId).catch(() => null);
      const segments = parseTranscriptSegments(raw);
      if (segments.length) {
        transcriptText = await persistTranscriptSegments(sessionId, session.workspaceId, segments);
        await prisma.meetingSession.update({
          where: { id: sessionId },
          data: { transcriptStatus: "ready" },
        });
      }
    }
    await ingestExternalRecording(session);
  }

  const minTranscript = session.transcriptEnabled ? 40 : 0;
  if (session.transcriptEnabled && transcriptText.length < minTranscript) {
    const recordingReady = session.recordingStatus === "ready";
    if (!recordingReady) {
      await prisma.meetingSession.update({
        where: { id: sessionId },
        data: {
          status: "no_recap",
          summaryStatus: session.summaryEnabled ? "failed" : "pending",
          actionItemsStatus: session.actionItemsEnabled ? "failed" : "pending",
          transcriptStatus: "failed",
          failureMessage: "No usable transcript captured",
        },
      });
      return { noRecap: true };
    }
  }

  const { hasRecapContent } = await generateSummaryAndActionItems(session, transcriptText);

  if (session.appointmentId && hasRecapContent) {
    const row = await prisma.voiceAppointment.findFirst({
      where: { id: session.appointmentId, workspaceId: session.workspaceId },
    });
    if (row) {
      const meta = (row.metadata || {}) as AppointmentMetadata;
      await prisma.voiceAppointment.update({
        where: { id: row.id },
        data: {
          metadata: appendTimeline(meta, {
            type: "meeting_recap_ready",
            label: "Meeting recap ready",
          }) as object,
        },
      });
    }
  }

  if (hasRecapContent) {
    await notifyMeetingRecapReady(session.workspaceId, sessionId, session.appointmentId);
    await onMeetingRecapReady(session.workspaceId, sessionId, session.appointmentId);
  }

  return { completed: hasRecapContent };
}

export async function updateMeetingSummary(
  workspaceId: string,
  sessionId: string,
  summaryText: string,
) {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({ where: { id: sessionId, workspaceId } });
  if (!session) throw new Error("Meeting not found");
  return prisma.meetingSession.update({
    where: { id: sessionId },
    data: { summaryText },
  });
}

export async function resetMeetingSummary(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({ where: { id: sessionId, workspaceId } });
  if (!session?.summaryOriginal) throw new Error("No original summary");
  return prisma.meetingSession.update({
    where: { id: sessionId },
    data: { summaryText: session.summaryOriginal },
  });
}

export async function askMeetingQuestion(
  workspaceId: string,
  sessionId: string,
  question: string,
) {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { transcriptSegments: { orderBy: { sequence: "asc" }, take: 200 } },
  });
  if (!session) throw new Error("Meeting not found");
  const context = [
    session.summaryText ? `Summary:\n${session.summaryText}` : "",
    session.transcriptSegments.map((s) => `${s.speakerName || "Speaker"}: ${s.text}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 14000);

  const answer = await openAiChatCompletion(
    "Answer only using the provided meeting context. If unknown, say you cannot find it in the meeting.",
    `Context:\n${context}\n\nQuestion: ${question}`,
    { maxTokens: 400 },
  );
  return { answer: answer || "I could not find an answer in this meeting." };
}

export async function createMeetingShareLink(input: {
  workspaceId: string;
  sessionId: string;
  includeSummary?: boolean;
  includeActionItems?: boolean;
  includeTranscript?: boolean;
  includeRecording?: boolean;
  expiresAt?: Date | null;
  password?: string | null;
}) {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
  });
  if (!session) throw new Error("Meeting not found");
  const token = randomBytes(24).toString("hex");
  const passwordHash =
    input.password?.trim() ? await bcrypt.hash(input.password.trim(), 10) : null;
  return prisma.meetingRecapShare.create({
    data: {
      meetingSessionId: session.id,
      workspaceId: input.workspaceId,
      token,
      includeSummary: input.includeSummary ?? true,
      includeActionItems: input.includeActionItems ?? true,
      includeTranscript: input.includeTranscript ?? false,
      includeRecording: input.includeRecording ?? false,
      expiresAt: input.expiresAt,
      passwordHash,
    },
  });
}

export async function getMeetingRecordingAccessUrl(
  workspaceId: string,
  sessionId: string,
) {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({
    where: { id: sessionId, workspaceId, deletedAt: null },
  });
  if (!session || session.recordingStatus !== "ready") {
    return { url: null, source: null, temporary: undefined };
  }
  const { resolveMeetingRecordingAccess } = await import("@/lib/storage/meeting-recordings");
  return resolveMeetingRecordingAccess({
    recordingStoragePath: session.recordingStoragePath,
    recordingProviderUrl: session.recordingProviderUrl,
  });
}
