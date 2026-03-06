/**
 * @module routes/run
 * @description POST /api/run handler
 *
 * Starts a simulation subprocess from a previously compiled binary,
 * sets up event forwarding to WebSocket topics, and returns the
 * simulationId and WebSocket URL for the client to connect to.
 */
import type { Server } from "bun";
import { compilationMap } from "./compile";
import { withCors } from "./compile";
import {
  startSimulation,
  getSimulation,
} from "../runner/process-manager";
import { cleanupCompilation } from "../compiler/compile";
import { getClientCount } from "../ws/handler";

/**
 * Handle POST /api/run
 *
 * Expects JSON body: { compilationId: string, speed?: number, timeout?: number }
 * Returns JSON: { simulationId, wsUrl }
 */
export async function handleRun(
  req: Request,
  server: Server
): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return withCors(
      Response.json({ error: "Invalid JSON body" }, { status: 400 })
    );
  }

  const { compilationId, speed, timeout } = body;

  if (!compilationId || typeof compilationId !== "string") {
    return withCors(
      Response.json(
        { error: "compilationId must be a non-empty string" },
        { status: 400 }
      )
    );
  }

  const binaryPath = compilationMap.get(compilationId);
  if (!binaryPath) {
    return withCors(
      Response.json(
        { error: "Compilation not found. Compile first." },
        { status: 404 }
      )
    );
  }

  // Buffer events until a WebSocket client subscribes (race condition fix:
  // simulation starts emitting before the client connects its WebSocket)
  let bufferedEvents: string[] = [];
  let flushed = false;

  const simulationId = await startSimulation({
    compilationId,
    binaryPath,
    speed: speed ?? 1.0,
    timeoutMs: timeout ?? 30000,
    onEvent: (event) => {
      const json = JSON.stringify(event);
      if (!flushed && getClientCount(simulationId) === 0) {
        bufferedEvents.push(json);
        return;
      }
      // Flush any buffered events first
      if (!flushed) {
        flushed = true;
        for (const buffered of bufferedEvents) {
          server.publish(`sim:${simulationId}`, buffered);
        }
        bufferedEvents = [];
      }
      server.publish(`sim:${simulationId}`, json);
    },
    onExit: (exitCode, signal) => {
      // Publish exit event to WebSocket clients
      server.publish(
        `sim:${simulationId}`,
        JSON.stringify({
          type: "sim_exit",
          timestamp_ms: Date.now(),
          data: { exitCode, signal },
        })
      );

      // Clean up compilation temp directory
      cleanupCompilation(compilationId, binaryPath).catch(() => {
        // Ignore cleanup errors
      });

      // Remove from compilation map
      compilationMap.delete(compilationId);
    },
  });

  // Determine the server port for the WebSocket URL
  const port = server.port;
  const wsUrl = `ws://localhost:${port}/ws?simulationId=${simulationId}`;

  return withCors(Response.json({ simulationId, wsUrl }));
}
