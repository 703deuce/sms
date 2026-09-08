import "server-only";

import { getPrisma } from "@/lib/db";

export async function importClientsCsv(
  workspaceId: string,
  rows: Array<{ firstName?: string; lastName?: string; email?: string; phone?: string }>,
  createdByUserId?: string,
) {
  const prisma = getPrisma();
  const batch = await prisma.appointmentImportBatch.create({
    data: {
      workspaceId,
      kind: "clients_csv",
      status: "processing",
      rowCount: rows.length,
      createdByUserId,
      canRollback: true,
    },
  });

  const errors: Array<{ row: number; error: string }> = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.phone && !row.email) throw new Error("phone or email required");
      await prisma.contact.create({
        data: {
          workspaceId,
          firstName: row.firstName || "",
          lastName: row.lastName || "",
          email: row.email,
          phone: row.phone || "",
        },
      });
      successCount++;
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : "Import failed" });
    }
  }

  await prisma.appointmentImportBatch.update({
    where: { id: batch.id },
    data: {
      status: errors.length ? "completed_with_errors" : "completed",
      successCount,
      errorCount: errors.length,
      errors,
    },
  });

  return { batchId: batch.id, successCount, errorCount: errors.length, errors };
}

export async function exportClientsCsv(workspaceId: string) {
  const prisma = getPrisma();
  const contacts = await prisma.contact.findMany({ where: { workspaceId }, take: 10_000 });
  const header = "firstName,lastName,email,phone";
  const lines = contacts.map(
    (c) =>
      `"${(c.firstName || "").replace(/"/g, '""')}","${(c.lastName || "").replace(/"/g, '""')}","${c.email || ""}","${c.phone || ""}"`,
  );
  return [header, ...lines].join("\n");
}

export async function exportAppointmentsCsv(workspaceId: string) {
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: { workspaceId },
    orderBy: { startsAt: "desc" },
    take: 10_000,
  });
  const header = "id,serviceName,startsAt,endsAt,status,contactId";
  const lines = rows.map(
    (r) =>
      `${r.id},"${(r.serviceName || "").replace(/"/g, '""')}",${r.startsAt.toISOString()},${r.endsAt?.toISOString() || ""},${r.status},${r.contactId || ""}`,
  );
  return [header, ...lines].join("\n");
}

export async function rollbackImportBatch(workspaceId: string, batchId: string) {
  const prisma = getPrisma();
  const batch = await prisma.appointmentImportBatch.findFirst({
    where: { id: batchId, workspaceId, canRollback: true, rolledBackAt: null },
  });
  if (!batch) throw new Error("Batch cannot be rolled back");
  await prisma.appointmentImportBatch.update({
    where: { id: batchId },
    data: { rolledBackAt: new Date(), status: "rolled_back" },
  });
  return { batchId, rolledBackAt: new Date().toISOString() };
}
