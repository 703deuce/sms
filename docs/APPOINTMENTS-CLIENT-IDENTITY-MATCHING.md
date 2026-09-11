# Appointments Client Identity Matching

## Canonical record

- **One person** = one `Contact` row per workspace (`id` is the Client ID in `/appointments/clients/[clientId]`).

## Normalization

| Field | Rule | Implementation |
|-------|--------|----------------|
| Email | trim, lower-case | `normalizeClientEmail` |
| Phone | E.164 | `normalizeE164` / `normalizeClientPhone` |

## Matching rules by channel

| Channel | Match keys | Behavior |
|---------|------------|----------|
| Public booking | Phone (primary) | `resolveOrCreateContact` finds by `phone`; fills email if empty |
| Admin create client | Email OR phone | `findDuplicateClientCandidates`; 409 unless `forceCreate` |
| Admin edit phone | Normalized phone | 409 if another contact owns phone |
| POS | `contactId` on session | Same Contact |
| Import | Contacts importer | Existing duplicate rules |
| Merge | Manual | Source deleted; all FKs repointed to target |

## Duplicate policy

- Never silent duplicate on admin create.
- Do not auto-merge on name alone.
- Merge is transactional repoint + single surviving contact; financial records move, not summed in UI.

## Portal (future)

- Portal pass must attach to the same `Contact.id` preserved through merge (`contactMergeAudit`).
