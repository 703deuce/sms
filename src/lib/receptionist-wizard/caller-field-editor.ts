import type { CallerFieldRow } from "./advanced-types";

export function slugCallerFieldId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug.startsWith("custom_") ? slug : `custom_${slug || "field"}`;
}

export function addCustomCallerField(
  rows: CallerFieldRow[],
  input: { label: string; question?: string; required?: boolean; askWhen?: CallerFieldRow["askWhen"] },
): CallerFieldRow[] {
  const label = input.label.trim();
  if (!label) return rows;
  const id = slugCallerFieldId(label);
  if (rows.some((r) => r.id === id)) return rows;
  return [
    ...rows,
    {
      id,
      label,
      question:
        input.question?.trim() ||
        `Could you tell me about your ${label.toLowerCase()}?`,
      required: input.required ?? false,
      askWhen: input.askWhen ?? "service_inquiry",
      confirm: false,
      enabled: true,
    },
  ];
}
