import { getPrisma } from "@/lib/server/db";

/** Finalize voicemail drop after Telnyx playback ends (or errors). */
export async function finalizeVoicemailDropPlayback(input: {
  workspaceId: string;
  humanCallId: string;
  status: "completed" | "failed";
  telnyxEventType: string;
}) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: {
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      voicemailDropSentAt: { not: null },
    },
  });
  if (!attempt) return { handled: false };

  const meta =
    attempt.notes && attempt.notes.includes("vm_drop_pending")
      ? attempt.notes
      : `${attempt.notes || ""} vm_drop_pending`.trim();

  if (input.status === "completed") {
    await prisma.powerDialerAttempt.update({
      where: { id: attempt.id },
      data: {
        disposition: attempt.disposition || "Voicemail",
        notes: meta.replace("vm_drop_pending", "vm_drop_completed").trim(),
        status: "voicemail",
        endedAt: attempt.endedAt || new Date(),
        answerClassification: "voicemail",
      },
    });
    return { handled: true, outcome: "completed" as const };
  }

  await prisma.powerDialerAttempt.update({
    where: { id: attempt.id },
    data: {
      notes: meta.replace("vm_drop_pending", "vm_drop_failed").trim(),
      failureReason: input.telnyxEventType,
    },
  });
  return { handled: true, outcome: "failed" as const };
}
