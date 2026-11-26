import csv, sys
from datetime import date
def main(bp, lp, op):
    bank=list(csv.DictReader(open(bp))); led=list(csv.DictReader(open(lp)))
    idx={}
    for i,l in enumerate(led):
        idx.setdefault((l["amount_cents"],l["currency"],date.fromisoformat(l["date"]).toordinal()),[]).append(i)
    used=bytearray(len(led)); out=[]
    for b in bank:
        bd=date.fromisoformat(b["date"]).toordinal(); a=b["amount_cents"]; c=b["currency"]; ref=b["reference"]
        cands=[]
        for o in range(bd-3,bd+4):
            for i in idx.get((a,c,o),()):
                if not used[i]: cands.append((i,abs(o-bd)))
        if ref:
            r=[x for x in cands if led[x[0]]["reference"]==ref]
            if r: cands=r
        if cands:
            best=min(cands,key=lambda x:(x[1],x[0])); used[best[0]]=1
            out.append((b["bank_id"],led[best[0]]["ledger_id"],str(best[1])))
        else: out.append((b["bank_id"],"UNMATCHED",""))
    with open(op,"w",newline="") as f:
        w=csv.writer(f); w.writerow(["bank_id","ledger_id","days_apart"]); w.writerows(out)
main(*sys.argv[1:4])
