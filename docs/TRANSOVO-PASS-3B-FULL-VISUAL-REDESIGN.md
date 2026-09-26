# TRANSOVO PASS 3B — FULL PRODUCT VISUAL REDESIGN

**THIS IS A DESIGN PASS — NOT A CSS CLEANUP PASS**

Pass 3 established useful shared foundations, but the next pass must correct an important misunderstanding:

The goal is NOT merely to make the existing Transovo UI flatter.

The goal is to materially redesign the presentation of the entire Voice + MCTB product into a substantially cleaner, more minimal, more compact, more intentional operational interface.

The existing functionality and product architecture are frozen.

The visual composition is not frozen.

You are authorized and expected to change:

- page composition
- visual hierarchy
- spacing
- section presentation
- information density
- control placement
- visual grouping
- navigation presentation
- table/list presentation
- configuration presentation
- progressive disclosure
- secondary-information placement
- action hierarchy
- typography hierarchy
- borders
- surfaces
- drawers/modals where they genuinely improve an existing workflow
- responsive composition

while preserving all existing functionality and feature ownership.

This should produce an obvious visual redesign.

If the before and after screenshots look like the same UI with:

- cards removed,
- shadows removed,
- background changed,
- slightly different spacing,
- smaller KPIs,

then this pass has FAILED.

---

## 1. VISUAL NORTH STAR

Use the supplied Fonio screenshots as the strongest external visual-composition reference.

Do NOT copy Fonio branding.

Do NOT copy Fonio's product architecture.

Do NOT remove Transovo capabilities to make the interface appear simpler.

Instead, reproduce the qualities that make the reference interface feel significantly more modern and professional:

### LOW CHROME

The interface should contain very little decorative UI.

The user should see:

`navigation → information → controls → results`

not:

`container → card → header → icon → description → inner card → control`

### CONTENT-FIRST

The actual thing the customer is working with should visually dominate.

### COMPACT

Shorter rows, tighter headers, smaller controls, less vertical padding, fewer giant headings, fewer explanatory paragraphs.

### TYPOGRAPHY CREATES HIERARCHY

Do not put a box around something merely to communicate hierarchy.

### HAIRLINES INSTEAD OF CARDS

A contained surface must have a reason.

### RESTRAINED COLOR

Color should primarily communicate selection, primary action, meaningful status, attention, destructive state.

---

## Evidence standard

- Screenshots are primary evidence; CSS class lists are not proof.
- Do NOT use "inherits surface-first CSS" as completion.
- Mandatory: `/opt/cursor/artifacts/screenshots/transovo-full-redesign/before|after/{voice,mctb}/` desktop + 390px.

---

## Final verdict (when pass completes)

Return exactly one:

- **PASS 3B COMPLETE — FULL VISUAL REDESIGN READY FOR PRODUCT REVIEW**
- **PASS 3B INCOMPLETE — VISUAL REDESIGN DOES NOT YET MEET THE REFERENCE STANDARD**

Then STOP.

(Full instruction text as provided by product — sections 2–30 preserved in product brief; this file is the repo anchor for Pass 3B.)
