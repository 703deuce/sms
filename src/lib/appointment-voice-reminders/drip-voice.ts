import "server-only";

import { getPrisma } from "@/lib/db";
import { executeAppointmentVoiceReminder } from "./service";

/** Drip/sequence voice step — uses appointment context when available. */
export async function executeDripVoiceStep(input: {
  workspaceId: string;
  contactId: string;
  phone: string;
  message: string;
  voiceReminderTemplateId?: string;
  dripCampaignId: string;
  stepIndex: number;
}) {
  const prisma = getPrisma();
  const upcoming = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      startsAt: { gt: new Date() },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
    orderBy: { startsAt: "asc" },
  });

  if (upcoming) {
    return executeAppointmentVoiceReminder({
      workspaceId: input.workspaceId,
      appointmentId: upcoming.id,
      toE164: input.phone,
      templateId: input.voiceReminderTemplateId,
      inlineTemplate: input.message
        ? { humanScript: input.message, voicemailScript: input.message }
        : undefined,
    });
  }

  if (!input.message.trim() && !input.voiceReminderTemplateId) {
    throw new Error("Voice drip step requires a script or voice reminder template");
  }

  throw new Error(
    "Voice drip steps require an upcoming appointment for this contact. Book an appointment or use SMS for general follow-up.",
  );
}
