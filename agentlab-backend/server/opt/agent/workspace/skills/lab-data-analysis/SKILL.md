---
name: lab-data-analysis
when_to_use: Use when analyzing a dataset (CSV, spreadsheet, or table): clean it, compute summaries or trends, and report findings. Not for an HTML dashboard, a slide deck, or a spreadsheet with no analysis question.
description: Analyze tabular data, clean it, and report verified findings.
---

# Data analysis

Start from the file Rick named. Don't use the live web unless he asked you to fetch more data.

## Clean and compute

- Look at the header, a few rows, types, and obvious bad values (`n/a`, blanks, swapped columns) before you compute.
- Apply the cleaning rules in the request (for example: drop unparseable dates, drop non-numeric qty/price, interpret dates a certain way). If a rule is missing, pick a reasonable one, apply it consistently, and say it in the report.
- Use Python `pandas` (installed). Write a short script in the job folder so the work is repeatable; run it; don't only "think" the totals.
- Keep an audit of how many rows you started with and how many you dropped (and why).

## Report

- Answer the question first (the top region, the trend, the total).
- Then the method (filters, date parsing, the exact aggregation).
- Write requested files (`out/analysis.md`, a CSV of the aggregates, a PNG chart if asked). A workbook with formulas or a dashboard is a different skill (`lab-documents-spreadsheets` or `lab-pages-dashboards`) — use those only if the request also wants that artifact.

## Checks

- Recompute the headline number in the script (or a second path) and make sure it matches the file you wrote.
- If an expected fixture exists, compare to it. Otherwise spot-check one group by hand from the cleaned rows.
- Describe results as measured numbers, not as "looks right."

## When the numbers are hard: `sonnet-assist --mode math` (rare)

Use only for a multi-step calculation (including finance) where your own answer is uncertain or two checks disagree. Not for ordinary sums or a pandas groupby you can re-run.

  sonnet-assist --mode math --goal "<the problem>" --file data.csv:1-40

Send only the problem and the relevant data. It returns `ANSWER:` plus brief `STEPS:`. Recompute or spot-check the result yourself before you rely on it. It is a one-shot call, not a model switch.
