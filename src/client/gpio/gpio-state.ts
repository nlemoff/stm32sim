/**
 * @module client/gpio/gpio-state
 * @description GPIO state model tracking pin directions and values.
 * Processes gpio_init and gpio_write events from the simulation backend.
 */

export interface PinState {
  port: string;
  pin: number;
  direction: "input" | "output" | "unknown";
  mode: string;
  value: number;
}

/**
 * Tracks GPIO pin state for the running simulation.
 * Keyed by "port:pin" (e.g., "A:5").
 */
export class GpioState {
  private pins = new Map<string, PinState>();

  private key(port: string, pin: number): string {
    return `${port}:${pin}`;
  }

  /**
   * Handle a gpio_init event. Creates PinState entries for each pin.
   * Direction derived from mode: "input" modes map to "input", everything else to "output".
   */
  handleGpioInit(data: { port: string; pins: number[]; mode: string }): void {
    const direction: PinState["direction"] =
      data.mode === "input" ? "input" : "output";
    for (const pin of data.pins) {
      this.pins.set(this.key(data.port, pin), {
        port: data.port,
        pin,
        direction,
        mode: data.mode,
        value: 0,
      });
    }
  }

  /**
   * Handle a gpio_write event. Updates value for the pin.
   * If pin not yet in map, creates an entry with direction "output".
   */
  handleGpioWrite(data: { port: string; pin: number; state: number }): void {
    const k = this.key(data.port, data.pin);
    const existing = this.pins.get(k);
    if (existing) {
      existing.value = data.state;
    } else {
      this.pins.set(k, {
        port: data.port,
        pin: data.pin,
        direction: "output",
        mode: "output_pp",
        value: data.state,
      });
    }
  }

  /**
   * Get a specific pin's state.
   */
  getPin(port: string, pin: number): PinState | undefined {
    return this.pins.get(this.key(port, pin));
  }

  /**
   * Get all pins sorted by port then pin number.
   */
  getAllPins(): PinState[] {
    return Array.from(this.pins.values()).sort((a, b) => {
      if (a.port !== b.port) return a.port.localeCompare(b.port);
      return a.pin - b.pin;
    });
  }

  /**
   * Clear all pin state. Called when starting a new simulation.
   */
  reset(): void {
    this.pins.clear();
  }
}
