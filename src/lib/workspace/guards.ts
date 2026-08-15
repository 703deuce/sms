import { NextResponse } from "next/server";
import {
  canUseFeature,
  isBusinessOnlyPath,
  isPersonalOnlyPath,
} from "@/lib/workspace/capabilities";
import type { WorkspaceFeature, WorkspaceType } from "@/lib/workspace/types";

export function guardWorkspaceFeature(
  workspaceType: WorkspaceType,
  feature: WorkspaceFeature,
) {
  if (!canUseFeature(workspaceType, feature)) {
    return NextResponse.json(
      { error: "This feature is not available in your current workspace." },
      { status: 403 },
    );
  }
  return null;
}

export function redirectPathForWorkspaceMismatch(
  pathname: string,
  workspaceType: WorkspaceType,
): string | null {
  if (workspaceType === "PERSONAL" && isBusinessOnlyPath(pathname)) {
    return "/personal";
  }
  if (workspaceType === "BUSINESS" && isPersonalOnlyPath(pathname)) {
    return "/outcomes";
  }
  return null;
}
