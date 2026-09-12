# MCTB Exclusions — existing system audit

Mechanical audit of the canonical exclusion / suppression list used by missed-call text-back recovery. **No parallel blocklist was introduced in this pass.**

## Route

| Item | Value |
|------|--------|
| Canonical path | `/mctb/setup/exclusions` |
| Page | `src/app/(app)/mctb/setup/exclusions/page.tsx` |
| View | `src/components/mctb/setup/setup-exclusions-view.tsx` |
| Legacy wizard | `src/components/mctb/setup-view.tsx` still embeds exclusions card (same API) |

## Data model (`Suppression` / `review_request_suppression`)

| Field | Present | Notes |
|-------|---------|--------|
| `id` | Yes | CUID |
| `workspaceId` | Yes | Tenant scope |
| `phone` | Yes | Normalized E.164 on MCTB writes |
| `email` | Yes | Not used by MCTB exclusions UI |
| `suppressionKey` | Yes | Unique; MCTB manual: `{workspaceId}:mctb:{phone}` |
| `reason` | Yes | Free-text string |
| `source` | Yes | `mctb_exclusion` or `personal_blocked` on this page |
| `createdAt` | Yes | List ordering |
| `createdBy` | **No** | Not on model |
| `expiresAt` | **No** | No temporary exclusions |
| `notes` | **No** | Reason field only |
| `status` | **No** | Present/removed via delete |

## READ

| Endpoint | Behavior |
|----------|----------|
| `GET /api/mctb/exclusions` | Session required; `findMany` where `source IN (mctb_exclusion, personal_blocked)`, `orderBy createdAt desc`, `take: 200` |

Client-side (premium UI): search, reason/source/origin filters, sort, pagination (default **10** rows).

## WRITE

| Action | Endpoint | Rules |
|--------|----------|--------|
| Create / update reason | `POST /api/mctb/exclusions` `{ phone, reason }` | `normalizeE164`; upsert on `suppressionKey` `{workspaceId}:mctb:{phone}`; `source: mctb_exclusion` |
| Remove MCTB exclusion | `DELETE /api/mctb/exclusions?id=` | Only `source: mctb_exclusion`, workspace-scoped |
| Personal block remove | `DELETE /api/personal/blocked?id=` | **Not** exposed on Exclusions page (preserved: no remove for `personal_blocked`) |
| Personal block create | `POST /api/personal/blocked` | Separate entry; appears in GET list |

## Origin / entry points

| Entry | Writes to | `source` / key |
|-------|-----------|----------------|
| Exclusions page add | `POST /api/mctb/exclusions` | `mctb_exclusion` |
| MCTB Voicemail “Block caller” | Same POST | `mctb_exclusion`, reason often `Blocked from voicemail` |
| Personal voicemail “Block Caller” | Same POST | `mctb_exclusion` |
| Personal blocked UI | `POST /api/personal/blocked` | `personal_blocked`, key `p:{e164}` or per-number key |
| Missed Calls / Conversations | **No dedicated exclude action found** | N/A |
| Carrier STOP / opt-out | Contact status + compliance suppression | **Separate** from this list |

UI **origin** labels for `mctb_exclusion` are inferred from `reason` text (voicemail / conversation / missed) when present; otherwise “Exclusions”.

## Runtime suppression

File: `src/lib/agents/missed-call-text-back/eligibility.ts` (step 9 in `docs/MCTB-RECOVERY-RUNTIME-PRECEDENCE.md`).

When `config.suppressBlockedNumbers` is true:

```text
suppression.findFirst({
  workspaceId,
  OR: [
    { phone: callerE164 },
    { suppressionKey: `${workspaceId}:p:${callerE164}` },
  ],
})
→ ineligible, reason BLOCKED_NUMBER
```

**Scope:** automatic missed-call **recovery SMS** only. Does not disable forwarding, voicemail, or voice block ACLs.

**Precedence:** exclusion check runs **after** duplicate/already-sent and **before** contact opt-out and cooldown.

**Removal:** deleting `mctb_exclusion` row removes suppression; recovery may still fail on consent, cooldown, pause, send window, etc.

**Opt-out:** `suppressOptedOutNumbers` uses `contact.status !== SUBSCRIBED` — separate from exclusions.

## NO-OPS / gaps (honest)

| Item | Status |
|------|--------|
| Status filter | Not applicable (no lifecycle field) |
| Expires column | Not applicable |
| Added by column | Not applicable |
| Bulk actions | Never existed |
| Server-side pagination | API caps at 200; UI paginates client-side |
| Edit phone in place | Not supported (identity = phone) |
| Remove `personal_blocked` from Exclusions UI | Intentionally hidden (same as legacy) |

## Security

All mutations validate `workspaceId` from session. DELETE scoped by `id` + `workspaceId` + `source`.
