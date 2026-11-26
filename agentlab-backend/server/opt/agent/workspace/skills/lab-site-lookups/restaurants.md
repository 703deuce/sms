# Public restaurant hours and menus

Do not make a reservation (no OpenTable/Resy booking, no account).

Find the restaurant's **official site** or a public listings page (Google Maps / the city's own site). Read **hours, address, phone, and a menu URL** if it is public. Cite the URL and time.

A Google Maps place or search URL is fine: `https://www.google.com/maps/search/QUERY+near+PLACE`. Hours and ratings are in the place panel text when the fetch includes them.

If the only menu is an image, screenshot after `agent_load_browser` (or `readpage` if it already has the text) and read it with `agent_view` / `look`. Don't invent dish names or prices.

