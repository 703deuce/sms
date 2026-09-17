import net from "node:net";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { getRealtimeBridgeListenPort } from "./config";
import { verifyRealtimeBridgeStreamToken } from "./stream-token";
import { runTelnyxOpenAiRealtimeBridge } from "./call-bridge";
import { runTelnyxOpenAiLiveBridge } from "../openai-live-bridge/call-bridge";
import { resolveVoiceAiTransport } from "./flags";

let httpServer: HttpServer | null = null;
let wss: WebSocketServer | null = null;

export function isRealtimeBridgeServerRunning(): boolean {
  return Boolean(httpServer);
}

function isAddrInUseError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err as NodeJS.ErrnoException).code === "EADDRINUSE"
  );
}

/** True when another process (e.g. realtime-bridge-listener) already owns the bridge port. */
export async function isRealtimeBridgePortOpenLocally(): Promise<boolean> {
  const port = getRealtimeBridgeListenPort();
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

/**
 * Start the bridge WS in this process, or no-op if a sibling listener already bound the port
 * (production: start-production.mjs spawns scripts/realtime-bridge-listener.ts).
 */
export async function ensureTelnyxRealtimeBridgeServer(): Promise<void> {
  await startTelnyxRealtimeBridgeServer();
}

export async function startTelnyxRealtimeBridgeServer(): Promise<void> {
  if (httpServer) return;

  const portAlreadyOwned = await isRealtimeBridgePortOpenLocally();
  if (portAlreadyOwned) {
    console.log(
      JSON.stringify({
        service: "transovo-web",
        event: "telnyx_openai_realtime_bridge_external_listener",
        port: getRealtimeBridgeListenPort(),
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  const port = getRealtimeBridgeListenPort();
  httpServer = createHttpServer((_req, res) => {
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
    const typedClaims = claims as import("./stream-token").RealtimeBridgeStreamClaims;
    const transport = resolveVoiceAiTransport();
    const run =
      transport === "openai_live"
        ? runTelnyxOpenAiLiveBridge({ claims: typedClaims, telnyxSocket: ws })
        : runTelnyxOpenAiRealtimeBridge({ claims: typedClaims, telnyxSocket: ws });
    void run.catch((err) => {
      console.error(`[${transport}-bridge] session failed`, err);
      ws.close(1011, "bridge_failed");
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const server = httpServer!;
      const onError = (err: Error) => {
        server.off("listening", onListening);
        httpServer = null;
        wss = null;
        reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "0.0.0.0");
    });
  } catch (err) {
    httpServer = null;
    wss = null;
    if (isAddrInUseError(err) && (await isRealtimeBridgePortOpenLocally())) {
      console.log(
        JSON.stringify({
          service: "transovo-web",
          event: "telnyx_openai_realtime_bridge_external_listener",
          port,
          reason: "eaddrinuse_sibling_listener",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }
    throw err;
  }

  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "telnyx_openai_realtime_bridge_listening",
      voice_ai_transport: resolveVoiceAiTransport(),
      port,
      timestamp: new Date().toISOString(),
    }),
  );
}
