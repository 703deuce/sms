#!/bin/bash
cd /opt/agent/tests/customer22_nov25
while pgrep -f run_more.sh >/dev/null; do sleep 5; done
run(){ L=$1; D=$2; T=$3; SEQ=$4; PF=$5; PY=${6:-python3}
 for h in walmart.com bestbuy.com glassdoor.com g2.com; do curl -s "http://127.0.0.1:18081/force?host=$h&tier=$T&job=chrome&ttl=1200" >/dev/null; done
 docker exec -e KEEPER=/tmp/keeper_new_nohook agent-lab timeout 600 $PY /tmp/browser_diag.py /tmp/bd_out $L $D $SEQ $PF >> bd_results.jsonl 2>>bd_err.log; }
W=walmart_home,walmart_search,walmart_product,bestbuy_home,bestbuy_search,bestbuy_product
run C1_chrome_direct_pw pw direct $W /tmp/bd-prof-C1
run C2_chrome_direct_raw raw direct $W /tmp/bd-prof-C2
run C3_chrome_res_pw pw residential $W,glassdoor_company,g2_product /tmp/bd-prof-C3
run C4_chrome_res_pw_warmprofile pw residential walmart_search,walmart_product,bestbuy_search,bestbuy_product /tmp/bd-prof-C3
run C5_chrome_res_patchright patchright residential $W /tmp/bd-prof-C5 /tmp/prvenv/bin/python
for h in walmart.com bestbuy.com glassdoor.com g2.com; do curl -s "http://127.0.0.1:18081/force?host=$h&tier=direct&job=chrome&ttl=5" >/dev/null; done
echo CHROME_DONE >> more.log
