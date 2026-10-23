import { getPrisma } from "@/lib/server/db";

export const DEFAULT_DISPOSITION_LABELS = [
  { label: "Booked", category: "positive", markConnected: true, markContactCompleted: true },
  { label: "Interested", category: "positive", markConnected: true },
  { label: "Callback", category: "follow_up", markConnected: true, scheduleCallback: true },
  { label: "No answer", category: "no_contact" },
  { label: "Voicemail", category: "no_contact" },
  { label: "Not interested", category: "negative", markContactCompleted: true },
  { label: "Wrong number", category: "negative", markContactCompleted: true, removeFromQueue: true },
  { label: "Do not call", category: "negative", addToDnc: true, markContactCompleted: true },
] as const;

export async function ensureDefaultDispositionSet(workspaceId: string) {
  const prisma = getPrisma();
  const existing = await prisma.powerDialerDispositionSet.findFirst({
    where: { workspaceId, isDefault: true },
    include: { dispositions: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing?.dispositions.length) return existing;

  const set = await prisma.powerDialerDispositionSet.create({
    data: {
      workspaceId,
      name: "Default outcomes",
      isDefault: true,
      dispositions: {
        create: DEFAULT_DISPOSITION_LABELS.map((d, i) => ({
          label: d.label,
          category: d.category,
          sortOrder: i,
          markConnected: Boolean((d as { markConnected?: boolean }).markConnected),
          markContactCompleted: Boolean((d as { markContactCompleted?: boolean }).markContactCompleted),
          scheduleCallback: Boolean((d as { scheduleCallback?: boolean }).scheduleCallback),
          removeFromQueue: Boolean((d as { removeFromQueue?: boolean }).removeFromQueue),
          addToDnc: Boolean((d as { addToDnc?: boolean }).addToDnc),
        })),
      },
    },
    include: { dispositions: { orderBy: { sortOrder: "asc" } } },
  });
  return set;
}

export async function listDispositionSets(workspaceId: string) {
  await ensureDefaultDispositionSet(workspaceId);
  const prisma = getPrisma();
  return prisma.powerDialerDispositionSet.findMany({
    where: { workspaceId },
    include: { dispositions: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function resolveDispositionByLabel(
  workspaceId: string,
  setId: string | null | undefined,
  label: string,
) {
  const prisma = getPrisma();
  let set = setId
    ? await prisma.powerDialerDispositionSet.findFirst({ where: { id: setId, workspaceId } })
    : null;
  if (!set) {
    set = await ensureDefaultDispositionSet(workspaceId);
  }
  const row = await prisma.powerDialerDisposition.findFirst({
    where: { setId: set.id, label: { equals: label, mode: "insensitive" } },
  });
  return row;
}
