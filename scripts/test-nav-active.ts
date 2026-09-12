import assert from "node:assert/strict";
import { findBestNavMatch } from "@/lib/nav-active";

const mctbNav = [
  { href: "/mctb", matchExact: true },
  { href: "/mctb/missed-calls" },
  { href: "/mctb/conversations" },
  { href: "/personal/voicemail" },
  { href: "/mctb/analytics" },
  { href: "/mctb/setup" },
  { href: "/mctb/numbers" },
];

assert.deepEqual(findBestNavMatch(mctbNav, "/mctb"), { href: "/mctb", isChild: false });
assert.deepEqual(findBestNavMatch(mctbNav, "/mctb/missed-calls"), {
  href: "/mctb/missed-calls",
  isChild: false,
});
assert.deepEqual(findBestNavMatch(mctbNav, "/mctb/missed-calls/abc"), {
  href: "/mctb/missed-calls",
  isChild: false,
});
assert.deepEqual(findBestNavMatch(mctbNav, "/mctb/setup/phone"), {
  href: "/mctb/setup",
  isChild: false,
});
assert.deepEqual(findBestNavMatch(mctbNav, "/mctb/numbers"), {
  href: "/mctb/numbers",
  isChild: false,
});

const appointmentsNav = [
  { href: "/appointments/overview", matchExact: true },
  {
    href: "/appointments/calendar",
    children: [
      { href: "/appointments/calendar" },
      { href: "/appointments" },
      { href: "/appointments/waitlist" },
    ],
  },
];

assert.deepEqual(findBestNavMatch(appointmentsNav, "/appointments/overview"), {
  href: "/appointments/overview",
  isChild: false,
});
assert.deepEqual(findBestNavMatch(appointmentsNav, "/appointments/calendar"), {
  href: "/appointments/calendar",
  isChild: true,
});
assert.deepEqual(findBestNavMatch(appointmentsNav, "/appointments/waitlist"), {
  href: "/appointments/waitlist",
  isChild: true,
});

console.log("nav-active tests passed");
