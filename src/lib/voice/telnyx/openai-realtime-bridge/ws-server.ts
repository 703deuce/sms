import { createServer, type Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { getRealtimeBridgeListenPort } from "./config";
import { verifyRealtimeBridgeStreamToken } from "./stream-token";
import { runTelnyxOpenAiRealtimeBridge } from "./call-bridge";

let httpServer: Server | null = null;
let wss: WebSocketServer | null = null;

export function isRealtimeBridgeServerRunning(): boolean {
  return Boolean(httpServer);
}

export async function startTelnyxRealtimeBridgeServer(): Promise<void> {
  if (httpServer) return;

  const port = getRealtimeBridgeListenPort();
  httpServer = createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });

  wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname !== "/telnyx/media") {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get("token") || "";
    const claims = verifyRealtimeBridgeStreamToken(token);
    if (!claims) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss!.handleUpgrade(req, socket, head, (ws) => {
      wss!.emit("connection", ws, req, claims);
    });
  });

  wss.on("connection", (ws: WebSocket, _req, claims) => {
    void runTelnyxOpenAiRealtimeBridge({
      claims: claims as import("./stream-token").RealtimeBridgeStreamClaims,
      telnyxSocket: ws,
    }).catch((err) => {
      console.error("[realtime-bridge] session failed", err);
      ws.close(1011, "bridge_failed");
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer!.listen(port, "0.0.0.0", () => resolve());
    httpServer!.on("error", reject);
  });

  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "telnyx_openai_realtime_bridge_listening",
      port,
      timestamp: new Date().toISOString(),
    }),
  );
}
