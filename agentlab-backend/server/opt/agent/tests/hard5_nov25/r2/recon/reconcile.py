#!/usr/bin/env python3
"""Match bank transactions to ledger entries.

usage: python reconcile.py BANK.csv LEDGER.csv OUT.csv

Rules (finance-approved; the output of this script is the reference):
- Process bank rows in file order.
- A bank row can match an unmatched ledger row with the same amount_cents and
  the same currency whose date is within 3 days (either side) of the bank date.
- If the bank row has a reference (e.g. INV-12345) and some candidate ledger row has
  the same reference, only those candidates are considered.
- Among the candidates, pick the smallest absolute date difference; ties go to the
  ledger row that appears first in the ledger file.
- Each ledger row can be matched at most once.
- Output: bank_id,ledger_id,days_apart  (ledger_id UNMATCHED and days_apart blank if none)
"""
import csv, sys
from datetime import date

def d(s):
    y, m, dd = map(int, s.split("-"))
    return date(y, m, dd)

def main(bank_p, led_p, out_p):
    bank = list(csv.DictReader(open(bank_p)))
    led = list(csv.DictReader(open(led_p)))
    used = [False] * len(led)
    out = []
    for b in bank:
        bd = d(b["date"])
        cands = []
        for i, l in enumerate(led):
            if used[i]:
                continue
            if l["amount_cents"] != b["amount_cents"] or l["currency"] != b["currency"]:
                continue
            diff = abs((d(l["date"]) - bd).days)
            if diff <= 3:
                cands.append((i, diff))
        if b["reference"]:
            ref = [c for c in cands if led[c[0]]["reference"] == b["reference"]]
            if ref:
                cands = ref
        if cands:
            best = min(cands, key=lambda c: (c[1], c[0]))
            used[best[0]] = True
            out.append((b["bank_id"], led[best[0]]["ledger_id"], str(best[1])))
        else:
            out.append((b["bank_id"], "UNMATCHED", ""))
    with open(out_p, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["bank_id", "ledger_id", "days_apart"])
        w.writerows(out)

if __name__ == "__main__":
    main(*sys.argv[1:4])
