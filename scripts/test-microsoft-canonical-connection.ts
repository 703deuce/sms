import assert from "node:assert/strict";
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

async function main() {
  const { pickCanonicalMicrosoftConnection, isSameMicrosoftAccount } = await import(
    "../src/lib/calendar/microsoft-canonical-connection"
  );

  const importRow = {
    id: "import",
    status: "needs_reauth",
    createdAt: new Date("2026-09-14"),
    config: { importCalendarIds: ["cal-1"], microsoftUserId: "u1" },
  };
  const emptyRow = {
    id: "empty",
    status: "connected",
    createdAt: new Date("2026-09-08"),
    config: { microsoftUserId: "u1" },
  };
  const picked = pickCanonicalMicrosoftConnection([emptyRow, importRow]);
  assert.equal(picked?.id, "import");

  assert.equal(
    isSameMicrosoftAccount(
      { microsoftUserId: "a", email: "x@y.com" },
      { microsoftUserId: "a", email: "other@y.com" },
    ),
    true,
  );
  assert.equal(
    isSameMicrosoftAccount(
      { email: "a@b.com", tenantId: "t1" },
      { email: "a@b.com", tenantId: "t2" },
    ),
    false,
  );

  console.log("PASS microsoft canonical connection");
}

main();
