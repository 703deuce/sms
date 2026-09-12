# MCTB numbers & A2P/TFV UI consolidation audit

## Numbers page (`/mctb/numbers`) — prior UI

| Capability | Backend | New location |
|------------|---------|--------------|
| List workspace numbers | `loadWorkspaceAccessiblePhoneNumbers` | Manage drawer (`GET /api/mctb/numbers`) |
| Messaging status column | `enrichWorkspacePhoneWithMessagingStatus` | Manage drawer summary |
| Add number → `/numbers/buy` | Premium search/reserve/complete | Add drawer flow |
| Link to Phone & Forwarding | — | Primary surface (unchanged intent) |
| Link to `/compliance` | Compliance portal | Verification drawer + deep links |

**Route:** `/mctb/numbers` → **redirect** to `/mctb/setup/phone?open=manage` (bookmark-safe).

## Setup Phone & Forwarding — prior

| Capability | Preserved |
|------------|-----------|
| Dropdown select MCTB sender | Yes (when multiple numbers) |
| Manage numbers link | Replaced with **Manage number** / **Choose number** drawer |

## Onboarding — prior

| Capability | New location |
|------------|--------------|
| `provision_trial_number` | Add drawer “Assign recommended” + connect auto-provision |
| TFV POST + compliance links | Verification drawer |
| Trial number status panel | Recovery step + shared drawer |

## A2P / TFV / Compliance portal (`/compliance/*`)

| Surface | Capabilities | New customer path |
|---------|--------------|-------------------|
| Business profile | Legal entity, address, EIN, website | Verification drawer step 1 + `/compliance/business` |
| Brand registration | 10DLC brand | Same link from drawer |
| Campaign registration | Use case, samples, opt-in | Drawer step 2 + `/compliance/campaign` |
| TFV submit | `POST /api/mctb/tfv` → `submitTrialTollFreeVerification` | Verification drawer **Submit** |
| TFV sync/poll | `GET /api/mctb/tfv`, onboarding sync | Drawer + setup status chips |
| Required actions | `deriveRequiredActions` | Listed in verification drawer |

**No backend removed.** Full compliance forms remain on `/compliance/*` for completeness; MCTB exposes a **short guided path** that submits TFV when registration data is sufficient.

## APIs preserved

- `/api/mctb/onboarding` (`provision_trial_number`)
- `/api/mctb/numbers` (new aggregator — select + provision_auto)
- `/api/mctb/tfv`
- `/api/mctb/setup` (phoneNumberId save)
- `/api/numbers/premium/search|reserve|complete`
- All Prisma `phoneNumber` / TFV records

## Navigation

- **Removed** Setup → Numbers child from `buildMctbV1Nav`.
- `/mctb/numbers` legacy redirect documented above.

**UNACCOUNTED_CAPABILITIES: 0** (see step migration in component matrix).
