import { execFileSync } from "node:child_process";

function hydrateTelnyx() {
  const remote = `cid=$(docker ps --filter name=ds8s3hjin60qs6g7s0iqkixs --format '{{.ID}}' | head -1); docker exec "$cid" printenv TELNYX_API_KEY`;
  const key = execFileSync("ssh", ["-o", "BatchMode=yes", "coolify-server", "bash", "-lc", remote], {
    encoding: "utf8",
  }).trim();
  return key;
}

async function main() {
  const key = hydrateTelnyx();
  const base = "https://api.telnyx.com/v2";
  for (const q of ["88077", "85046264", "8382888077"]) {
    const url = `${base}/phone_numbers?filter[phone_number][contains]=${q}&page[size]=5`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const json = await res.json();
    console.log(q, res.status, JSON.stringify(json.data?.map((r) => ({ id: r.id, phone: r.phone_number })) || json.errors));
  }
}

main();
