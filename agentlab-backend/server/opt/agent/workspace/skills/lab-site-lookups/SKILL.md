---
name: lab-site-lookups
when_to_use: Use when looking up public flight fares, hotel prices, restaurant hours or menus, real-estate listings, or package tracking from public pages (no account). Never book. Not for product shopping.
description: Public lookups for flights, hotels, restaurants, real estate, and package tracking. No accounts, no booking.
---

# Site lookups (public pages, no account)

Look up facts from **public** pages or documented public APIs. Do not create accounts, sign in, or book/purchase. If a site demands a login for the fact you need, say so and stop or use a different public source.

## How to fetch

- Start with `search`, then `readpage` or `fetch_fetch`. Call `agent_load_browser` **only** if you must operate a page (a JS-heavy fare calendar, a blocked fetch). `fetch_fetch` is enough to just read a URL.
- Cite the **exact URL** you read and the **time (ET)**. Don't invent fares, hours, or listing prices.
- Keep pages few. If a consent banner or captcha blocks you, accept a simple cookie notice; otherwise try another public source or say you were blocked.
- Never complete a booking, reservation, or checkout flow.

## Which reference to open

Open only the file that matches the task (`read_section` or `agent_skill_file`), in this folder:

- `flights.md` — public fare search (Google Flights and similar)
- `hotels.md` — public hotel search (Booking, Expedia, Google Hotels)
- `restaurants.md` — hours, address, public menus (no reservations)
- `real-estate.md` — public listing pages (Zillow, Realtor, Redfin): look, don't contact an agent
- `tracking.md` — official USPS, UPS, FedEx tracking pages

Maps and generic place hours can use Google Maps public pages; still cite the URL. Product *shopping* is `lab-shopping-research`, not this skill. A full multi-day trip plan is `lab-travel-planning` (it may point you back here for a fare).

## When a site blocks
Try at least 2 other public sources before you report a gap, and name them (for example schools: GreatSchools, NCES, the state report card; homes: Zillow, Redfin, Realtor.com; hotels: the hotel's own site, Booking, Google Hotels). For a business, confirm it is still open.
