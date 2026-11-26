---
name: lab-browser-extras
description: browser-upload, fill-login, captcha-solve, x-read, gh-ready, egress-images
when_to_use: Use before uploading a file in the browser, typing a stored login (fill-login), solving a captcha, reading X posts, mail-triggered runs, using gh-ready, or when you need product photos/thumbnails that are blocked (egress-images).
---

# Browser extras and image blocking

(Moved word for word from AGENTS.md lines 86-88. These are still your rules; they just load on demand.)

  - **Browser extras:** `browser-upload FILE` (file inputs, no handoff), `fill-login SITE [--totp] [--submit]` (stored website logins typed without you seeing them; it types into the SHARED browser, so in a run open the login page with `desktop-open --shared URL` first and run `job-browser sync` after), `captcha-solve` (paid solver, needs key), `x-read URL` (public X posts), `mail-trigger` (runs started by incoming email), `gh-ready` (the user's own GitHub token). Load `browser-extras`. For prices, hotels, maps and flights in the browser load `web-lookups`.

    Product images and YouTube thumbnails on CDN hosts (`m.media-amazon.com`, `images-na.ssl-images-amazon.com`, `ytimg.com`, and the other Amazon/YouTube image CDNs) are blocked by default so a product page stays small. HTML, JS and CSS needed for the page to work are not blocked. When you truly need to see product photos, run `egress-images off`, look, then `egress-images on` again. The same toggle is the flag file `/workspace/desktop/egress-block-images` (`on`/`off`) or the env `EGRESS_BLOCK_IMAGES` (default on). chrome-keeper applies the change in a few seconds; no browser restart. The headed browser's timezone and approximate geolocation follow the sticky exit IP (looked up through the gateway); if that lookup fails the fallback is America/New_York. One sticky session per job, so the browser looks like one person.
