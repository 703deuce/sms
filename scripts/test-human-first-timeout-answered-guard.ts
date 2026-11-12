import assert from "node:assert/strict";

function humanCallWasAnsweredByHuman(human: {
  status: string;
  answeredAt: Date | null;
  disposition: string | null;
}) {
  if (human.answeredAt) return true;
  if (human.status === "in_progress" || human.status === "answered") return true;
  const disposition = String(human.disposition || "");
  if (disposition.startsWith("missed:") || disposition === "missed") return false;
  if (human.status === "completed" && !disposition) return true;
  return false;
}

assert.equal(
  humanCallWasAnsweredByHuman({
    status: "completed",
    answeredAt: null,
    disposition: "missed:normal_clearing",
  }),
  false,
);
assert.equal(
  humanCallWasAnsweredByHuman({
    status: "completed",
    answeredAt: new Date(),
    disposition: null,
  }),
  true,
);
assert.equal(
  humanCallWasAnsweredByHuman({ status: "in_progress", answeredAt: null, disposition: null }),
  true,
);

console.log("PASS human-first timeout answered guard");
