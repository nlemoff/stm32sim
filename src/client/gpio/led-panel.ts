/**
 * @module client/gpio/led-panel
 * @description Virtual LED rendering module.
 * Creates and updates circular LED indicators for GPIO output pins.
 */

let container: HTMLElement;
const leds = new Map<string, HTMLElement>();

function key(port: string, pin: number): string {
  return `${port}:${pin}`;
}

/**
 * Initialize the LED panel with its container element.
 */
export function initLedPanel(el: HTMLElement): void {
  container = el;
}

/**
 * Update or create an LED indicator for the given port:pin.
 * state=1 turns it on (led-on), state=0 turns it off (led-off).
 */
export function updateLed(port: string, pin: number, state: number): void {
  const k = key(port, pin);
  let wrapper = leds.get(k);

  if (!wrapper) {
    // Create new LED element
    wrapper = document.createElement("div");
    wrapper.style.display = "inline-flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.margin = "4px";

    const dot = document.createElement("div");
    dot.className = "led led-off";
    dot.dataset.port = port;
    dot.dataset.pin = String(pin);

    const label = document.createElement("span");
    label.className = "led-label";
    label.textContent = `P${port}${pin}`;

    wrapper.appendChild(dot);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
    leds.set(k, wrapper);
  }

  const dot = wrapper.querySelector(".led") as HTMLElement;
  dot.className = state ? "led led-on" : "led led-off";
  dot.dataset.port = port;
}

/**
 * Remove all LED elements and clear the internal map.
 * Must be called when starting a new simulation (Pitfall 2).
 */
export function clearLeds(): void {
  for (const wrapper of leds.values()) {
    wrapper.remove();
  }
  leds.clear();
}
