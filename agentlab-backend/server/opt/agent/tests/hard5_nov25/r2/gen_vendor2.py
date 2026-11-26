import struct, random, datetime as dt, json, os, base64, subprocess, shutil
words=['Café Table','Crème Lamp','Naïve Stool','Desk Organizer','Jalapeño Mug','Résumé Folder','Smörgås Tray','Piñata Kit','Office Chair','Monitor Arm','Façade Shelf','Ångström Clock']
def hdr(f,n,hl,rl,ver=0x03):
    f.write(struct.pack('<BBBBIHH20x',ver,126,10,3,n,hl,rl))
def write(path, fields, recs, enc='cp1252', nrec_override=None, eof=True, ver=0x03, memo=None):
    hl=32+32*len(fields)+1; rl=1+sum(x[2] for x in fields)
    with open(path,'wb') as f:
        hdr(f, len(recs) if nrec_override is None else nrec_override, hl, rl, ver)
        for name,t,l,d in fields: f.write(struct.pack('<11sc4xBB14x',name.encode(),t.encode(),l,d))
        f.write(b'\r')
        for dele,r in recs:
            f.write(b'*' if dele else b' ')
            for name,t,l,d in fields:
                v=r[name]
                if t=='C': b=str(v).encode(enc).ljust(l)[:l]
                elif t=='N': b=(f"{v:.{d}f}" if d else str(int(v))).rjust(l).encode()
                elif t=='L': b=b'T' if v else b'F'
                elif t=='D': b=v.strftime('%Y%m%d').encode()
                elif t=='M': b=(str(v).rjust(l) if v else ' '*l).encode()
                f.write(b)
        if eof: f.write(b'\x1a')
def memo_file(path, texts):
    # dBase III .dbt: 512-byte blocks; block 0 header with next free block; each memo ends with 0x1A 0x1A
    blocks=[]; nb=1; out=bytearray(512); ptr={}
    for k,t in texts.items():
        data=t.encode('cp1252')+b'\x1a\x1a'
        n=(len(data)+511)//512; ptr[k]=nb
        out+=data.ljust(n*512,b'\x00'); nb+=n
    out[0:4]=struct.pack('<I',nb)
    open(path,'wb').write(out); return ptr
def pack(tag, files, pw, zipname, eml_extra, domain):
    d=f'vendor/{tag}'; shutil.rmtree(d,ignore_errors=True); os.makedirs(d)
    subprocess.run(['7z','a','-tzip','-mem=AES256',f'-p{pw}',f'{d}/{zipname}.zip']+files,check=True,capture_output=True)
    for f in files: os.remove(f)
    b=base64.b64encode(pw.encode()).decode()
    open(f'{d}/handoff.eml','w').write(f"""From: Data Desk <data@{domain}.example>
To: ops@lab.example
Subject: {zipname} stock export
Date: Mon, 10 Nov 2026 10:02:00 -0500
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Hi team,

Attached is {zipname}.zip. Archive password (base64, as usual):

    {b}

{eml_extra}
Records flagged deleted are not real stock.

Thanks,
Data Desk
""")
truth={}
FIELDS=[('SKU','C',10,0),('DESCR','C',30,0),('QTY','N',6,0),('PRICE','N',10,2),('ACTIVE','L',1,0),('UPDATED','D',8,0)]
def rec(seed,i):
    return dict(SKU=f"NW-{seed:02d}{i:04d}",DESCR=random.choice(words)+f" #{i}",QTY=random.randint(0,400),PRICE=round(random.uniform(2,350),2),ACTIVE=random.random()<.85,UPDATED=dt.date(2026,random.randint(1,10),random.randint(1,28)))
def summ(recs,qty='QTY',price='PRICE',act=lambda r:r['ACTIVE'],sku='SKU',desc='DESCR'):
    keep=[r for d,r in recs if not d and act(r)]
    return dict(records_in_file=len(recs),deleted=sum(1 for d,_ in recs if d),active_kept=len(keep),total_qty=sum(r[qty] for r in keep),inventory_value=round(sum(r[qty]*r[price] for r in keep),2),skus=sorted(r[sku] for r in keep),sample={r[sku]:r[desc] for r in keep[:6]})
# drop3: memo field
random.seed(303); recs=[]; memos={}
F3=FIELDS+[('NOTES','M',10,0)]
for i in range(160):
    r=rec(33,i); r['NOTES']=''
    if random.random()<.4:
        t=random.choice(['Fragile – handle with care.','Back-ordered until Q1; supplier “Müller GmbH”.','Discontinued after this run.','Seasonal item. ' * random.randint(1,60)])
        memos[r['SKU']]=t.strip()
    recs.append((random.random()<.06,r))
ptr=memo_file('/tmp/stock_q4_memo.dbt',memos)
for d,r in recs:
    if r['SKU'] in memos: r['NOTES']=str(ptr[r['SKU']])
write('/tmp/stock_q4_memo.dbf',F3,recs,ver=0x83)
t=summ(recs); t['notes']={s:memos[s] for s in t['skus'] if s in memos}; truth['drop3']=t
pack('drop3',['/tmp/stock_q4_memo.dbf','/tmp/stock_q4_memo.dbt'],'Memo&Blocks-77','stock_q4_memo',"This export now includes a NOTES memo column (kept in the .dbt file next to the .dbf). Please carry the note text through as a notes column.\n",'northwind-vendor')
# drop4: header record count = 0 and no EOF marker (export tool bug)
random.seed(404); recs=[(random.random()<.06,rec(44,i)) for i in range(210)]
write('/tmp/stock_q4_patch.dbf',FIELDS,recs,nrec_override=0,eof=False)
truth['drop4']=summ(recs)
pack('drop4',['/tmp/stock_q4_patch.dbf'],'Patch:Run-404','stock_q4_patch',"Heads-up: our exporter had a bug this time and some tools say the file is empty. The data is there.\n",'northwind-vendor')
# drop5: different vendor, different schema and encoding
random.seed(505); recs=[]
F5=[('ITEM_NO','C',12,0),('ITEM_DESC','C',28,0),('ON_HAND','N',7,0),('UNIT_COST','N',9,3),('STATUS','C',1,0),('LAST_CHG','D',8,0)]
for i in range(140):
    r=dict(ITEM_NO=f"TS-{i:05d}",ITEM_DESC=random.choice(words)+f" v{i}",ON_HAND=random.randint(0,900),UNIT_COST=round(random.uniform(1,99),3),STATUS=random.choice('AAAAAIID'),LAST_CHG=dt.date(2026,random.randint(1,10),random.randint(1,28)))
    recs.append((random.random()<.05,r))
write('/tmp/TSSTOCK.DBF',F5,recs,enc='cp850')
truth['drop5']=summ(recs,qty='ON_HAND',price='UNIT_COST',act=lambda r:r['STATUS']=='A',sku='ITEM_NO',desc='ITEM_DESC')
pack('drop5',['/tmp/TSSTOCK.DBF'],'Tail/spin=Five5','tailspin_q4',"Our new warehouse system uses its own column names: ITEM_NO is the SKU, ITEM_DESC the description, ON_HAND the quantity, UNIT_COST the unit price (3 decimals), LAST_CHG the last update date. STATUS is A = active, I = inactive, D = discontinued; only A counts as active. Text is in the old DOS code page 850, not Windows-1252.\n",'tailspin-vendor')
json.dump(truth,open('vendor2_truth.json','w'),indent=1)
print({k:{kk:vv for kk,vv in v.items() if kk not in('skus','sample','notes')} for k,v in truth.items()}, len(truth['drop3']['notes']))
