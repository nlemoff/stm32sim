/**
 * @module client/gpio/button-panel
 * @description Virtual button panel for GPIO input simulation.
 * Creates interactive buttons that send press/release signals via callback.
 */

type PressCallback = (port: string, pin: number, state: number) => void;

let container: HTMLElement;
let onPress: PressCallback;
const buttons = new Map<string, HTMLElement>();

function key(port: string, pin: number): string {
  return `${port}:${pin}`;
}

/**
 * Initialize the button panel with its container and press callback.
 * The callback is invoked with (port, pin, 1) on press and (port, pin, 0) on release.
 */
export function initButtonPanel(
  el: HTMLElement,
  callback: PressCallback
): void {
  container = el;
  onPress = callback;
}

/**
 * Add a virtual button for the given input pin.
 * Button shows label "P{port}{pin}" (e.g., "PA0").
 * Mousedown sends state=1 (pressed), mouseup/mouseleave sends state=0 (released).
 */
export function addButton(port: string, pin: number): void {
  const k = key(port, pin);
  if (buttons.has(k)) return; // Avoid duplicates

  const btn = document.createElement("div");
  btn.className = "vbtn";
  btn.textContent = `P${port}${pin}`;
  btn.dataset.port = port;
  btn.dataset.pin = String(pin);

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    onPress(port, pin, 1);
  });

  btn.addEventListener("mouseup", () => {
    onPress(port, pin, 0);
  });

  btn.addEventListener("mouseleave", () => {
    onPress(port, pin, 0);
  });

  // Touch support for mobile
  btn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    onPress(port, pin, 1);
  });

  btn.addEventListener("touchend", () => {
    onPress(port, pin, 0);
  });

  container.appendChild(btn);
  buttons.set(k, btn);
}

/**
 * Remove all button elements and clear the internal map.
 */
export function clearButtons(): void {
  for (const btn of buttons.values()) {
    btn.remove();
  }
  buttons.clear();
}
