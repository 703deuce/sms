/**
 * Smoke test contacts / lists / segments APIs.
 * Run: node scripts/test-contacts-lists-segments-api.mjs
 * Remote: CONTACTS_TEST_URL=https://your-host node scripts/test-contacts-lists-segments-api.mjs
 */
const BASE = (process.env.CONTACTS_TEST_URL || "http://localhost:3000").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = process.env.SMOKE_EMAIL || "alex@harborhome.co";
const WORKSPACE_ID = process.env.SMOKE_WORKSPACE_ID || "ws_1";

const jar = new Map();

function parseSetCookie(headers) {
  for (const raw of headers.getSetCookie?.() || []) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

async function api(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  const cookies = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookies) headers.set("Cookie", cookies);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  parseSetCookie(res.headers);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) failures.push({ name, detail });
  console.log(cond ? "PASS" : "FAIL", name, detail);
}

async function main() {
  const login = await api("/api/auth/smoke-login", {
    method: "POST",
    headers: { "x-smoke-bootstrap": BOOTSTRAP },
    body: JSON.stringify({ email: EMAIL, workspaceId: WORKSPACE_ID }),
  });
  check("smoke-login", login.ok, `status ${login.status}`);
  if (!login.ok) process.exit(1);

  const contacts = await api("/api/contacts?take=5");
  const first = contacts.json?.data?.[0];
  check("GET contacts", contacts.ok && first?.dateAdded, `dateAdded=${first?.dateAdded || "missing"}`);

  if (first?.firstName) {
    const search = await api(`/api/contacts?q=${encodeURIComponent(String(first.firstName).slice(0, 3))}&take=5`);
    check(
      "GET contacts search q=",
      search.ok && (search.json?.data?.length ?? 0) >= 1,
      `matches=${search.json?.data?.length ?? 0}`,
    );
  } else {
    check("GET contacts search q=", true, "skipped (no contacts)");
  }

  const stats = await api("/api/contacts/stats");
  check("GET stats", stats.ok, JSON.stringify(stats.json?.data));

  const testListName = `API Test List ${Date.now()}`;
  const createdList = await api("/api/contacts/lists", {
    method: "POST",
    body: JSON.stringify({ name: testListName, description: "auto test" }),
  });
  const listId = createdList.json?.data?.id;
  check("POST list", createdList.ok, listId);

  const contactId = first?.id;
  const addToList = await api("/api/contacts/lists", {
    method: "PATCH",
    body: JSON.stringify({ id: listId, addContactIds: [contactId] }),
  });
  check("PATCH add to list", addToList.ok, addToList.json?.error || "ok");
  check(
    "PATCH list returns contactCount",
    addToList.ok &&
      typeof addToList.json?.data?.contactCount === "number" &&
      addToList.json.data.contactCount >= 1,
    `count=${addToList.json?.data?.contactCount}`,
  );

  const listPreview = await api("/api/contacts/segments/preview", {
    method: "POST",
    body: JSON.stringify({
      conditions: { match: "all", rules: [{ field: "list", op: "equals", value: testListName }] },
    }),
  });
  check(
    "segment preview list membership",
    listPreview.ok && (listPreview.json?.data?.count ?? 0) >= 1,
    `count=${listPreview.json?.data?.count}`,
  );

  const newPhone = `+1571${String(Date.now()).slice(-7)}`;
  const newContact = await api("/api/contacts", {
    method: "POST",
    body: JSON.stringify({ phone: newPhone, firstName: "Test", lastName: "User", status: "SUBSCRIBED" }),
  });
  const newContactId = newContact.json?.data?.id;
  const patchLists = await api(`/api/contacts/${newContactId}`, {
    method: "PATCH",
    body: JSON.stringify({ listIds: [listId] }),
  });
  check(
    "PATCH contact listIds only",
    patchLists.ok && Array.isArray(patchLists.json?.data?.lists) && patchLists.json.data.lists.includes(testListName),
    JSON.stringify(patchLists.json?.data?.lists),
  );

  const segments = await api("/api/contacts/segments");
  check("GET segments", segments.ok, `count ${segments.json?.data?.length}`);
  check(
    "GET segments include contactCount",
    segments.ok && (segments.json?.data?.length === 0 || segments.json?.data?.every((s) => typeof s.contactCount === "number")),
    `first count=${segments.json?.data?.[0]?.contactCount}`,
  );

  const importPhone = `+1571${String(Date.now()).slice(-7)}`;
  const attestRes = await api("/api/mass-texting/import-attestation", {
    method: "POST",
    body: JSON.stringify({
      listNames: [testListName, `${testListName} B`],
      contactCount: 1,
      attestationAccepted: true,
      source: "csv_import",
    }),
  });
  const attestId = attestRes.json?.data?.id;
  const importRes = await api("/api/contacts/import", {
    method: "POST",
    body: JSON.stringify({
      rows: [{ phone: importPhone, firstName: "Import", lastName: "Test", status: "SUBSCRIBED" }],
      listNames: [testListName, `${testListName} B`],
      marketingImport: true,
      attestationId: attestId,
    }),
  });
  check("POST import multi-list", importRes.ok, JSON.stringify(importRes.json?.data?.listIds?.length));
  check(
    "import assigned multiple lists",
    (importRes.json?.data?.listIds?.length ?? 0) >= 2,
    JSON.stringify(importRes.json?.data),
  );

  const createdSeg = await api("/api/contacts/segments", {
    method: "POST",
    body: JSON.stringify({
      name: `API Test Segment ${Date.now()}`,
      conditions: {
        match: "all",
        groups: [
          {
            match: "any",
            rules: [{ field: "list", op: "equals", value: testListName }],
          },
        ],
      },
    }),
  });
  const segId = createdSeg.json?.data?.id;
  check("POST segment nested groups", createdSeg.ok, segId);
  check(
    "POST segment returns contactCount",
    createdSeg.ok && typeof createdSeg.json?.data?.contactCount === "number",
    `count=${createdSeg.json?.data?.contactCount}`,
  );

  const segNoop = await api("/api/contacts/segments", {
    method: "PATCH",
    body: JSON.stringify({ id: segId }),
  });
  check("PATCH segment noop", segNoop.ok, segNoop.json?.error || "ok");

  const segContacts = await api("/api/contacts/segments/contacts", {
    method: "POST",
    body: JSON.stringify({ segmentId: segId, take: 10 }),
  });
  check(
    "POST segment contacts",
    segContacts.ok && (segContacts.json?.data?.total ?? 0) >= 1,
    `total=${segContacts.json?.data?.total}`,
  );

  const keywords = await api("/api/growth/keywords");
  const keywordId = keywords.json?.data?.[0]?.id;
  if (keywordId) {
    const kwClear = await api(`/api/growth/keywords/${keywordId}`, {
      method: "PATCH",
      body: JSON.stringify({ listName: "" }),
    });
    check(
      "PATCH keyword clear listName",
      kwClear.ok && kwClear.json?.data?.listName === "",
      `listName=${JSON.stringify(kwClear.json?.data?.listName)}`,
    );
  } else {
    check("PATCH keyword clear listName", true, "skipped (no keywords)");
  }

  if (newContactId) await api(`/api/contacts/${newContactId}`, { method: "DELETE" });
  const importContact = await api(`/api/contacts?phone=${encodeURIComponent(importPhone)}`);
  const importContactId = importContact.json?.data?.[0]?.id;
  if (importContactId) await api(`/api/contacts/${importContactId}`, { method: "DELETE" });
  const extraList = await api("/api/contacts/lists");
  const extraListId = extraList.json?.data?.find((l) => l.name === `${testListName} B`)?.id;
  if (extraListId) await api(`/api/contacts/lists?id=${extraListId}`, { method: "DELETE" });
  if (segId) await api(`/api/contacts/segments?id=${segId}`, { method: "DELETE" });
  if (listId) await api(`/api/contacts/lists?id=${listId}`, { method: "DELETE" });

  console.log(`\nFailures: ${failures.length}`);
  if (failures.length) {
    for (const f of failures) console.log("-", f.name, f.detail);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
