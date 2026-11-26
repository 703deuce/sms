---
name: lab-travel-planning
when_to_use: Use when planning a trip or itinerary (a weekend, a multi-day or multi-city plan, logistics for a visit). Not for a single flight or hotel fare lookup alone (see lab-site-lookups), and never for booking.
description: Plan trips and itineraries from sourced public facts. No booking.
---

# Travel and trip planning

Build a practical plan Rick can follow. **Do not book** flights, hotels, or restaurants.

## What to produce

- A day-by-day itinerary (or a clear legs-and-days structure for a multi-city trip): morning / afternoon / evening when it helps.
- Logistics in one place: dates, party size, neighborhoods or a base area, how to get between stops, and rough timing.
- For each recommended place (and any fare or rate you mention): a **https URL you actually opened** and the time you read it. Don't invent hours, prices, or "must see" claims.
- Note closures, reservations that would be required, and walking vs transit when it matters.
- A short "you still need to book" list rather than pretending it's reserved.

## How to research

- Use `search`, then `readpage` or `fetch_fetch`. Call `agent_load_browser` only to operate a page.
- For a **single** fare, hotel rate, restaurant hour, or listing, follow `lab-site-lookups` (and its reference file for that domain). For a full plan, you may still open that skill for those facts.
- Prefer official or primary pages (venue, transit agency, parks service, the hotel or carrier) over blogs when they disagree.
- Keep the plan doable: don't stack three ends-of-the-city "musts" in one morning without travel time.

## Checks

- The deliverable file (usually `out/itinerary.md`) has every day asked for, party size and dates as given, and at least the requested number of sourced places with live URLs (HTTP 2xx/3xx, or you say a link failed and you replaced it).
- No booking confirmation numbers, because you did not book.

