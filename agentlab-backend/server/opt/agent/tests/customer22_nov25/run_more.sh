#!/bin/bash
cd /opt/agent/tests/customer22_nov25
while pgrep -f run_variants.sh >/dev/null; do sleep 5; done
docker cp browser_diag.py agent-lab:/tmp/
P=/tmp/prvenv/bin/python
run(){ L=$1; D=$2; T=$3; SEQ=$4; PY=${5:-python3}
 for h in walmart.com bestbuy.com glassdoor.com g2.com; do curl -s "http://127.0.0.1:18081/force?host=$h&tier=$T&job=chrome&ttl=1200" >/dev/null; done
 docker exec -e KEEPER=/tmp/keeper_nohook agent-lab timeout 600 $PY /tmp/browser_diag.py /tmp/bd_out $L $D $SEQ >> bd_results.jsonl 2>>bd_err.log; }
W=walmart_home,walmart_search,walmart_product,bestbuy_home,bestbuy_search,bestbuy_product
run V5_res_patchright patchright residential $W $P
run V6_direct_patchright patchright direct $W $P
run V7_res_pw_nowarm pw residential walmart_search,walmart_product,bestbuy_search,bestbuy_product
run V8_res_raw_nowarm raw residential walmart_product,bestbuy_product,glassdoor_jobs
echo DONE >> bd_nohup.log
