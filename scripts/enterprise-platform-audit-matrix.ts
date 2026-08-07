#!/usr/bin/env tsx
import { printOwnerAmyAuditMatrix } from "../src/lib/platform/enterprise/owner-readiness-matrix";
import { printWorkflowArchitectAuditMatrix } from "../src/lib/platform/enterprise/architect-readiness-matrix";
import { printAuditMatrix } from "../src/lib/voice/enterprise/readiness-matrix";

printAuditMatrix();
printOwnerAmyAuditMatrix();
printWorkflowArchitectAuditMatrix();
