import type { OwnedNumber } from "@/lib/numbers";

type PhoneRow = {
  id: string;
  e164: string;
  type: string;
  areaCode: string | null;
  friendlyName: string | null;
  status: string;
  monthlyCostCents: number;
  purchasedAt: Date | null;
  capabilitiesJson: unknown;
  settingsJson: unknown;
};

function parseCapabilities(raw: unknown): OwnedNumber["capabilities"] {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      voice: Boolean(o.voice),
      sms: Boolean(o.sms),
      mms: Boolean(o.mms),
    };
  }
  return { voice: true, sms: true, mms: false };
}

function mapStatus(status: string): OwnedNumber["status"] {
  const s = status.toLowerCase();
  if (s === "active") return "active";
  if (s === "releasing") return "releasing";
  if (s.includes("provision")) return "provisioning";
  if (s.includes("reserved")) return "reserved";
  if (s.includes("fail") || s.includes("issue")) return "issue";
  return "active";
}

export function mapPhoneRowToOwned(row: PhoneRow): OwnedNumber {
  const tollFree = row.type.toLowerCase().includes("toll") || row.e164.startsWith("+1800") || row.e164.startsWith("+1888");
  return {
    id: row.id,
    number: row.e164,
    nickname: row.friendlyName || row.e164,
    numberType: tollFree ? "toll_free" : "local",
    region: row.areaCode ? `Area ${row.areaCode}` : "US",
    country: "US",
    status: mapStatus(row.status),
    capabilities: parseCapabilities(row.capabilitiesJson),
    assignments: [],
    destination: "Not routed",
    addedAt: (row.purchasedAt || new Date()).toISOString(),
    monthly: row.monthlyCostCents ? row.monthlyCostCents / 100 : null,
    setupFee: null,
    defaultCallerId: false,
  };
}
