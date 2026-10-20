import type {
  AppointmentReceptionistWizardState,
  KnowledgeItemStatus,
} from "./types";

export type KnowledgeItem = AppointmentReceptionistWizardState["knowledgeItems"][number];

export function upsertKnowledgeItem(
  items: KnowledgeItem[],
  id: string,
  patch: Partial<KnowledgeItem>,
): KnowledgeItem[] {
  const exists = items.some((i) => i.id === id);
  if (!exists) {
    return [
      ...items,
      {
        id,
        label: patch.label || id,
        summary: patch.summary || "",
        status: (patch.status as KnowledgeItemStatus) || "complete",
        statusLabel: patch.statusLabel || "Saved",
      },
    ];
  }
  return items.map((i) =>
    i.id === id
      ? {
          ...i,
          ...patch,
          status: (patch.status as KnowledgeItemStatus) || i.status,
        }
      : i,
  );
}

export function normalizeWebsiteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}
