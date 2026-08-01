/**
 * Duplicate detection + conflict precedence for CRM sync.
 *
 * Precedence (outbound create):
 * 1. Existing object mapping (internalId ↔ externalId) wins
 * 2. Fingerprint match (phone, then email) → update mapped record, do not create duplicate
 * 3. Live CRM search by phone/email when adapter supports it
 * 4. Create new only if auto-create enabled and no match
 *
 * Deleted CRM records: mapping kept with metadata deletedAt; next push recreates if auto-create on.
 * Owner changes: CRM owner wins on inbound; Transovo defaultOwner applies only on create.
 */

import { getPrisma } from "@/lib/db";
import type { ConnectorContext } from "./connector";
import { getConnector } from "./registry";
import {
  fingerprintEmail,
  fingerprintPhone,
  getObjectMapping,
  upsertObjectMapping,
} from "./mappings";
import { appendSyncEvent, writeCrmAudit } from "./logging";
import type { CrmContact, CrmProviderId } from "./types";

export type ResolveContactResult =
  | { action: "use_mapping"; externalId: string }
  | { action: "use_fingerprint"; externalId: string; mappingId: string }
  | { action: "use_remote_search"; externalId: string }
  | { action: "create_new" }
  | { action: "skip"; reason: string };

export async function resolveContactForOutbound(input: {
  workspaceId: string;
  provider: CrmProviderId;
  ctx: ConnectorContext;
  contactId: string;
  phone?: string | null;
  email?: string | null;
  syncRunId?: string;
}): Promise<ResolveContactResult> {
  const mapped = await getObjectMapping({
    workspaceId: input.workspaceId,
    provider: input.provider,
    objectType: "contact",
    internalId: input.contactId,
  });
  if (mapped?.externalId) {
    if ((mapped.metadataJson as { deletedAt?: string } | null)?.deletedAt) {
      return { action: "create_new" };
    }
    return { action: "use_mapping", externalId: mapped.externalId };
  }

  const fpPhone = fingerprintPhone(input.phone);
  const fpEmail = fingerprintEmail(input.email);
  if (fpPhone || fpEmail) {
    const byFp = await getPrisma().crmObjectMapping.findFirst({
      where: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: "contact",
        OR: [
          ...(fpPhone ? [{ fingerprint: fpPhone }] : []),
          ...(fpEmail ? [{ fingerprint: fpEmail }] : []),
        ],
      },
    });
    if (byFp) {
      // Collision: another internal contact already maps to this CRM id.
      if (byFp.internalId !== input.contactId) {
        const fp = fpPhone || fpEmail;
        const { enqueuePendingConflict, getRememberedDecision } = await import("./conflicts-ui");
        const remembered = await getRememberedDecision(input.workspaceId, input.provider, fp);

        if (remembered === "ignore") {
          return { action: "skip", reason: "Duplicate ignored by remembered decision" };
        }
        if (remembered === "use_transovo") {
          return { action: "create_new" };
        }
        if (remembered === "use_crm" || remembered === "merge") {
          await upsertObjectMapping({
            workspaceId: input.workspaceId,
            provider: input.provider,
            objectType: "contact",
            internalId: input.contactId,
            externalId: byFp.externalId,
            fingerprint: fp,
          });
          return {
            action: "use_fingerprint",
            externalId: byFp.externalId,
            mappingId: byFp.id,
          };
        }

        await enqueuePendingConflict({
          workspaceId: input.workspaceId,
          provider: input.provider,
          contactId: input.contactId,
          existingInternalId: byFp.internalId,
          externalId: byFp.externalId,
          fingerprint: fp,
          phone: input.phone,
          email: input.email,
          message: `Possible duplicate: Transovo contact matches CRM record already linked to another contact`,
        });
        if (input.syncRunId) {
          await appendSyncEvent({
            workspaceId: input.workspaceId,
            syncRunId: input.syncRunId,
            provider: input.provider,
            level: "warn",
            action: "conflict",
            objectType: "contact",
            internalId: input.contactId,
            externalId: byFp.externalId,
            message: "Duplicate detected — awaiting customer resolution in CRM Conflicts",
          });
        }
        return {
          action: "skip",
          reason: "Duplicate detected — resolve in Integrations → CRM → Conflicts",
        };
      }
      await upsertObjectMapping({
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: "contact",
        internalId: input.contactId,
        externalId: byFp.externalId,
        fingerprint: fpPhone || fpEmail,
      });
      return {
        action: "use_fingerprint",
        externalId: byFp.externalId,
        mappingId: byFp.id,
      };
    }
  }

  const connector = getConnector(input.provider);
  if (input.ctx.preferences.matchByPhone && input.phone && connector.findContactByPhone) {
    const found = await connector.findContactByPhone(input.ctx, input.phone).catch(() => null);
    if (found?.id) {
      await upsertObjectMapping({
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: "contact",
        internalId: input.contactId,
        externalId: found.id,
        fingerprint: fpPhone || fpEmail,
      });
      return { action: "use_remote_search", externalId: found.id };
    }
  }
  if (input.ctx.preferences.matchByEmail && input.email && connector.findContactByEmail) {
    const found = await connector.findContactByEmail(input.ctx, input.email).catch(() => null);
    if (found?.id) {
      await upsertObjectMapping({
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: "contact",
        internalId: input.contactId,
        externalId: found.id,
        fingerprint: fpEmail || fpPhone,
      });
      return { action: "use_remote_search", externalId: found.id };
    }
  }

  if (!input.ctx.preferences.autoCreateContacts) {
    return { action: "skip", reason: "autoCreateContacts disabled and no match" };
  }
  return { action: "create_new" };
}

export async function markExternalDeleted(input: {
  workspaceId: string;
  provider: CrmProviderId;
  objectType: string;
  externalId: string;
}) {
  const row = await getObjectMapping({
    workspaceId: input.workspaceId,
    provider: input.provider,
    objectType: input.objectType as "contact",
    externalId: input.externalId,
  });
  if (!row) return;
  await getPrisma().crmObjectMapping.update({
    where: { id: row.id },
    data: {
      metadataJson: {
        ...((row.metadataJson as object) || {}),
        deletedAt: new Date().toISOString(),
      },
    },
  });
  await writeCrmAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "conflict",
    action: "external_deleted",
    message: `CRM ${input.objectType} ${input.externalId} marked deleted`,
  });
}

/** Merge inbound CRM contact onto Transovo contact without wiping local richer data. */
export function mergeInboundContact(
  local: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    company?: string | null;
  },
  remote: CrmContact,
) {
  return {
    firstName: local.firstName || remote.firstName || null,
    lastName: local.lastName || remote.lastName || null,
    email: local.email || remote.email || null,
    company: local.company || remote.companyName || null,
  };
}
