import { searchCrmContactsForVoice } from "@/lib/voice/tools/crm-contact-search";
import { getPrisma } from "@/lib/db";
import { patchSessionRuntimeExt } from "@/lib/voice/session-runtime/state";
import { structuredFailure, structuredSuccess } from "@/lib/voice/tool-policy/structured-result";
import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";
import { guardToolInvocation } from "./guard";

export async function domainLookupCustomer(input: {
  ctx: LiveKitCallContext;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "lookup_customer");
  if (blocked) return blocked;

  const prisma = getPrisma();
  const candidates: Array<{
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    source: string;
  }> = [];

  const phone = input.phone || input.ctx.session.callerAni;
  if (phone) {
    const local = await prisma.contact.findFirst({
      where: { workspaceId: input.ctx.workspaceId, phoneE164: phone },
    });
    if (local) {
      candidates.push({
        id: local.id,
        name: local.name,
        phone: local.phoneE164,
        email: local.email,
        source: "local",
      });
    }
  }

  const crm = await searchCrmContactsForVoice({
    workspaceId: input.ctx.workspaceId,
    phone: phone || undefined,
    email: input.email || undefined,
    query: input.name || undefined,
    limit: 5,
  });
  for (const row of crm.matches || []) {
    candidates.push({
      id: String(row.safeId || row.id || ""),
      name: row.displayName,
      phone: row.phone || null,
      email: row.email || null,
      source: row.source || "crm",
    });
  }

  input.ctx.session = patchSessionRuntimeExt(input.ctx.session, { customerCandidates: candidates });

  if (!candidates.length) {
    return structuredSuccess({
      speak: "I don't see an existing account with that information. I'll collect your details.",
      data: { matchCount: 0, candidates: [] },
      nextAllowedActions: ["record_current_field"],
    });
  }

  if (candidates.length === 1) {
    const c = candidates[0]!;
    input.ctx.session = { ...input.ctx.session, contactId: c.id };
    return structuredSuccess({
      speak: `I found an account for ${c.name || "this caller"}.`,
      data: { matchCount: 1, customer: c },
      nextAllowedActions: ["record_current_field", "check_availability"],
    });
  }

  return structuredSuccess({
    speak: "I found a few possible matches. Can you confirm your name or address on file?",
    data: { matchCount: candidates.length, candidates },
    nextAllowedActions: ["record_current_field"],
  });
}
