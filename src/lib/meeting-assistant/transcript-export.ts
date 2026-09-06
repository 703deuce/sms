import "server-only";

import { getPrisma } from "@/lib/db";

export async function downloadMeetingTranscript(
  workspaceId: string,
  meetingSessionId: string,
): Promise<{ text: string; format: "plain" } | null> {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({
    where: { id: meetingSessionId, workspaceId },
  });
  if (!session) return null;
  const meta = (session.metadata || {}) as { transcript?: string; transcriptText?: string };
  const text = meta.transcript || meta.transcriptText || session.summary || "";
  if (!text) return null;
  return { text, format: "plain" };
}

export async function getMeetingTranscriptDownloadResponse(
  workspaceId: string,
  meetingSessionId: string,
) {
  const result = await downloadMeetingTranscript(workspaceId, meetingSessionId);
  if (!result) return null;
  return {
    body: result.text,
    contentType: "text/plain; charset=utf-8",
    filename: `transcript-${meetingSessionId}.txt`,
  };
}
