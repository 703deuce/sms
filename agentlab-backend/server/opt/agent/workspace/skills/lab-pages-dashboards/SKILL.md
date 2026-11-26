---
name: lab-pages-dashboards
when_to_use: Use when building a self-contained HTML report or dashboard with charts or tables for Rick to open. Not for slide decks, a plain markdown-only file, or only publishing a file that already exists (see lab-publish-pages).
description: Build a self-contained HTML report or dashboard, then publish it if needed.
---

# Pages and dashboards

Write one self-contained HTML file (usually `out/index.html` or `out/<name>.html`) that Rick can open without extra build steps.

## Contents

- A clear heading, the period or question the page answers, and the data in both a **table** (readable if charts fail) and a **chart** when the request is quantitative.
- Charts: use **Chart.js** from a CDN, or inline SVG/CSS. Inline Chart.js charts also work after `publish`. Put the numbers in the page (JS data or table cells), not in a missing external JSON file.
- Self-contained means: all CSS/JS in the file or from a well-known CDN; relative paths only for assets you also put next to the file. No "open this in a local dev server" requirement.
- Don't build a slide deck (that's `lab-slides-decks`). Don't ship a blank template with placeholder "lorem" text.

## Publish

- **Use `preview out/page.html --slug my-slug`**: it publishes, prints the live URL at once, then opens it like a user (HTTP status, console and page errors, broken images, chart/table counts) and saves a full-page screenshot to evidence/. Re-run it with the same --slug after every change; it must say PASS and you must look at the screenshot before you send Rick the link.

When Rick should open the page on Agent Lab, load or follow `lab-publish-pages`: `publish out/index.html --title "Title" [--slug slug]`. Send him the printed URL (`https://transovo.ai/app/agent-lab/pages/<slug>`). If you only need a file in `out/`, skip publish.

## Checks

- Confirm the file exists, is non-empty, and contains the required heading, the key numbers, a `<table>` or equivalent, and a chart (`<canvas>` + Chart.js, or `<svg>`, or similar).
- Open it: `readpage file:///workspace/jobs/<id>/out/index.html` or load it in the job browser after `agent_load_browser` only if you need to operate the page. A screenshot is useful if the request is visual.
- If you published, check the public URL the same way before you say it's done.
- If this is a design or landing page and a final quality check matters (or your own look is unsure), you may use `sonnet-assist --mode visual` with only the screenshot and a specific question (see `lab-look-and-watch-media`). Not for ordinary pages.

A minimal Chart.js page is in `chart_template.md` in this folder (`read_section` or `agent_skill_file`).

