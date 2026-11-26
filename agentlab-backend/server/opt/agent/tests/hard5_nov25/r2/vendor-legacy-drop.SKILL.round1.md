---
name: vendor-legacy-drop
when_to_use: Use when a vendor stock drop is an AES-encrypted zip (7z works, unzip fails) with a base64 password in handoff.eml, or a dBASE .dbf stock export must be filtered and summarised. Not for xlsx/csv or plain zips.
description: Unpack encrypted vendor zips with 7z and convert dBASE .dbf stock exports to CSV and summary JSON
---
# Vendor legacy stock drop

## 1. Unpack the encrypted zip
- System `unzip` fails on AES (method 99). Use 7z: `7z x -y -p PASSWORD -oDEST ZIP`.
- The password is in the drop's `handoff.eml` as base64. Decode that line yourself with `base64 -d` (or Python `base64.b64decode`) and pass it to 7z. Never copy the decoded password into notes, skills or replies.

## 2. Read the .dbf without a library
- No DBF package is installed. `vendor_drop.py` (below) has a pure-Python dBASE III reader (header at byte 8/10 for record count/length, field descriptors from byte 32 until 0x0D, record byte 0 `*` = deleted, cp1252 text).
- Fields seen so far: SKU C10, DESCR C30 (accents), QTY N6, PRICE N10.2, ACTIVE L (T/F), UPDATED D (YYYYMMDD).

## 3. Business rule (vendor handoff)
- Records flagged deleted are not real stock. Keep only rows with ACTIVE = T.
- `summary.json`: records_in_file (all rows), deleted (flag count), active_kept, total_qty, inventory_value (sum qty*price over kept, 2 dp).

## 4. Run
    python3 vendor_drop.py DBF OUT.csv OUT.json

## 5. Verify with a second method
- Count deleted flags from raw byte 0 of each record and compare with `deleted`.
- Recompute kept rows, qty and value from the CSV and compare with the JSON.

## Script: vendor_drop.py
import csv
import json
import struct
import sys
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP


def read_dbf(path, encoding="cp1252"):
    data = open(path, "rb").read()
    nrec = struct.unpack("<I", data[4:8])[0]
    hlen = struct.unpack("<H", data[8:10])[0]
    rlen = struct.unpack("<H", data[10:12])[0]
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos:pos + 11].split(b"\0")[0].decode("ascii")
        fields.append((name, chr(data[pos + 11]), data[pos + 16]))
        pos += 32
    rows = []
    for i in range(nrec):
        rec = data[hlen + i * rlen: hlen + (i + 1) * rlen]
        row = {"_deleted": rec[0:1] == b"*"}
        off = 1
        for name, _ftype, flen in fields:
            row[name] = rec[off:off + flen].decode(encoding, errors="replace").strip()
            off += flen
        rows.append(row)
    return rows


def main(dbf_path, csv_path, json_path):
    rows = read_dbf(dbf_path)
    kept = [r for r in rows if not r["_deleted"] and r["ACTIVE"] == "T"]
    deleted = sum(r["_deleted"] for r in rows)
    total = Decimal(0)
    value = Decimal(0)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["sku", "description", "qty", "price", "updated"])
        for r in kept:
            qty = int(r["QTY"])
            price = Decimal(r["PRICE"])
            updated = datetime.strptime(r["UPDATED"], "%Y%m%d").strftime("%Y-%m-%d")
            w.writerow([r["SKU"], r["DESCR"], qty, f"{price:.2f}", updated])
            total += qty
            value += qty * price
    summary = {
        "records_in_file": len(rows),
        "deleted": deleted,
        "active_kept": len(kept),
        "total_qty": int(total),
        "inventory_value": str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
        f.write("\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main(*sys.argv[1:4])
