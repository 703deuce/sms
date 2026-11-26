# Public hotel prices

Do not book. Report nightly price, total with taxes if shown, cancellation if shown, rating/review count if shown, distance if relevant, and the URL.

Public search URLs (set city, dates, guests):

- `https://www.booking.com/searchresults.html?ss=CITY&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&group_adults=2&no_rooms=1`
- `https://www.expedia.com/Hotel-Search?destination=CITY&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&adults=2`

Google Hotels URLs are more fragile; prefer Booking or Expedia public search. Read prices from the page, not from a memory of last year's rates. Call `agent_load_browser` only if the results list is empty in a plain fetch.

