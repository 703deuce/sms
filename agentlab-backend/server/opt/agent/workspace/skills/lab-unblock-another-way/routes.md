# Alternative routes (public, no new accounts)

- **Read a URL:** `fetch_fetch` or `readpage`. Load the browser only when the page must be operated or the fetch is blocked.
- **Search:** `search` to find pages, then read the page. Don't trust snippets for facts that matter.
- **Public APIs:** documented HTTP APIs that do not require a key, or that work with no auth for the fact you need. No new paid APIs.
- **Installed CLIs:** `curl`, `python3`, `git`, `pdftotext`, and anything `which` finds. Do not run `gh` auth login; use `gh` only if it is already authenticated.
- **Container libraries:** python-docx, openpyxl, python-pptx, pandas, matplotlib, pypdf may already be present. Don't invent a dependency that isn't there without installing it in the job if that's allowed.
- **Login walls:** if the fact is behind a sign-in, stop or use a different public source. Do not start a sign-in handoff unless Rick asked to sign in.

- **Blocked site / bot page:** do not give up after a direct 403 or captcha. `curl`, `readpage` and `fetch_fetch` automatically retry via the lab egress gateway (residential, then mobile if enabled). Say which tiers were tried. `egress-usage` shows paid proxy megabytes. Never ask for a new paid proxy and never paste credentials.
