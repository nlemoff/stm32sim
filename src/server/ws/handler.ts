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
import {
  stopSimulation,
  getSimulation,
  sendGpioInput,
} from "../runner/process-manager";

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
   * Forwards validated gpio_input messages to the simulation subprocess stdin.
   */
  message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
    try {
      const msg =
        typeof message === "string"
          ? JSON.parse(message)
          : JSON.parse(message.toString());

      if (msg.type === "gpio_input") {
        // Validate port: must be a single letter A-E
        const port = String(msg.port);
        if (!/^[A-E]$/.test(port)) return;

        // Validate pin: must be an integer 0-15
        const pin = Number(msg.pin);
        if (!Number.isInteger(pin) || pin < 0 || pin > 15) return;

        // Validate state: must be 0 or 1
        const state = Number(msg.state);
        if (state !== 0 && state !== 1) return;

        // Forward to subprocess stdin
        sendGpioInput(ws.data.simulationId, port, pin, state);
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
