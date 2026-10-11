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
  const { resolveMicrosoftRefreshScopes, getMicrosoftOAuthScopes } = await import(
    "../src/lib/microsoft/oauth-config"
  );
  const granted = "openid profile email User.Read Calendars.ReadWrite";
  assert.equal(resolveMicrosoftRefreshScopes({ grantedScopes: granted }), granted);
  assert.equal(resolveMicrosoftRefreshScopes({}), getMicrosoftOAuthScopes());
  console.log("PASS resolveMicrosoftRefreshScopes");
}

main();
