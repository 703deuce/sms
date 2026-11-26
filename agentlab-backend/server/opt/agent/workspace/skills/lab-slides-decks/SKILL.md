---
name: lab-slides-decks
when_to_use: Use when creating or editing a slide deck (PowerPoint .pptx or an HTML slide sequence). Not for a single title-card image, a Word/PDF document, or an HTML dashboard that is not a deck.
description: Build PowerPoint and HTML slide decks.
---

# Slides and decks

Deliver the deck in `out/` (usually `out/*.pptx`). One idea per slide; readable type; don't crowd.

## PowerPoint (preferred when a .pptx is asked)

- Use Python `pptx` (`python-pptx`), which is installed.
- Default widescreen is 13.333 in × 7.5 in (16:9). Set it if the request names a size.
- Put a title on every slide. Use `Blank` or a title layout and add shapes yourself if the theme is messy.
- Keep body text short (bullets, not paragraphs). Check for overflow by counting characters and leaving margin; you cannot "see" the slide unless you render it.
- To inspect: reopen with `pptx.Presentation` and assert slide count, title text, and placeholder text.

A minimal builder is in `pptx_snippet.md` in this folder (`read_section` or `agent_skill_file`).

## HTML decks

- If Rick wants a deck he can open in a browser (or no pptx was specified and HTML is fine), write a self-contained HTML file: each slide is a full-viewport section, keyboard or button to advance, large type.
- Don't depend on an unpaid external app. Inline CSS (and minimal JS) in the file.
- This is a **slide sequence**, not a scrolling dashboard (that's `lab-pages-dashboards`).

## Checks

- Run `doc-verify out/deck.pptx --pages 4` and look at the rendered slide images before handing over (empty slides and render failures are reported).

- Re-open the pptx and report the measured slide count and the title of each slide.
- If you also export PDF (`soffice --headless --convert-to pdf`), check page count matches the slide count.
- Don't invent logos or photos you don't have; typography and layout are enough unless assets were provided.

