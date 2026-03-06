/**
 * @module ws/handler
 * @description WebSocket open/message/close handlers
 *
 * Manages WebSocket connections for real-time simulation event streaming.
 * Clients connect to /ws?simulationId=X to receive GPIO events as the
 * simulation runs. When the last client disconnects, the simulation
 * process is killed to avoid orphaned subprocesses.
 */
import type { ServerWebSocket } from "bun";
import { stopSimulation, getSimulation } from "../runner/process-manager";

/**
 * Data attached to each WebSocket connection.
 */
export interface WsData {
  simulationId: string;
}

/**
 * Track which WebSocket clients are subscribed to which simulation.
 * Key: simulationId, Value: Set of WebSocket connections
 */
const clientsBySimulation = new Map<
  string,
  Set<ServerWebSocket<WsData>>
>();

/**
 * Get client count for a simulation (exported for testing).
 */
export function getClientCount(simulationId: string): number {
  return clientsBySimulation.get(simulationId)?.size ?? 0;
}

/**
 * WebSocket handlers compatible with Bun.serve() websocket config.
 */
export const wsHandlers = {
  /**
   * Called when a new WebSocket connection is established.
   * Subscribes the client to the simulation's pub/sub topic.
   */
  open(ws: ServerWebSocket<WsData>) {
    const simId = ws.data.simulationId;
    if (!simId) {
      ws.close(1008, "Missing simulationId");
      return;
    }

    // Subscribe to the simulation topic for pub/sub broadcasting
    ws.subscribe(`sim:${simId}`);

    // Track this client
    if (!clientsBySimulation.has(simId)) {
      clientsBySimulation.set(simId, new Set());
    }
    clientsBySimulation.get(simId)!.add(ws);
  },

  /**
   * Called when a message is received from a WebSocket client.
   * Currently only logs gpio_input messages (reserved for Phase 2 button support).
   */
  message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
    try {
      const msg =
        typeof message === "string"
          ? JSON.parse(message)
          : JSON.parse(message.toString());

      if (msg.type === "gpio_input") {
        // Reserved for Phase 2 button support -- log and ignore for now
        // console.log(`GPIO input for sim ${ws.data.simulationId}:`, msg);
      }
    } catch {
      // Ignore invalid messages
    }
  },

  /**
   * Called when a WebSocket connection is closed.
   * Unsubscribes from the simulation topic and stops the simulation
   * if this was the last connected client.
   */
  close(ws: ServerWebSocket<WsData>) {
    const simId = ws.data.simulationId;
    if (!simId) return;

    // Unsubscribe from topic
    ws.unsubscribe(`sim:${simId}`);

    // Remove from client tracking
    const clients = clientsBySimulation.get(simId);
    if (clients) {
      clients.delete(ws);

      // If this was the last client, stop the simulation to avoid orphaned processes
      if (clients.size === 0) {
        clientsBySimulation.delete(simId);

        // Only stop if the simulation is still running
        if (getSimulation(simId)) {
          stopSimulation(simId);
        }
      }
    }
  },
};
