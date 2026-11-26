#!/bin/bash
# runs inside host; drives docker exec. usage: run_variants.sh LABEL DRIVER TIER [KEEPER] [PROFILE]
L=$1; D=$2; T=$3; KP=${4:-/opt/tools/chrome-keeper}; PF=${5:-/tmp/bd-prof-$1}
SEQ=walmart_home,walmart_search,walmart_product,bestbuy_home,bestbuy_search,bestbuy_product,glassdoor_home,glassdoor_company,g2_home,g2_product
for h in walmart.com bestbuy.com glassdoor.com g2.com; do curl -s "http://127.0.0.1:18081/force?host=$h&tier=$T&job=chrome&ttl=1200" >/dev/null; done
docker exec -e KEEPER=$KP agent-lab timeout 600 python3 /tmp/browser_diag.py /tmp/bd_out $L $D $SEQ $PF >> /opt/agent/tests/customer22_nov25/bd_results.jsonl 2>>/opt/agent/tests/customer22_nov25/bd_err.log
