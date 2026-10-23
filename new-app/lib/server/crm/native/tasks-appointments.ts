import { getPrisma } from "@/lib/server/db";
import { assertCrmRead, assertCrmWrite } from "./permissions";

export type TaskBucket = "due" | "overdue" | "upcoming" | "done";

export async function listTasks(workspaceId: string, bucket?: TaskBucket, assigneeUserId?: string) {
  const { userId, isAdmin } = await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  const now = new Date();
  const assignee = assigneeUserId || (!isAdmin ? userId : undefined);
  const base = {
    workspaceId,
    ...(assignee ? { assigneeUserId: assignee } : {}),
  };
  let where: import("@prisma/client").Prisma.CrmTaskWhereInput = base;
  if (bucket === "done") where = { ...base, status: "done" };
  else if (bucket === "overdue") {
    where = { ...base, status: { not: "done" }, dueAt: { lt: now } };
  } else if (bucket === "due") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    where = { ...base, status: { not: "done" }, dueAt: { gte: now, lte: end } };
  } else if (bucket === "upcoming") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    where = { ...base, status: { not: "done" }, dueAt: { gt: end } };
  } else {
    where = { ...base, status: { not: "done" } };
  }
  return prisma.crmTask.findMany({
    where,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });
}

export async function createTask(
  workspaceId: string,
  input: {
    title: string;
    contactId?: string;
    notes?: string;
    dueAt?: string;
    assigneeUserId?: string;
    campaignId?: string;
    reminderAt?: string;
  },
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const task = await prisma.crmTask.create({
    data: {
      workspaceId,
      title: input.title.trim(),
      contactId: input.contactId || null,
      notes: input.notes?.trim() || null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      assigneeUserId: input.assigneeUserId || null,
      campaignId: input.campaignId || null,
      reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
      status: "open",
    },
    include: { contact: true },
  });
  if (input.contactId) {
    await prisma.contactActivityEvent.create({
      data: {
        workspaceId,
        contactId: input.contactId,
        kind: "task_created",
        title: "Task created",
        body: task.title,
        metadata: { taskId: task.id },
      },
    });
  }
  return task;
}

export async function patchTask(
  workspaceId: string,
  taskId: string,
  input: Partial<{
    title: string;
    notes: string;
    dueAt: string | null;
    status: string;
    assigneeUserId: string | null;
    reminderAt: string | null;
  }>,
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const row = await prisma.crmTask.findFirst({ where: { id: taskId, workspaceId } });
  if (!row) throw new Error("Task not found");
  return prisma.crmTask.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
      ...(input.reminderAt !== undefined
        ? { reminderAt: input.reminderAt ? new Date(input.reminderAt) : null }
        : {}),
    },
  });
}

export async function listAppointments(
  workspaceId: string,
  opts: { from?: string; to?: string; contactId?: string },
) {
  await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  const from = opts.from ? new Date(opts.from) : new Date();
  const to = opts.to ? new Date(opts.to) : new Date(from.getTime() + 7 * 86400000);
  return prisma.crmAppointment.findMany({
    where: {
      workspaceId,
      startsAt: { gte: from, lte: to },
      ...(opts.contactId ? { contactId: opts.contactId } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 200,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
      deal: { select: { id: true, title: true } },
    },
  });
}

export async function createAppointment(
  workspaceId: string,
  input: {
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    contactId?: string;
    dealId?: string;
    assigneeUserId?: string;
    notes?: string;
  },
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const appt = await prisma.crmAppointment.create({
    data: {
      workspaceId,
      title: input.title.trim(),
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      timezone: input.timezone,
      contactId: input.contactId || null,
      dealId: input.dealId || null,
      assigneeUserId: input.assigneeUserId || null,
      notes: input.notes?.trim() || null,
    },
    include: { contact: true, deal: true },
  });
  if (input.contactId) {
    await prisma.contactActivityEvent.create({
      data: {
        workspaceId,
        contactId: input.contactId,
        kind: "appointment",
        title: appt.title,
        body: input.startsAt,
        metadata: { appointmentId: appt.id },
      },
    });
  }
  return appt;
}

export async function patchAppointment(
  workspaceId: string,
  id: string,
  input: Partial<{
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    contactId: string | null;
    dealId: string | null;
    assigneeUserId: string | null;
    notes: string | null;
  }>,
) {
  await assertCrmWrite(workspaceId);
  const prisma = getPrisma();
  const row = await prisma.crmAppointment.findFirst({ where: { id, workspaceId } });
  if (!row) throw new Error("Appointment not found");
  return prisma.crmAppointment.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.endsAt !== undefined ? { endsAt: new Date(input.endsAt) } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.dealId !== undefined ? { dealId: input.dealId } : {}),
      ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
}
