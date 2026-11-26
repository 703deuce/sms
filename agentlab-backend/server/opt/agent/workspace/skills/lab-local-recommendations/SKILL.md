---
name: lab-local-recommendations
when_to_use: Use when recommending restaurants or local places, or listing local businesses (lead lists), with live links. Not for booking, one place's hours/menu (lab-site-lookups), or a trip plan (lab-travel-planning).
description: Recommend restaurants or local places by taste, budget, and occasion. Real live links, no booking.
---

# Restaurant and local recommendations

Recommend real places that match the requested **taste, budget, and occasion**. **Never** book a table, create an account, or join a waitlist.

## How to look up

- `search` for the area and constraints, then `readpage` or `fetch_fetch` on the restaurant or venue page (official site, a public menu, Google Maps, or a well-known listings page). Call `agent_load_browser` only if you must operate a JS-heavy page.
- Looking up **one** restaurant's hours or menu only is `lab-site-lookups`. A **full multi-day trip plan** is `lab-travel-planning`.
- Don't invent a restaurant, a price, or a URL. If a page is blocked or behind a login, say so and use another public source.

## What to report

For each recommendation: name, neighborhood or address, why it fits the taste / budget / occasion, price level or a typical price if shown, the **exact https URL** you read, the **time (ET)**, and the **HTTP status** of a live-link check. Confirm cited links are live (HTTP 2xx or 3xx).

Give **2–4** options when you can, with a one-line contrast (cheaper, more vegetarian, quieter, closer).

## Is it still open?
- Directories and old articles list closed places. For every business, confirm it is open now: its own site loads (not a parked or for-sale domain), a Google Maps listing without "Permanently closed", or reviews/posts from the last 6 months. Drop closed ones; never list one.
- Blocked or empty source: try at least 2 others (official site, Google Maps, Yelp, the state brewers/trade guild, local news).
- Closure check for EVERY business you keep: `search "<name> <city> closed"`. Drop it if news, Yelp, Untappd or BeerAdvocate says closed. An old site that still loads, Yellow Pages, Superpages or chamber listings do not prove it is open.
- A business whose own site is blocked (403, Cloudflare check) is not closed for that reason alone: get its details from Yelp, Google Maps, Untappd or the state guild, and still run the closure check.
- Asked for N: keep going until you have N verified. Do not stop to ask Rick for a route; use the other sources yourself first.

## Don't

- Don't reserve, call the restaurant, or use a booking tool.
- Don't treat this as product shopping (`lab-shopping-research`) or as package tracking.
