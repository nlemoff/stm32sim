/**
 * @module client/uart/uart-terminal
 * @description xterm.js terminal for UART serial I/O.
 * Renders firmware UART output and captures user keyboard input
 * for bidirectional serial communication.
 */
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;

/**
 * Initialize the xterm.js terminal inside the given container.
 * @param container - DOM element to mount the terminal into
 * @param onInput - callback fired when user types; sends data to firmware via WebSocket
 */
export function initUartTerminal(
  container: HTMLElement,
  onInput: (data: string) => void
): void {
  terminal = new Terminal({
    cursorBlink: true,
    convertEol: true, // CRITICAL: converts \n to \r\n (Pitfall 6)
    fontSize: 14,
    fontFamily: '"Cascadia Code", "Fira Code", monospace',
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      cursor: "#d4d4d4",
    },
    disableStdin: false,
    scrollback: 1000,
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  terminal.open(container);
  fitAddon.fit();

  // Capture user input -- do NOT echo locally;
  // let firmware echo via HAL_UART_Transmit if it wants
  terminal.onData((data) => {
    onInput(data);
  });

  // Re-fit terminal when container resizes (Pitfall 3)
  const resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit();
  });
  resizeObserver.observe(container);
}

/**
 * Write data (firmware UART output) to the terminal.
 */
export function writeToTerminal(data: string): void {
  terminal?.write(data);
}

/**
 * Clear all terminal content and reset state for a new simulation run.
 */
export function clearTerminal(): void {
  terminal?.clear();
  terminal?.reset();
}
