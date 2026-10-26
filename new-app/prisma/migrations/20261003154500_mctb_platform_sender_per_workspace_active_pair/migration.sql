-- Platform sender assignment is per workspace: the same caller may text back
-- multiple businesses on the shared platform sender. Only ingress TFNs remain
-- workspace-unique (enforced elsewhere).

DROP INDEX IF EXISTS "mctb_platform_sender_assignments_active_pair_key";

CREATE UNIQUE INDEX "mctb_platform_sender_assignments_active_workspace_pair_key"
ON "mctb_platform_sender_assignments" ("workspaceId", "consumerE164", "platformPhoneNumberId")
WHERE "state" = 'ACTIVE';
