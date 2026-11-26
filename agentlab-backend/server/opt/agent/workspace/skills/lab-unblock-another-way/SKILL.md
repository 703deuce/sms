---
name: lab-unblock-another-way
when_to_use: Use when a requested tool, login, site, API, or method may be unavailable, blocked, or needs a workaround, or the task is to find another way. Not for ordinary work that already has a clear path.
description: Before giving up, try other public tools, pages, APIs, or installed CLIs.
---

# Find another way before you give up

If a tool, site, login, API key, or method is missing, blocked, or fails, do not tell Rick it cannot be done until you have tried other **public** routes. Do not invent a result, start a paid service, or ask for a password or API key unless he already offered one.

## Try in this order

1. Another **installed** tool or CLI. Check with `which` and, if this job needs a special binary, the installed-tools skill. Use what is already on the machine.
2. A **public page** or a documented **public API** that needs no account. `search`, then `readpage` or `fetch_fetch`. Cite the exact URL and the time (ET) you read it.
3. `agent_load_browser` **only** if you must operate a JS-heavy or blocked page. `fetch_fetch` is enough to just read a URL.
4. A library already in the job container, or a small script you run on public data in this job folder.

More patterns are in `routes.md` in this folder (`read_section` or `agent_skill_file`).


## Blocked websites (automatic)

`curl`, `readpage`, `fetch_fetch` and the job/shared browser already try a blocked site **directly first** (free). If the *response* is blocked (HTTP 403/429/451, a 503 challenge, a captcha/bot page, a connection reset, or a geo-block — decided from the status, headers, and page bytes, never from Rick's wording), they retry through the lab's DataImpulse **residential** proxy, then **mobile** if that plan is enabled. Report a site as blocked only when all attempted tiers failed, and list the tiers that were tried. Do not turn the proxy on yourself for a site that already loaded. Caps and usage: `egress-usage`.

## Not just the IP
Big retailers check the client: plain curl/fetch gets bot pages where the job browser (Google Chrome) passes. Use the browser for Walmart, Best Buy and Target; Best Buy goes out on the US residential tier automatically. Glassdoor (Cloudflare) and G2 (DataDome) still block automated browsers: use other sources, or ask Rick to open the page.

## When a step fails (any tool, API, file or install)
1. Diagnose: read the real error (status, traceback, exit code), not just "it failed".
2. Try at least 2 different approaches (another source or API, another library or version, another file parser, another install route), not the same call again.
3. Verify the one that worked on the real output (rerun it, open the file, recompute a total) before you deliver.
4. Report a gap only after that, naming each approach and why it failed.

## Report

Say what you tried, what blocked you (HTTP status, captcha, login wall, missing binary), the route that worked, and the source. If every honest public route fails, say so clearly and stop.
