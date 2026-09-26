import type { NumberRow } from "@/newui-transplant/lib/view-models";
import { formatPhone } from "@/lib/utils";

export type MctbNumbersApiRow = {
  e164: string;
  friendlyName?: string | null;
  type?: string | null;
  messagingStatus?: string | { label?: string; approved?: boolean } | null;
  status?: string | null;
};

function messagingStatusLabel(
  status: MctbNumbersApiRow["messagingStatus"],
): string {
  if (status == null) return "Not enabled";
  if (typeof status === "string") return status.trim() || "Not enabled";
  if (typeof status === "object" && status.label) return status.label;
  if (typeof status === "object" && status.approved) return "Registered";
  return "Not enabled";
}

export function mapMctbNumberRowToNewUi(row: MctbNumbersApiRow): NumberRow {
  const messaging = messagingStatusLabel(row.messagingStatus);
  return {
    number: formatPhone(row.e164),
    label: row.friendlyName?.trim() || "—",
    type: row.type?.trim() || "Line",
    messaging,
    line: row.status?.toLowerCase() === "active" ? "Active" : row.status?.trim() || "—",
  };
}
