# Voice V3 — Business Auto-Setup — Source → Wizard Mapping

Operational rule: **import suggests; wizard approves.** Re-import uses diff — never blind array replace.

| Source fact (normalized) | Wizard target | Merge type |
|------------------------|---------------|------------|
| `business.name` | `businessName` | CHANGED / NEW if empty |
| `business.description` + address + phone | `knowledgeItems[id=business].summary` | CHANGED; preserve user edits unless user accepts import |
| `business.phone` | embedded in `business` knowledge summary | CHANGED |
| `business.website` | `websiteUrl` | NEW / CHANGED (user confirms on conflict) |
| `business.address` | `business` knowledge + `operatingMaturity` location hints | CHANGED |
| `hours.weekly` | `operatingMaturity.businessSchedule` | CHANGED — never auto-overwrite |
| `hours.prose` | `knowledgeItems[id=hours].summary` | CHANGED; cross-check structured schedule |
| `services[]` | `knowledgeItems[id=services].summary` (list prose) **and** `appointmentTypes[]` (item-by-item) | NEW items only; semantic dedupe |
| `serviceAreas[]` | `knowledgeItems[id=service_area]` (create if missing) | NEW items only |
| `faqs[]` | `knowledgeItems[id=faqs].summary` or structured FAQ entries in summary | Item-by-item merge |
| `pricing[]` | `knowledgeItems[id=pricing].summary` | CHANGED / NEW lines |
| `policies[]` | `knowledgeItems[id=policies].summary` | Item-by-item |
| `emergency` | `urgencyRules` / capabilities context (only if wizard supports) | NEW / CHANGED with review |
| `timezone` (inferred from address) | `timezone` | LOW_CONFIDENCE — user review |
| Unmapped useful facts | Extra `knowledgeItems` with generated ids `import_*` | NEW knowledge rows, status → `owner_approved` on apply |

## Knowledge item status on apply

- High-confidence apply → `complete` or `owner_approved` (matches `build-business-context` approved filter).
- Rejected candidates never written.
- `extracted` used only for pending review UI, not runtime.

## Array merge (mandatory)

- `appointmentTypes`: match by normalized name; semantic duplicate → user decision.
- FAQ lines: normalized question similarity ≥ threshold → `SEMANTIC_DUPLICATE`.
- Never replace full `knowledgeItems` array from import.

## Google Maps fields

Stored on `VoiceV3BusinessKnowledgeSource`: `googlePlaceId`, `googleDataId`, `googleLudocid` (whichever ScrapingDog returns — see client normalization).

## Compiler path after apply

`save_draft` → existing merge → publish → `compileVoiceV3AgentConfig` → `hotContextFromWizard` + approved knowledge block.
