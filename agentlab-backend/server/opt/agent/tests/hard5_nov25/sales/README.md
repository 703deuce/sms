# Sales export (H1 2026)

Files: customers.csv, orders.jsonl, returns.csv, fx_rates.csv. Rules from finance:

1. Customers: the same person can appear more than once with a different customer_id. Treat rows whose email matches after trimming spaces and lower-casing as one customer; the canonical id is the one with the LOWEST numeric customer_id. Region names should be normalised to North/South/East/West.
2. Orders: orders.jsonl may repeat the same order line; count each order_id once. Dates come in several formats; slash dates are US month/day/year. Amounts are in the order's own currency (USD, EUR or GBP; EUR amounts use a comma decimal separator).
3. Ignore orders whose note says it is a test order. Ignore cancelled orders. refunded_partial orders count, minus their refund in returns.csv (refund is in the order's currency).
4. Convert to USD with fx_rates.csv using the order's calendar month.
5. Data-entry errors: some USD orders were keyed in cents (100x too big). The finance rule is: any single order over USD 5,000 is a cents error; divide it by 100.
6. Net revenue = converted amount minus converted refund, rounded to cents only at the end.
