---
name: lab-orders-subscriptions
when_to_use: Use when tracking a shipment, or checking price and renewal terms of a subscription Rick has or plans to start. Not for competitor or market research, vendor price comparisons, shopping, or bookings.
description: Track a package or read a service's public price and renewal terms. No logins.
---

# Order tracking and public subscription checks

Use **public** carrier pages and public pricing/terms pages. **No logins**, no account dashboards, no purchases, and no cancellations you were not asked to start (you can't complete those without a login anyway).

## Shipment tracking

- If Rick has a tracking number, open the **official** carrier tracking URL (USPS, UPS, FedEx, or the carrier he named) and enter or append the number only on that official page. Cite the URL, the time (ET), and what the public page shows (status, location if shown, scheduled delivery if shown).
- If you only need the official tracking **page URL** (no number), that lookup is `lab-site-lookups`. This skill is for a **specific shipment** or for **subscription price and renewal terms**.
- Official URL patterns are in `public-pages.md` in this folder (`read_section` or `agent_skill_file`).
- Never invent a scan event. If the number is invalid or the page is blocked, say so.

## Subscription price and renewal

- Read the service's **public** pricing and help/terms pages (plan price, billing period, and what they say about renewal or cancellation).
- Cite the exact URLs, the time (ET), the price as the page states it (currency and period), and a short quote or paraphrase of the renewal/cancellation terms.
- If the current price is behind a login, say so and stop or use a different public page. Do not sign in.

## Live-link check

For every URL you cite, measure HTTP status (`curl -sI -L` or equivalent). Don't cite a failed link unless you say it failed and you tried an alternative.
