#!/usr/bin/env python3
"""Block diagnosis, HTTP layer. Runs inside agent-lab container. Prints no secrets."""
import json, sys, time, re
from curl_cffi import requests as cr
GW="http://127.0.0.1:18080"
URLS={
 "walmart_home":"https://www.walmart.com/",
 "walmart_search":"https://www.walmart.com/search?q=robot+vacuum",
 "walmart_product":"https://www.walmart.com/ip/Shark-AI-Ultra-Voice-Control-Robot-Vacuum/399361930",
 "bestbuy_home":"https://www.bestbuy.com/",
 "bestbuy_search":"https://www.bestbuy.com/site/searchpage.jsp?st=robot+vacuum",
 "bestbuy_product":"https://www.bestbuy.com/site/6565859.p?skuId=6565859",
 "glassdoor_company":"https://www.glassdoor.com/Overview/Working-at-Google-EI_IE9079.11,17.htm",
 "glassdoor_jobs":"https://www.glassdoor.com/Job/remote-data-engineer-jobs-SRCH_IL.0,6_IS11047_KO7,20.htm",
 "g2_home":"https://www.g2.com/",
 "g2_product":"https://www.g2.com/products/slack/reviews",
}
VEND=[("akamai",["akamai","_abck","bm_sz","ak_bmsc","bm_sv","edgesuite","reference #"]),
      ("perimeterx",["_px","perimeterx","px-captcha","human security","press & hold","pxhd","px-cdn"]),
      ("datadome",["datadome","captcha-delivery.com","x-dd-b"]),
      ("cloudflare",["cf-ray","cf-mitigated","__cf_bm","cf_clearance","challenges.cloudflare.com","just a moment"]),
      ("kasada",["x-kpsdk","kpsdk","ips.js"]),("imperva",["incap_ses","visid_incap","_incapsula_"])]
def vend(h,cookies,body):
    blob=(" ".join(f"{k}:{v}" for k,v in h.items())+" "+" ".join(cookies)+" "+body[:60000]).lower()
    return [n for n,keys in VEND if any(k in blob for k in keys)]
def title(b):
    m=re.search(r"<title[^>]*>(.*?)</title>",b,re.S|re.I); return (m.group(1).strip()[:80] if m else "")
def one(name,url,mode,tier,job):
    kw=dict(timeout=30,allow_redirects=True)
    if mode=="chrome": kw["impersonate"]="chrome"
    else: kw["headers"]={"User-Agent":"curl/8.5.0","Accept":"*/*"}
    if tier=="direct": kw["proxies"]={"https":GW.replace("://",f"://{job}__tier.direct:x@"),"http":GW.replace("://",f"://{job}__tier.direct:x@")}
    else: kw["proxies"]={"https":GW.replace("://",f"://{job}__tier.residential:x@"),"http":GW.replace("://",f"://{job}__tier.residential:x@")}
    t=time.time()
    try:
        r=cr.get(url,**kw); b=r.text or ""
        h={k.lower():v for k,v in r.headers.items()}
        ck=list(r.cookies.keys())
        keep={k:h[k][:80] for k in h if k in("server","x-px","cf-ray","cf-mitigated","x-datadome","x-dd-b","akamai-grn","x-akamai-transformed","x-kpsdk-ct","content-length","location","set-cookie","x-cache","via","x-served-by")}
        if "set-cookie" in keep: keep["set-cookie"]=keep["set-cookie"][:40]
        return dict(name=name,mode=mode,tier=tier,status=r.status_code,final=r.url[:90],len=len(b),title=title(b),vendors=vend(h,ck,b),cookies=ck[:15],hdr=keep,sec=round(time.time()-t,1))
    except Exception as e:
        return dict(name=name,mode=mode,tier=tier,error=str(e)[:160],sec=round(time.time()-t,1))
if __name__=="__main__":
    names=sys.argv[1].split(",") if len(sys.argv)>1 else list(URLS)
    modes=sys.argv[2].split(",") if len(sys.argv)>2 else ["curl","chrome"]
    tiers=sys.argv[3].split(",") if len(sys.argv)>3 else ["direct","residential"]
    job=sys.argv[4] if len(sys.argv)>4 else "blockdiag1"
    for n in names:
        for m in modes:
            for t in tiers:
                print(json.dumps(one(n,URLS[n],m,t,job)),flush=True)
