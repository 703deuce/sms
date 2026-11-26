# AgentLab customer-style round 2 (custfix_nov25), Haiku only, graded Wed Nov 25, 2026 ~4:05 PM ET
Quick grade from the delivered files and replies. X1/X2/X6 numbers were checked against the truth files. Live fact checks were limited because of the wrap-up order.

| Job | Mirrors (source) | Grade | Notes / recovery |
|---|---|---|---|
| RM2 Lisbon trip page (retest M2) | Manus trip planning, manus.im/usecase-official-collection | PARTIAL | Phone-friendly HTML delivered, 8 hotels and 11 restaurants. Hotel prices not quoted; links go to a Booking.com search with the dates filled in, honestly labelled. Router picks=[] ("bad JSON" bug), so it ran without skills. Router now FIXED. |
| RM3 Portland brewery leads (retest M3), first run | Manus lead list | FAIL | 12 rows, not 25. 4 closed breweries listed (Commons, Culmination, Burnside, Cascade Barrel House). |
| RM3 rerun after the skill fix | same | PARTIAL | 19 rows, not 25. All 4 closed breweries now dropped (the closure check works). Rows were not spot-checked. Still short of the count. |
| RM4 robot vacuum | Manus product comparison | PARTIAL/PASS | 5 models with Walmart prices and times, one clear pick (Roborock Q7 M5, $199.99). Flagged its own Shark RV2300S price conflict. Live prices not rechecked. |
| RC1 contractor email (retest C1) | ChatGPT writing | PASS | Every fact kept, ~118 words, flagged 2 wording points. |
| RC5 debug utils (retest C5) | ChatGPT code explain | PASS | All 4 bugs explained; fixed_utils.py delivered. |
| RK3 tabulate 3 issues (retest K3) | Claude Code bug fixing | PASS | 345 passed, 44 skipped (was 339); 6 new tests fail before the fix and pass after; patch exported to out/ and out/code. |
| Q1 nested helper wait (helper-wait) | platform | PASS (plumbing) | Got 1729, no freeze. It ran the child directly rather than as a "nested test" job, and said so. |
| N1 TV <= $600, Best Buy/Walmart (browser) | Manus/ChatGPT agent comparison | PARTIAL (both runs) | Walmart product pages verified (HTTP 200, live prices). Best Buy prices came only from search pages; product pages were not verified (ERR_HTTP2 open item). Run 1 verified 3 of 4. |
| N2 Walmart vs Target groceries (browser), 2 runs | ChatGPT agent "buy ingredients" | FAIL (honest) | Walmart prices read, some without product URLs. Target blocked by PerimeterX "Press & hold". It did not guess Target prices or name a cheaper store. Run 1 also hit the browser tool race (fixed). |
| X1 merge 3 messy sales exports to xlsx | Manus store analysis | PASS | 135 orders (duplicate and TOTAL row dropped); net by month 8648.95 / 10522.85 / 11239.55 = 30411.35, exact; 28 SUMIFS formulas. Recovery: handled latin-1, semicolons and decimal commas, xlsx title rows. |
| X2 overdue invoices + reminders | Duet AR chasing (claude.com/product/claude-duet) | PASS | 9 invoices, $8,120.50, exact; partial payments credited; one reminder per customer; nothing sent. |
| X3 fix FX script + schedule Mon 8am | ChatGPT scheduled tasks / Duet | PASS (minor) | Dead API diagnosed and swapped to open.er-api.com; 12 rows; routine rt_13e93ea799 (Mon 8:00 AM ET) created, now paused. It patched a copy, not the read-only original, and said so. USD values not rechecked against ECB. |
| X4 fleetstats dependency upgrade | Claude Code "fix failing test" | PASS | Unpinned to numpy>=1.26 / pandas>=2.1; fixed np.float and DataFrame.append; 3 tests pass; checked empty input and NaN behaviour; patch delivered. |
| X5 OECD API is gone | Manus/ChatGPT data analysis | PASS (values unchecked) | Noticed stats.oecd.org redirects with no data and switched source; PNG and CSV delivered. A 429 "Conversation run limit reached" appeared at start but was retried. Values not checked against OECD. |
| X6 ridership dashboard | Manus file-to-dashboard | PASS | 398,074 / Route 4 88,336 / 3,064 late, exact; footers dropped; browser-tested the filter. |

Tally (16 graded slots): PASS 9 (RC1, RC5, RK3, Q1, X1, X2, X3, X4, X6), PASS-ish 2 (RM4, X5), PARTIAL 3 (RM2, RM3 rerun, N1), FAIL 2 (RM3 first run, N2).
Spend: about $0.45 for the 17 batch runs in metrics.json, plus about $0.08 for the N1 and RM3 reruns and $0.001 for the router checks. The whole round is well under the $2.50 cap.

## Open items
1. Best Buy product pages: search pages load; product pages give ERR_HTTP2_PROTOCOL_ERROR only in the job browser (MCP + keeper). A direct patchright test from the same server loads them, so it is NOT the IP. Working changes stay in place with rollback (Google Chrome stable, flags, intl_splash cookie, navigate auto-retry, patchright MCP).
2. Target: PerimeterX press-and-hold challenge on the job browser. Not solved.
3. RM3: count shortfall (19 of 25). The closure check works but it stops short. Next fix: require it to keep sourcing until it has N verified rows, or to explain the shortfall clearly.
4. Q1: the worker refused "job start" inside a helper because its instructions say not to start jobs. Consider allowing a named nested job when the user explicitly asks for one.
5. Four duplicate active "Send Rick's weekly Agent Lab status" reminders (rm_c498…, rm_ce52…, rm_f2f8…, rm_8d74… for Thu Nov 26 9:00 AM EST). Left untouched; they look like duplicates from an earlier round and should be checked.
