---
name: lab-deep-research
when_to_use: Use for research that needs many sources: lead or company lists of N items, market or competitor scans, fact-finding with cross-checks. Not for one quick lookup, product price checks or public fare/hotel pages.
description: Deep research: fan out searches, rank and dedupe sources, cross-check facts, track coverage to the requested count.
gate_cmd: research-coverage check
---

# Deep research

The job is done only when the ask is met (every requested item, each meeting every criterion, key facts confirmed by 2+ independent sources) or the gap is honestly explained. A goal check and the `research-coverage check` gate read your ledger before your reply is accepted.

## Workflow
1. **Pin the target.** `research-coverage init --target <N or leave out> --criterion "..."` for each condition Rick gave (open now, in NC, has a website...). No count asked: track the questions you must answer as items instead.
2. **Fan out.** Write 8-20 varied queries to `research/queries.txt` (synonyms, sub-regions, directories and "list of" pages, official registries, news, review sites) and run `research-fanout --queries research/queries.txt --fetch 15`. It searches in parallel, dedupes, ranks by how many queries found each source, and saves page text to `research/sources/`.
3. **Extract, don't re-read.** Pull candidate items from the saved pages with one `run-script` (labtools) pass; read only the pages you need.
4. **Cross-check and record.** For each item: `research-coverage add "Name" --source URL1 --source URL2 --fact "city=Durham"`. Two different domains per item (the item's own site counts as one). Something failing a criterion (closed, wrong area, duplicate): `research-coverage reject "Name" --why "closed per <url>"`. A blocked site is not evidence either way.
5. **Short? Widen, don't settle.** `research-coverage status`. Below target, or items with one source: run a second `research-fanout` with NEW queries (other neighborhoods, other source types, directories, maps listings via readpage). Repeat at least twice before deciding the target cannot be met.
6. **Honest gap.** Only after 2+ more different routes: `research-coverage gap "found 21 of 25 open breweries; tried X, Y, Z; the rest are closed or unverifiable"` and say the same plainly in your reply.
7. **Deliver.** Write the file (CSV/XLSX/page) from the ledger, with a source column. `research-coverage check` must pass (or a gap is recorded). In the reply: the count vs target, how facts were verified, and any gap.

## Rules
- Never fill a gap with a guessed item, a made-up URL or an unverified fact.
- Prefer primary sources (official site, registry, government data) over aggregators; aggregators are fine as the second source.
- Big fan-outs can go to helpers (one area or source type each) that return items with URLs; merge them into one ledger yourself.
