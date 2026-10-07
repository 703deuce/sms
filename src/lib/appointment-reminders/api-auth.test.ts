import assert from "node:assert/strict";
import { defaultArPermissionsForRole } from "./permissions-roles";

assert.ok(defaultArPermissionsForRole("viewer").includes("appointment_reminders.read"));
assert.ok(!defaultArPermissionsForRole("viewer").includes("appointment_reminders.write"));
assert.ok(defaultArPermissionsForRole("admin").includes("appointment_reminders.settings"));

console.log("api-auth.test.ts: ok");
