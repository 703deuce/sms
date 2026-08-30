import assert from "node:assert/strict";
import { isMctbDebugEnabled, traceMctbDebug } from "../src/lib/mctb/debug";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

try {
  process.env.NODE_ENV = "production";
  delete process.env.MCTB_DEBUG;
  assert.equal(isMctbDebugEnabled(), true, "production default should be on");

  process.env.MCTB_DEBUG = "0";
  assert.equal(isMctbDebugEnabled(), false);

  process.env.MCTB_DEBUG = "1";
  assert.equal(isMctbDebugEnabled(), true);

  process.env = { ...originalEnv, NODE_ENV: "development" };
  delete process.env.MCTB_DEBUG;
  assert.equal(isMctbDebugEnabled(), true);

  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  traceMctbDebug("setup", "test_event", { workspaceId: "ws_test" });
  console.log = originalLog;
  assert.match(lines.join("\n"), /\[mctb-debug\] setup:test_event/);
  assert.match(lines.join("\n"), /ws_test/);

  console.log("test-mctb-debug: ok");
} finally {
  restoreEnv();
}
