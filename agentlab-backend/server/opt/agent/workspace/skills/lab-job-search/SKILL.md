---
name: lab-job-search
when_to_use: Use when searching public job boards for openings and compiling real listing links. Never apply, and never create an account or submit a resume. Not for writing a resume or cover letter alone (see lab-writing-editing).
description: Search public job boards and collect live listing links. Do not apply.
---

# Job search (public boards, no applying)

Find currently posted jobs from **public** listing pages. **Never** apply, create an account, upload a resume, or message a recruiter.

## How to look up

- `search`, then `readpage` or `fetch_fetch` on the listing. Call `agent_load_browser` only if you must operate a JS-heavy board. `fetch_fetch` is enough to just read a URL.
- Prefer a **specific job posting URL** over a search-results snippet. If the snippet and the page disagree, the page wins.
- Public starting points (replace QUERY / location as needed) are listed in `boards.md` in this folder (`read_section` or `agent_skill_file`).
- Do not invent a job, a salary, or a URL. If a board requires a login to see the posting, say so and use another public board.

## What to report

For each job: title, company, location (or Remote), a short snippet from the page, the **exact https URL**, the **time (ET)** you read it, and the **HTTP status** of a live-link check (`curl -sI -L -o /dev/null -w '%{http_code}' URL` or equivalent). Don't cite a link that failed unless you say it failed and you tried an alternative.

## Blocked boards and counts
- Glassdoor sits behind a Cloudflare human check; don't spend time on it. Use at least 2 others: Greenhouse, Lever and Ashby boards, LinkedIn's guest job search, Indeed (works through the residential proxy), company careers pages.
- Asked for N openings: keep searching until N that meet every filter (salary, remote, level), or say how many you found and what you tried. Count your table before you write the summary; the numbers must match.

## Don't

- Don't apply, sign in, or submit a resume.
- Don't write a tailored application unless Rick asked for writing help (`lab-writing-editing` for a resume or letter, separate from applying).
