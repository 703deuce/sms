# Public flight fares

Do not book. Report airline, times, stops, a price if shown, and the URL.

Start with Google Flights, which needs no account for search:

`https://www.google.com/travel/flights?q=Flights%20from%20JFK%20to%20LAX%20on%202026-12-20%20returning%202026-12-27`

Replace airports and dates. Read the cheapest/best lists from the page text. If dates are flexible, open the price graph or date grid on that same page when it is visible.

If Google Flights is blocked, try the airline's public search page or another public aggregator, and say which one you used. Call `agent_load_browser` only if the fare table does not appear in `readpage`/`fetch_fetch`.

