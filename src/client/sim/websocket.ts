/**
 * @module client/sim/websocket
 * @description WebSocket connection manager with typed event dispatch.
 * Connects to the simulation backend and dispatches parsed JSON events
 * to registered handlers.
 */

export interface SimulationEvent {
  type: string;
  timestamp_ms: number;
  data: Record<string, unknown>;
}

type EventHandler = (event: SimulationEvent) => void;
type CloseHandler = () => void;

/**
 * Manages a WebSocket connection to the simulation backend.
 * Supports typed event handlers and wildcard ('*') subscriptions.
 */
export class SimConnection {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, EventHandler[]>();
  private closeHandlers: CloseHandler[] = [];

  /**
   * Open a WebSocket connection for the given simulation.
   */
  connect(simulationId: string): void {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/ws?simulationId=${simulationId}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (msg) => {
      try {
        const event: SimulationEvent = JSON.parse(msg.data);
        // Dispatch to type-specific handlers
        const typeHandlers = this.handlers.get(event.type);
        if (typeHandlers) {
          for (const h of typeHandlers) h(event);
        }
        // Dispatch to wildcard handlers
        const wildcardHandlers = this.handlers.get("*");
        if (wildcardHandlers) {
          for (const h of wildcardHandlers) h(event);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    this.ws.onclose = () => {
      for (const h of this.closeHandlers) h();
    };
  }

  /**
   * Register a handler for a specific event type.
   * Use '*' to receive all events.
   */
  on(type: string, handler: EventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /**
   * Send a GPIO input command to the running simulation.
   */
  sendGpioInput(port: string, pin: number, state: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({ type: "gpio_input", port, pin, state })
      );
    }
  }

  /**
   * Register a handler called when the WebSocket connection closes.
   */
  onClose(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  /**
   * Close the WebSocket connection. Event handlers registered via on()
   * and onClose() are preserved for subsequent connections.
   */
  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
