#!/bin/bash
cd /opt/agent/tests/customer22_nov25
while pgrep -f "[r]un_chrome.sh" >/dev/null; do sleep 5; done
docker cp mcp_diag.py agent-lab:/tmp/
U=https://www.walmart.com/,https://www.walmart.com/search?q=robot+vacuum,https://www.walmart.com/ip/AIRROBO-G60-3-in-1-Robot-Vacuum-and-Mop-Combo-with-Smart-App-Voice-Control-2-in-1-Tank-for-pet-hair/14835814051,https://www.bestbuy.com/,https://www.bestbuy.com/site/searchpage.jsp?st=robot+vacuum
for T in direct residential; do
 for h in walmart.com bestbuy.com; do curl -s "http://127.0.0.1:18081/force?host=$h&tier=$T&job=chrome&ttl=900" >/dev/null; done
 docker exec -e KEEPER=/tmp/keeper_new_nohook agent-lab timeout 400 python3 /tmp/mcp_diag.py /tmp/bd_out M_pw86_$T /opt/tools/pylib/pwmcp $U >> mcp_results.jsonl 2>>bd_err.log
 docker exec -e KEEPER=/tmp/keeper_new_nohook agent-lab timeout 400 python3 /tmp/mcp_diag.py /tmp/bd_out M_patchright83_$T /opt/tools/pylib/pwmcp-pr $U >> mcp_results.jsonl 2>>bd_err.log
done
for h in walmart.com bestbuy.com glassdoor.com g2.com; do curl -s "http://127.0.0.1:18081/force?host=$h&tier=direct&job=chrome&ttl=5" >/dev/null; done
echo MCP_DONE >> more.log
