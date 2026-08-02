import { createHmac } from "crypto";

function mcpSecret() {
  return process.env.VOICE_MCP_SECRET?.trim() || process.env.TELNYX_API_KEY?.trim() || "";
}

export function mintWorkspaceMcpToken(workspaceId: string) {
  const secret = mcpSecret();
  if (!secret) throw new Error("VOICE_MCP_SECRET or TELNYX_API_KEY required");
  return createHmac("sha256", secret).update(`voice-mcp:${workspaceId}`).digest("hex");
}
