import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { createTask, listTasks, type TaskBucket } from "@/lib/server/crm/native/tasks-appointments";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const bucket = (url.searchParams.get("bucket") || undefined) as TaskBucket | undefined;
    const assigneeUserId = url.searchParams.get("assigneeUserId") || undefined;
    const data = await listTasks(workspaceId, bucket, assigneeUserId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = await request.json();
    if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
    const data = await createTask(workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
