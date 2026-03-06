/**
 * @module server/index
 * @description Bun.serve() entry point with routes + WebSocket
 *
 * HTTP server that exposes REST API endpoints for compiling STM32 C code,
 * running simulations, and listing sample programs. WebSocket support
 * enables real-time streaming of GPIO events from running simulations.
 */
import { join } from "path";
import { handleCompile, withCors } from "./routes/compile";
import { handleRun } from "./routes/run";
import { handleStop } from "./routes/stop";
import { handleListSamples, handleGetSample } from "./routes/samples";
import { wsHandlers, type WsData } from "./ws/handler";
import { stopAllSimulations } from "./runner/process-manager";

const STATIC_DIR = join(process.cwd(), "dist");

const port = parseInt(process.env.PORT || "3000", 10);

const server = Bun.serve<WsData>({
  port,

  async fetch(req, server) {
    const url = new URL(req.url);
    const { pathname } = url;

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    // WebSocket upgrade for /ws path
    if (pathname === "/ws") {
      const simulationId = url.searchParams.get("simulationId");
      if (!simulationId) {
        return withCors(
          Response.json(
            { error: "Missing simulationId query parameter" },
            { status: 400 }
          )
        );
      }

      const upgraded = server.upgrade(req, {
        data: { simulationId },
      });

      if (upgraded) {
        // Bun handles the response for upgraded connections
        return undefined as unknown as Response;
      }

      return withCors(
        new Response("WebSocket upgrade failed", { status: 400 })
      );
    }

    // REST API routing
    if (req.method === "POST" && pathname === "/api/compile") {
      return handleCompile(req);
    }

    if (req.method === "POST" && pathname === "/api/run") {
      return handleRun(req, server);
    }

    if (req.method === "POST" && pathname === "/api/stop") {
      return handleStop(req);
    }

    if (req.method === "GET" && pathname === "/api/samples") {
      return handleListSamples();
    }

    // Match /api/samples/:name
    if (req.method === "GET" && pathname.startsWith("/api/samples/")) {
      const name = pathname.slice("/api/samples/".length);
      if (name && !name.includes("/")) {
        return handleGetSample(name);
      }
    }

    // Serve frontend static files from dist/
    const staticPath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = join(STATIC_DIR, staticPath);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return withCors(new Response(file));
    }

    // Not found
    return withCors(
      Response.json({ error: "Not found" }, { status: 404 })
    );
  },

  websocket: wsHandlers,
});

console.log(
  `STM32 Virtual Test Bench server running on port ${server.port}`
);

// Graceful shutdown: stop all simulations on exit
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  stopAllSimulations();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAllSimulations();
  server.stop();
  process.exit(0);
});

export { server };
