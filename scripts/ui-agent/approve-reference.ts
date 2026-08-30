import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatedDirForSession, listGeneratedFiles } from "./generated-sandbox";
import { writeHandoff } from "./handoff";
import { log } from "./logger";
import { loadSession, updateSession } from "./session";
import type { ApprovedReference } from "./types";

export function approveReference(input: {
  sessionId: string;
  target: string;
  referenceSources: string[];
  notes?: string;
}): ApprovedReference {
  const generatedFiles = listGeneratedFiles(input.sessionId);
  if (generatedFiles.length === 0) {
    throw new Error("No generated files to approve — run ui:improve first");
  }

  const approved: ApprovedReference = {
    approved: true,
    sessionId: input.sessionId,
    target: input.target,
    generatedFiles,
    referenceSources: input.referenceSources,
    approvedAt: new Date().toISOString(),
    notes: input.notes || "",
  };

  writeFileSync(join(generatedDirForSession(input.sessionId), "APPROVED.json"), JSON.stringify(approved, null, 2), "utf8");
  log("reference approved", input.sessionId);

  try {
    const session = loadSession(input.sessionId);
    session.approved = true;
    session.status = "approved";
    updateSession(session);
    writeHandoff(session);
  } catch {
    // session may not exist for standalone approve
  }

  return approved;
}

export function loadApprovedReference(sessionId: string): ApprovedReference {
  const path = join(generatedDirForSession(sessionId), "APPROVED.json");
  if (!existsSync(path)) {
    throw new Error(`No APPROVED.json for session ${sessionId} — run ui:approve first`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as ApprovedReference;
}
