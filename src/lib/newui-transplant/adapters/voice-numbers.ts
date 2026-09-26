import type { NumberRow } from "@/newui-transplant/lib/view-models";
import { formatPhone } from "@/lib/utils";

export type MctbNumbersApiRow = {
  e164: string;
  friendlyName?: string | null;
  type?: string | null;
  messagingStatus?: string | null;
  status?: string | null;
};

export function mapMctbNumberRowToNewUi(row: MctbNumbersApiRow): NumberRow {
  const messaging = row.messagingStatus?.trim() || "Not enabled";
  return {
    number: formatPhone(row.e164),
    label: row.friendlyName?.trim() || "—",
    type: row.type?.trim() || "Line",
    messaging,
    line: row.status?.toLowerCase() === "active" ? "Active" : row.status?.trim() || "—",
  };
}
