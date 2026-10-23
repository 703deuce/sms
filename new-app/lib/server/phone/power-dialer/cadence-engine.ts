import { getPrisma } from "@/lib/server/db";
import { z } from "zod";

const stepSchema = z.object({
  type: z.enum(["wait", "call", "sms", "email"]),
  waitMinutes: z.number().optional(),
  templateId: z.string().optional(),
  body: z.string().optional(),
  subject: z.string().optional(),
});

export type CadenceStep = z.infer<typeof stepSchema>;

export function parseCadenceSteps(raw: unknown): CadenceStep[] {
  if (!Array.isArray(raw)) return [];
  const out: CadenceStep[] = [];
  for (const s of raw) {
    const p = stepSchema.safeParse(s);
    if (p.success) out.push(p.data);
  }
  return out;
}

export async function enrollContactInCadence(
  workspaceId: string,
  cadenceId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  const cadence = await prisma.powerDialerCadence.findFirst({
    where: { id: cadenceId, workspaceId, status: "active" },
  });
  if (!cadence) throw new Error("Cadence not found");
  const existing = await prisma.powerDialerCadenceEnrollment.findFirst({
    where: { cadenceId, contactId, status: { in: ["active", "paused"] } },
  });
  if (existing) return existing;
  const steps = parseCadenceSteps(cadence.stepsJson);
  const firstWait = steps[0]?.type === "wait" ? steps[0].waitMinutes ?? 0 : 0;
  const nextStepAt = new Date(Date.now() + firstWait * 60 * 1000);
  return prisma.powerDialerCadenceEnrollment.create({
    data: {
      workspaceId,
      cadenceId,
      contactId,
      status: "active",
      currentStepIndex: 0,
      nextStepAt,
    },
  });
}

export async function pauseCadenceEnrollment(workspaceId: string, enrollmentId: string) {
  const prisma = getPrisma();
  return prisma.powerDialerCadenceEnrollment.updateMany({
    where: { id: enrollmentId, workspaceId },
    data: { status: "paused", pausedAt: new Date() },
  });
}

export async function resumeCadenceEnrollment(workspaceId: string, enrollmentId: string) {
  const prisma = getPrisma();
  return prisma.powerDialerCadenceEnrollment.updateMany({
    where: { id: enrollmentId, workspaceId },
    data: { status: "active", pausedAt: null, nextStepAt: new Date() },
  });
}

export async function advanceCadenceForContact(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const enrollment = await prisma.powerDialerCadenceEnrollment.findFirst({
    where: { workspaceId, contactId, status: "active" },
    include: { cadence: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!enrollment) return { ok: false, message: "No active cadence enrollment" };
  const steps = parseCadenceSteps(enrollment.cadence.stepsJson);
  const nextIndex = enrollment.currentStepIndex + 1;
  if (nextIndex >= steps.length) {
    await prisma.powerDialerCadenceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "completed", completedAt: new Date(), nextStepAt: null },
    });
    return { ok: true, message: "Cadence completed" };
  }
  const step = steps[nextIndex];
  const waitMin = step.type === "wait" ? step.waitMinutes ?? 0 : 0;
  await prisma.powerDialerCadenceEnrollment.update({
    where: { id: enrollment.id },
    data: {
      currentStepIndex: nextIndex,
      nextStepAt: new Date(Date.now() + waitMin * 60 * 1000),
    },
  });
  return { ok: true, message: `Advanced to step ${nextIndex + 1}` };
}

/** Process due cadence steps (SMS/email) — invoked by job or test hook. */
export async function processDueCadenceSteps(workspaceId: string, limit = 20) {
  const prisma = getPrisma();
  const now = new Date();
  const due = await prisma.powerDialerCadenceEnrollment.findMany({
    where: {
      workspaceId,
      status: "active",
      nextStepAt: { lte: now },
    },
    take: limit,
    include: { cadence: true, contact: true },
  });
  const outcomes: { enrollmentId: string; ok: boolean; message: string }[] = [];
  for (const row of due) {
    const steps = parseCadenceSteps(row.cadence.stepsJson);
    const step = steps[row.currentStepIndex];
    if (!step) {
      await prisma.powerDialerCadenceEnrollment.update({
        where: { id: row.id },
        data: { status: "completed", completedAt: now },
      });
      outcomes.push({ enrollmentId: row.id, ok: true, message: "No step — completed" });
      continue;
    }
    if (step.type === "wait") {
      await advanceCadenceForContact(workspaceId, row.contactId);
      outcomes.push({ enrollmentId: row.id, ok: true, message: "Wait elapsed" });
      continue;
    }
    if (step.type === "sms") {
      const { sendDispositionSms } = await import("./disposition-messaging");
      const r = await sendDispositionSms({
        workspaceId,
        contactId: row.contactId,
        body: step.body || "",
        templateId: step.templateId,
      });
      if (r.ok) await advanceCadenceForContact(workspaceId, row.contactId);
      outcomes.push({ enrollmentId: row.id, ok: r.ok, message: r.message });
      continue;
    }
    if (step.type === "email") {
      const { sendDispositionEmail } = await import("./disposition-messaging");
      const r = await sendDispositionEmail({
        workspaceId,
        contactId: row.contactId,
        subject: step.subject || "Follow up",
        body: step.body || "",
        templateId: step.templateId,
      });
      if (r.ok) await advanceCadenceForContact(workspaceId, row.contactId);
      outcomes.push({ enrollmentId: row.id, ok: r.ok, message: r.message });
      continue;
    }
    outcomes.push({
      enrollmentId: row.id,
      ok: true,
      message: "Call step — enroll in campaign manually",
    });
    await advanceCadenceForContact(workspaceId, row.contactId);
  }
  return outcomes;
}
