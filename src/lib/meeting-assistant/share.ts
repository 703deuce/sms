import "server-only";

import bcrypt from "bcryptjs";
import { getPrisma, type DbRow } from "@/lib/db";
import { resolveMeetingRecordingAccess } from "@/lib/storage/meeting-recordings";

export type PublicRecapShareView = {
  token: string;
  title: string | null;
  scheduledStartAt: string | null;
  businessName: string;
  passwordRequired: boolean;
  includeSummary: boolean;
  includeActionItems: boolean;
  includeTranscript: boolean;
  includeRecording: boolean;
  summaryText?: string | null;
  actionItems?: Array<{ id: string; description: string; assigneeText: string | null; completed: boolean }>;
  transcriptSegments?: Array<{ id: string; speakerName: string | null; text: string; startMs: number | null }>;
  recordingUrl?: string | null;
  recordingTemporary?: boolean;
};

export class RecapShareAccessError extends Error {
  constructor(
    public code: "not_found" | "expired" | "revoked" | "password_required" | "invalid_password",
    message: string,
  ) {
    super(message);
    this.name = "RecapShareAccessError";
  }
}

async function loadShareRecord(token: string) {
  const prisma = getPrisma();
  return prisma.meetingRecapShare.findFirst({
    where: { token },
    include: {
      meetingSession: {
        include: {
          actionItems: { orderBy: { createdAt: "asc" } },
          transcriptSegments: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });
}

async function assertShareAccessible(
  share: {
    revokedAt: Date | null;
    expiresAt: Date | null;
    passwordHash: string | null;
  },
  password?: string,
) {
  if (share.revokedAt) {
    throw new RecapShareAccessError("revoked", "This recap link has been revoked.");
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    throw new RecapShareAccessError("expired", "This recap link has expired.");
  }
  if (share.passwordHash) {
    if (!password?.trim()) {
      throw new RecapShareAccessError("password_required", "Password required.");
    }
    if (!(await bcrypt.compare(password.trim(), share.passwordHash))) {
      throw new RecapShareAccessError("invalid_password", "Incorrect password.");
    }
  }
}

export async function getPublicRecapShareMeta(token: string) {
  const share = await loadShareRecord(token);
  if (!share?.meetingSession || share.meetingSession.deletedAt) {
    throw new RecapShareAccessError("not_found", "Recap not found.");
  }
  if (share.revokedAt) {
    throw new RecapShareAccessError("revoked", "This recap link has been revoked.");
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    throw new RecapShareAccessError("expired", "This recap link has expired.");
  }

  const workspace = await getPrisma().workspace.findUnique({
    where: { id: share.workspaceId },
    select: { name: true, displayName: true },
  });

  return {
    token: share.token,
    title: share.meetingSession.title,
    scheduledStartAt: share.meetingSession.scheduledStartAt?.toISOString() || null,
    businessName: workspace?.displayName || workspace?.name || "Transovo",
    passwordRequired: Boolean(share.passwordHash),
    includeSummary: share.includeSummary,
    includeActionItems: share.includeActionItems,
    includeTranscript: share.includeTranscript,
    includeRecording: share.includeRecording,
  };
}

export async function getPublicRecapShare(
  token: string,
  password?: string,
): Promise<PublicRecapShareView> {
  const share = await loadShareRecord(token);
  if (!share?.meetingSession || share.meetingSession.deletedAt) {
    throw new RecapShareAccessError("not_found", "Recap not found.");
  }

  await assertShareAccessible(share, password);

  const workspace = await getPrisma().workspace.findUnique({
    where: { id: share.workspaceId },
    select: { name: true, displayName: true },
  });

  const session = share.meetingSession;
  const view: PublicRecapShareView = {
    token: share.token,
    title: session.title,
    scheduledStartAt: session.scheduledStartAt?.toISOString() || null,
    businessName: workspace?.displayName || workspace?.name || "Transovo",
    passwordRequired: Boolean(share.passwordHash),
    includeSummary: share.includeSummary,
    includeActionItems: share.includeActionItems,
    includeTranscript: share.includeTranscript,
    includeRecording: share.includeRecording,
  };

  if (share.includeSummary) {
    view.summaryText = session.summaryText;
  }
  if (share.includeActionItems) {
    view.actionItems = session.actionItems.map((item: DbRow) => ({
      id: item.id,
      description: item.description,
      assigneeText: item.assigneeText,
      completed: item.completed,
    }));
  }
  if (share.includeTranscript) {
    view.transcriptSegments = session.transcriptSegments.map((seg: DbRow) => ({
      id: seg.id,
      speakerName: seg.speakerName,
      text: seg.text,
      startMs: seg.startMs,
    }));
  }
  if (share.includeRecording && session.recordingStatus === "ready") {
    const access = await resolveMeetingRecordingAccess({
      recordingStoragePath: session.recordingStoragePath,
      recordingProviderUrl: session.recordingProviderUrl,
    });
    view.recordingUrl = access.url;
    view.recordingTemporary = access.temporary;
  }

  return view;
}
