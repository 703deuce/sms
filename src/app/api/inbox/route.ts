import { conversations } from "@/lib/mock/data";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter");
  let data = conversations;
  if (filter === "unassigned") data = conversations.filter((c) => !c.assignedTo);
  if (filter === "unread") data = conversations.filter((c) => c.unread);
  if (filter === "mine") {
    data = conversations.filter(
      (c) => c.assignedTo === "Jordan Lee" || c.assignedTo === "Alex Rivera",
    );
  }
  return NextResponse.json({ data });
}
