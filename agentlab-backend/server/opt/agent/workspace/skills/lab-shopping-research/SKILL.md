---
name: lab-shopping-research
when_to_use: Use when comparing products or researching what to buy: real store URLs, current prices, and a live-link check. Never add to a cart or check out. Not for flights, hotels, restaurants, real estate, or package tracking.
description: Compare products with live URLs and prices. No purchases.
---

# Shopping and product research

Research only. **Never** add items to a cart, create an account, enter payment details, or place an order.

## How to look up

- Use `search` to find product pages, then `readpage` or `fetch_fetch` to read a URL. Call `agent_load_browser` only if you must operate the page (a JS-heavy store, a blocked fetch). `fetch_fetch` is enough to just read a URL.
- Compare the **same product** (or a clearly named close equivalent) on **2–3 stores**. Typical public search URLs:
  - `https://www.amazon.com/s?k=QUERY`
  - `https://www.bestbuy.com/site/searchpage.jsp?st=QUERY`
  - `https://www.walmart.com/search?q=QUERY`
  - `https://www.ebay.com/sch/i.html?_nkw=QUERY&LH_BIN=1`
- Prefer a specific product page over a search results snippet. If the snippet and the page disagree, the page wins.
- Optional price history: `https://camelcamelcamel.com/search?sq=QUERY` (Amazon). Say when the history is missing.

## What to report

For each option: product name (as the store writes it), **current price**, shipping/tax if shown, condition/seller if used, **the exact https URL you read**, and the **time you read it** (ET).
Compare **total cost** when shipping is shown; otherwise say the price is pre-shipping.
Note stock if the page says out of stock.

## Live-link check

For every URL you cite, check that it is live (`curl -sI -L -o /dev/null -w '%{http_code}' URL` or an equivalent fetch). Report the HTTP status. Don't cite a link that failed unless you say it failed and you tried an alternative.

## When a store blocks
- Open Walmart, Best Buy and Target in the job browser (`agent_load_browser`), not curl or fetch: their bot walls (PerimeterX, Akamai) reject plain HTTP clients. Load the store's homepage first, then the search, then the product page.
- Still blocked: try at least 2 other sources before you report a gap (the maker's own store, Amazon, Target, Costco, Newegg, B&H, or an RTINGS/PCMag price box). Name every source you tried.
- Asked for N options: give N with a live price each, or say how many you found and what blocked the rest.

## Don't

- Don't buy, check out, or "hold" an item.
- Don't invent a price or a URL. If a store is blocked or shows a captcha, say so and use another source.
- Don't use this skill for flights, hotels, restaurants, real estate, or parcel tracking (`lab-site-lookups`).

## Browser on store sites
Open one page at a time in the job browser (parallel browser_navigate calls abort each other). Best Buy product pages do load there; if one errors, open it again once before calling it blocked. Prefer the browser over curl for Walmart, Best Buy and Target.
