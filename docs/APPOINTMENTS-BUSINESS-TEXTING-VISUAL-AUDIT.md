# Appointments Business Texting — Visual Audit

**Date:** 2026-09-10 (final local certification pass)

## Strategy

Preserve Kimi campaign **layout and workflow**. Replace presentation primitives with Appointments design system (`@/components/ui/*`, `campaign-ui-primitives.tsx`). Scoped `appointments-campaigns-overrides.css` is **fallback only** for unmigrated legacy class hooks.

## Surface audit (phase 2 complete)

| Surface | Primary mechanism | Status |
|---------|-------------------|--------|
| Campaign list | `CampaignButton`, `CampaignInput`, `CampaignFilterMenu` | CURRENT_APPOINTMENTS_COMPONENT |
| Create Campaign | `CampaignSegmentToggle`, `CampaignComposerBox`, primitives | CURRENT_APPOINTMENTS_COMPONENT |
| Audience picker | `CampaignAudienceField`, `CampaignChip`, `CampaignDropdownPanel` | CURRENT_APPOINTMENTS_COMPONENT |
| Review | `ReviewDetails` + `CampaignReviewCard`, real launch-review data | CURRENT_APPOINTMENTS_COMPONENT |
| Recurring modal | `RecurringModal` + `CampaignModalOverlay` | CURRENT_APPOINTMENTS_COMPONENT |
| Filter menus | `CampaignFilterMenu` / `CampaignFilterMenuItem` | CURRENT_APPOINTMENTS_COMPONENT |
| Calendar | `useCampaignsBasePath`, StatusChip | SHARED_DESIGN_SYSTEM |
| Detail / Results | `campaign-detail-view`, `campaign-results` | SHARED_DESIGN_SYSTEM |
| No-sender state | `BusinessTextingActivationPanel` | SHARED_DESIGN_SYSTEM |

## CSS override audit (`appointments-campaigns-overrides.css`)

| Rule class | Classification |
|------------|----------------|
| Token bridge (`--camp-accent`, etc.) | REQUIRED_EXCEPTION |
| `.btn-primary`, `.input-field` | REQUIRED_EXCEPTION (composer toolbar) |
| `.camp-row`, `.camp-table`, `.status-pill` | REQUIRED_EXCEPTION |
| `.composer-toolbar` | REQUIRED_EXCEPTION |
| Indigo utility remaps | LEGACY_WORKAROUND (remove as markup migrates) |
| `.filter-menu`, `.seg-toggle`, `.weekday-btn` | **OBSOLETE** (removed — component migration) |

## Mobile / desktop

- **Desktop:** PASS — migrated primitives on list, create, review, recurring
- **Mobile (BT-18):** PASS — responsive toolbar, no horizontal overflow, CTAs reachable at 390px

## Recurring decision

Recurring send is **in scope** for lightweight Campaigns. UI migrated; backend preserved for legacy Mass SMS product.
