import struct, random, datetime as dt, json, os, base64, subprocess, csv, shutil
def write_dbf(path, fields, recs):
    # fields: (name,type,len,dec); recs: list of (deleted, dict)
    n=len(recs); hl=32+32*len(fields)+1; rl=1+sum(f[2] for f in fields)
    today=dt.date(2026,10,3)
    with open(path,'wb') as f:
        f.write(struct.pack('<BBBBIHH20x',0x03,today.year-1900,today.month,today.day,n,hl,rl))
        for name,t,l,d in fields:
            f.write(struct.pack('<11sc4xBB14x',name.encode('ascii'),t.encode(),l,d))
        f.write(b'\r')
        for dele,r in recs:
            f.write(b'*' if dele else b' ')
            for name,t,l,d in fields:
                v=r[name]
                if t=='C': b=str(v).encode('cp1252').ljust(l)[:l]
                elif t=='N': b=(f"{v:.{d}f}" if d else str(int(v))).rjust(l).encode()
                elif t=='L': b=b'T' if v else b'F'
                elif t=='D': b=v.strftime('%Y%m%d').encode()
                f.write(b)
        f.write(b'\x1a')
words=['Café Table','Crème Lamp','Naïve Stool','Desk Organizer','Jalapeño Mug','Résumé Folder','Smörgås Tray','Piñata Kit','Office Chair','Monitor Arm','Cable Box','Façade Shelf']
FIELDS=[('SKU','C',10,0),('DESCR','C',30,0),('QTY','N',6,0),('PRICE','N',10,2),('ACTIVE','L',1,0),('UPDATED','D',8,0)]
def make(seed, n, path):
    random.seed(seed); recs=[]
    for i in range(n):
        r=dict(SKU=f"NW-{seed%100:02d}{i:04d}",DESCR=random.choice(words)+f" #{i}",QTY=random.randint(0,400),PRICE=round(random.uniform(2,350),2),ACTIVE=random.random()<.85,UPDATED=dt.date(2026,random.randint(1,9),random.randint(1,28)))
        recs.append((random.random()<.06, r))
    write_dbf(path, FIELDS, recs)
    keep=[r for d,r in recs if not d and r['ACTIVE']]
    return dict(records_in_file=n, deleted=sum(1 for d,_ in recs if d), active_kept=len(keep), total_qty=sum(r['QTY'] for r in keep),
                inventory_value=round(sum(r['QTY']*r['PRICE'] for r in keep),2), skus=sorted(r['SKU'] for r in keep),
                sample={r['SKU']:r['DESCR'] for r in keep[:5]})
truth={}
for tag,seed,n,pw,fname in [('drop1',41,230,'Northwind-2026!','inventory_2026Q3'),('drop2',77,175,'Tailspin#Q4x9','tailspin_stock_q4')]:
    d=f'vendor/{tag}'; shutil.rmtree(d,ignore_errors=True); os.makedirs(d)
    dbf=f'/tmp/{fname}.dbf'
    if os.path.exists(dbf): os.remove(dbf)
    truth[tag]=make(seed,n,dbf)
    z=f'{d}/{fname}.zip'
    subprocess.run(['7z','a','-tzip','-mem=AES256',f'-p{pw}',z,dbf],check=True,capture_output=True)
    b=base64.b64encode(pw.encode()).decode()
    open(f'{d}/handoff.eml','w').write(f"""From: Data Desk <data@{'northwind' if tag=='drop1' else 'tailspin'}-vendor.example>
To: ops@lab.example
Subject: {fname} stock export
Date: Fri, 03 Oct 2026 09:12:00 -0400
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Hi team,

Attached is this quarter's stock export ({fname}.zip). It's the same legacy format our warehouse system has always produced.
For security the archive password is sent encoded; decode this (it's standard base64):

    {b}

Records flagged deleted in the file are not real stock. Only rows marked active count.

Thanks,
Data Desk
""")
json.dump(truth,open('vendor_truth.json','w'),indent=1)
print({k:{kk:vv for kk,vv in v.items() if kk not in('skus','sample')} for k,v in truth.items()})
