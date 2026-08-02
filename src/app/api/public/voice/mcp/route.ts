import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getPrisma } from "@/lib/db";
import { executeBuiltinVoiceAction } from "@/lib/voice/tools/builtin-actions";
import { mintWorkspaceMcpToken } from "@/lib/voice/platform/mcp-token";

/**
 * Transovo-hosted MCP-style JSON-RPC endpoint for approved Telnyx assistants.
 * Exposes allowlisted builtins only — no raw DB access.
 *
 * Auth: Authorization: Bearer <workspace mcp token>
 * Token = HMAC(workspaceId, VOICE_MCP_SECRET || TELNYX_API_KEY)
 */

const ALLOWED_TOOLS = [
  {
    name: "lookup_customer",
    description: "Look up a CRM contact by phone or email",
    inputSchema: {
      type: "object",
      properties: { phone: { type: "string" }, email: { type: "string" } },
    },
  },
  {
    name: "search_crm_contacts",
    description:
      "Search Transovo + connected CRM contacts by name, phone, or email",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        match_type: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "calendar_availability",
    description: "Check calendar availability",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
    },
  },
  {
    name: "book_appointment",
    description: "Book an appointment",
    inputSchema: {
      type: "object",
      properties: {
        startAt: { type: "string" },
        customerPhone: { type: "string" },
        customerName: { type: "string" },
        customerEmail: { type: "string" },
        serviceId: { type: "string" },
      },
      required: ["startAt", "customerPhone"],
    },
  },
  {
    name: "send_sms",
    description: "Send an SMS (messaging-ready numbers only)",
    inputSchema: {
      type: "object",
      properties: { to: { type: "string" }, body: { type: "string" } },
      required: ["to", "body"],
    },
  },
  {
    name: "create_task",
    description: "Create a follow-up task",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        notes: { type: "string" },
        phone: { type: "string" },
      },
      required: ["title"],
    },
  },
] as const;

function verifyToken(workspaceId: string, token: string) {
  const expected = mintWorkspaceMcpToken(workspaceId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const workspaceId = request.headers.get("x-transovo-workspace-id") || "";
    if (!workspaceId || !token || !verifyToken(workspaceId, token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      jsonrpc?: string;
      id?: string | number;
      method?: string;
      params?: Record<string, unknown>;
    };
    const id = body.id ?? null;
    const method = String(body.method || "");

    if (method === "tools/list" || method === "list_tools") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { tools: ALLOWED_TOOLS },
      });
    }

    if (method === "tools/call" || method === "call_tool") {
      const name = String(body.params?.name || body.params?.tool || "");
      const args = (body.params?.arguments || body.params?.input || {}) as Record<
        string,
        unknown
      >;
      if (!ALLOWED_TOOLS.some((t) => t.name === name)) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool not allowlisted: ${name}` },
        });
      }
      // Optional agent binding for calendar/booking context.
      const agent = await getPrisma().voiceAgent.findFirst({
        where: { workspaceId, status: { in: ["ACTIVE", "TESTING"] } },
        orderBy: { updatedAt: "desc" },
      });
      const result = await executeBuiltinVoiceAction({
        workspaceId,
        agentId: agent?.id,
        toolType: name,
        input: args,
      });
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result) }], structured: result },
      });
    }

    if (method === "initialize" || method === "ping") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "transovo-voice-mcp", version: "1.0.0" },
          capabilities: { tools: {} },
        },
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown method ${method}` },
    });
  } catch (err) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : "MCP error",
        },
      },
      { status: 500 },
    );
  }
}
