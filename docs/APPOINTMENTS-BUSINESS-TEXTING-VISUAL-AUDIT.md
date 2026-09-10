# Appointments Business Texting — Visual Audit

**Date:** 2026-09-10

## Strategy

Preserve Kimi campaign **layout and workflow**. Replace presentation primitives with Appointments design system (`@/components/ui/*`, `campaign-ui-primitives.tsx`). Scoped `appointments-campaigns-overrides.css` remains **fallback only** for unmigrated legacy classes.

## Surface audit

| Surface | Primary mechanism | Target |
|---------|-------------------|--------|
| Campaign list | `CampaignButton`, `CampaignInput`, typography tokens | CURRENT_APPOINTMENTS_COMPONENT |
| Create Campaign | `CampaignLabel`, `CampaignComposerBox`, `CampaignButton` | CURRENT_APPOINTMENTS_COMPONENT |
| Audience picker | `CampaignAudienceField`, `CampaignChip`, `CampaignDropdownPanel` | CURRENT_APPOINTMENTS_COMPONENT |
| Message composer | `CampaignComposerBox` + shared textarea styling | SHARED_DESIGN_SYSTEM |
| Review | `ReviewDetails.tsx` | LEGACY_KIMI_COMPONENT (pending) |
| Recurring modal | `RecurringModal.tsx` | LEGACY_KIMI_COMPONENT (pending) |
| Calendar | Mixed — links fixed; header button still indigo utility | SCOPED_CSS_ONLY + partial |
| Filter menus / seg-toggle | `.filter-menu`, `.seg-toggle` in Kimi CSS | SCOPED_CSS_ONLY |
| Detail / Results | `campaign-detail-view`, `campaign-results` | SHARED_DESIGN_SYSTEM (already V1 polish) |
| No-sender state | `BusinessTextingActivationPanel` | SHARED_DESIGN_SYSTEM |

## Typography & color

- Migrated surfaces: `font-display`, `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`
- Remaining indigo/slate utilities on unmigrated Kimi toolbars and review flow

## Remaining CSS overrides

`appointments-campaigns-overrides.css` still remaps `.btn-primary`, `.input-field`, indigo text utilities under `.appt-overview-pilot .kimi-campaigns`. **Remove incrementally** as each surface migrates to primitives.

## Screenshot QA (pending browser pass)

Desktop: list, create, audience, composer, review, results, no-sender  
Mobile: list, create, audience, Contact Detail → Message
