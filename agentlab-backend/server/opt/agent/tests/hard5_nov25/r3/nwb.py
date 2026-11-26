import struct, zlib, json, random, sys, os
def uv(n):
    out=bytearray()
    while True:
        b=n&0x7f; n>>=7
        if n: out.append(b|0x80)
        else: out.append(b); return bytes(out)
def zz(n): return (n<<1) if n>=0 else ((-n)<<1)-1
def collect(v,tab,idx):
    def add(s):
        if s not in idx: idx[s]=len(tab); tab.append(s)
    if isinstance(v,dict):
        for k,x in v.items(): add(k); collect(x,tab,idx)
    elif isinstance(v,list):
        for x in v: collect(x,tab,idx)
    elif isinstance(v,str): add(v)
def enc_val(v,idx):
    if v is None: return b'\x00'
    if isinstance(v,bool): return b'\x01'+(b'\x01' if v else b'\x00')
    if isinstance(v,int): return b'\x02'+uv(zz(v))
    if isinstance(v,float): return b'\x03'+struct.pack('<d',v)
    if isinstance(v,str): return b'\x04'+uv(idx[v])
    if isinstance(v,list): return b'\x05'+uv(len(v))+b''.join(enc_val(x,idx) for x in v)
    if isinstance(v,dict): return b'\x07'+enc_obj(v,idx)
def enc_obj(o,idx): return uv(len(o))+b''.join(uv(idx[k])+enc_val(x,idx) for k,x in o.items())
def encode(recs,compress=False):
    tab=[]; idx={}
    for r in recs: collect(r,tab,idx)
    body=uv(len(tab))+b''.join(uv(len(s.encode()))+s.encode() for s in tab)+uv(len(recs))+b''.join(enc_obj(r,idx) for r in recs)
    flags=1 if compress else 0
    if compress: body=uv(len(body))+zlib.compress(body,9)
    data=b'NWB1'+bytes([1])+struct.pack('<H',flags)+body
    return data+struct.pack('<I',zlib.crc32(data))
