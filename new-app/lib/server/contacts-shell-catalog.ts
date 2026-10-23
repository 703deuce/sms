import type { ContactStatus } from "@prisma/client";
import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";

/** Demo catalog phones/names — same set as `CONTACTS` in `lib/data.ts` (shell SMS directory). */
export const SHELL_CONTACT_CATALOG_SIZE = 16;

const SHELL_CONTACT_ROWS: {
  name: string;
  phone: string;
  company?: string;
  status: "active" | "lead" | "customer" | "blocked";
}[] = [
  { name: "Elena Vasquez", phone: "+13125558821", company: "Vasquez Realty", status: "customer" },
  { name: "Marcus Chen", phone: "+17735552210", status: "customer" },
  { name: "Aisha Bello", phone: "+13125559034", company: "Bello & Co", status: "lead" },
  { name: "Robert Lindqvist", phone: "+18475551170", status: "customer" },
  { name: "Sofia Marchetti", phone: "+13125554456", status: "lead" },
  { name: "James Okonkwo", phone: "+17735553389", company: "Lakeview Fitness", status: "lead" },
  { name: "Hannah Brooks", phone: "+13125557712", status: "customer" },
  { name: "Victor Nguyen", phone: "+16305556641", status: "lead" },
  { name: "Grace Kim", phone: "+13125550987", company: "Northside Montessori", status: "customer" },
  { name: "Derek Thompson", phone: "+17735558804", status: "blocked" },
  { name: "Leila Haddad", phone: "+13125552267", status: "lead" },
  { name: "Owen Fitzgerald", phone: "+18475559012", status: "customer" },
  { name: "Nadia Petrova", phone: "+13125556120", company: "Petrova Design", status: "lead" },
  { name: "Samuel Adeyemi", phone: "+17735557745", status: "customer" },
  { name: "Clara Johansson", phone: "+13125553398", status: "lead" },
  { name: "Ian McAllister", phone: "+16305552281", company: "McAllister HVAC", status: "lead" },
];

function mapStatus(s: (typeof SHELL_CONTACT_ROWS)[number]["status"]): ContactStatus {
  if (s === "blocked") return "BLOCKED";
  return "SUBSCRIBED";
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

/**
 * Phase 8 switched /app/contacts from mock `lib/data` to Prisma. On QA/prod shells the
 * Contact table may be empty while the product still shows the canonical demo directory
 * in inbox mock data — upsert catalog rows once per workspace when empty.
 */
export async function ensureShellContactsCatalog(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.contact.count({
    where: { workspaceId, status: { not: "INVALID" } },
  });
  if (existing > 0) return;

  await prisma.$transaction(
    SHELL_CONTACT_ROWS.map((row) => {
      const phone = normalizeE164(row.phone);
      const { firstName, lastName } = splitName(row.name);
      const email = `${(firstName || "contact").toLowerCase()}@example.com`;
      return prisma.contact.upsert({
        where: { workspaceId_phone: { workspaceId, phone } },
        create: {
          workspaceId,
          phone,
          firstName,
          lastName,
          company: row.company ?? null,
          email,
          status: mapStatus(row.status),
          customFields: { source: "shell_catalog" },
        },
        update: {
          firstName,
          lastName,
          company: row.company ?? null,
          status: mapStatus(row.status),
        },
      });
    }),
  );
}
