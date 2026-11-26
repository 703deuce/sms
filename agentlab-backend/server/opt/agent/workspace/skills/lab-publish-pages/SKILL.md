---
name: lab-publish-pages
description: Publishing reports and pages for Rick (publish)
when_to_use: Use when you already have an HTML or markdown file and need to publish it with `publish` so Rick can open it. Not for writing the page itself (see lab-pages-dashboards).
---

# Publishing pages and reports

(Moved word for word from AGENTS.md lines 173. These are still your rules; they just load on demand.)

- `publish <file.html|.md> [--title "Title"] [--slug slug]` turns a report or page into `/workspace/pages/<slug>/index.html` (Transovo style; inline Chart.js charts work) and prints the slug. Rick opens it at `https://transovo.ai/app/agent-lab/pages/<slug>` (all pages: `https://transovo.ai/app/agent-lab/pages`). Use it for reports, comparisons, research write-ups and dashboards; send Rick the link. Check the result with `browser-shot out.png --url <that link>` + `look` before saying it's done.
