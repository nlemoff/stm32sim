/**
 * @module client/index
 * @description Application bootstrap.
 * Initializes all modules: editor, API client, WebSocket, GPIO visualization,
 * simulation controls, and error panel. Wires everything together for the
 * full write-compile-run-see loop.
 */
import { initEditor, getCode, setCode, setupFileUpload } from "./editor/editor";
import { compile, run, stop, listSamples, getSample } from "./sim/api";
import { SimConnection } from "./sim/websocket";
import { getStatus, setStatus, onStatusChange } from "./sim/state";
import { GpioState } from "./gpio/gpio-state";
import { initLedPanel, updateLed, clearLeds } from "./gpio/led-panel";
import { initPinTable, updatePinTable, clearPinTable } from "./gpio/pin-table";
import { initButtonPanel, addButton, clearButtons } from "./gpio/button-panel";
import { initToolbar } from "./controls/toolbar";
import { initErrorPanel } from "./controls/error-panel";
import { initUartTerminal, writeToTerminal } from "./uart/uart-terminal";
import { initBusLog, appendBusEntry } from "./bus/bus-log";

// --- Initialize editor ---
const editorContainer = document.getElementById("editor-container")!;
initEditor(editorContainer);

// Set up file upload
const fileInput = document.getElementById("file-upload") as HTMLInputElement;
setupFileUpload(fileInput);

// --- Create shared instances ---
const conn = new SimConnection();
const gpioState = new GpioState();

// --- Initialize GPIO panels ---
initLedPanel(document.getElementById("led-panel")!);
initPinTable(document.getElementById("pin-table")!);
initButtonPanel(
  document.getElementById("button-panel")!,
  (port, pin, state) => conn.sendGpioInput(port, pin, state)
);

// --- Initialize UART terminal ---
initUartTerminal(
  document.getElementById("uart-terminal")!,
  (data: string) => conn.sendUartInput(data)
);

// --- Initialize bus log ---
initBusLog(document.getElementById("bus-log")!);

// --- Initialize error panel ---
initErrorPanel(document.getElementById("error-panel")!);

// --- Initialize toolbar ---
initToolbar({
  getCode,
  compile,
  run,
  stop,
  setStatus,
  getStatus,
  onStatusChange,
  conn,
  gpioState,
});

// --- Register WebSocket event handlers ---

// gpio_init: create pin state entries, update table, auto-add buttons for input pins
conn.on("gpio_init", (event) => {
  const data = event.data as { port: string; pins: number[]; mode: string };
  gpioState.handleGpioInit(data);
  updatePinTable(gpioState.getAllPins());

  // Auto-add virtual buttons for input pins
  if (data.mode === "input") {
    for (const pin of data.pins) {
      addButton(data.port, pin);
    }
  }
});

// gpio_write: update state, LED, and pin table
conn.on("gpio_write", (event) => {
  const data = event.data as { port: string; pin: number; state: number };
  gpioState.handleGpioWrite(data);
  updateLed(data.port, data.pin, data.state);
  updatePinTable(gpioState.getAllPins());
});

// uart_tx: write firmware UART output to the terminal
conn.on("uart_tx", (event) => {
  const data = event.data as { data: string; size: number };
  writeToTerminal(data.data);
});

// spi_transfer: append to bus log
conn.on("spi_transfer", (event) => {
  appendBusEntry("SPI", event.timestamp_ms, event.data);
});

// i2c_transfer: append to bus log
conn.on("i2c_transfer", (event) => {
  appendBusEntry("I2C", event.timestamp_ms, event.data);
});

// sim_exit: toolbar handles button state, we just ensure status updates
conn.on("sim_exit", () => {
  setStatus("stopped");
});

// --- Load samples into dropdown ---
const sampleSelect = document.getElementById("sample-select") as HTMLSelectElement;

async function loadSamples() {
  try {
    const data = await listSamples();
    if (data.samples && Array.isArray(data.samples)) {
      for (const sample of data.samples) {
        const option = document.createElement("option");
        option.value = sample.name;
        option.textContent = sample.title || sample.name;
        sampleSelect.appendChild(option);
      }
    }
  } catch (err) {
    console.warn("Failed to load samples:", err);
  }
}

// Handle sample selection
sampleSelect.addEventListener("change", async () => {
  const name = sampleSelect.value;
  if (!name) return;
  try {
    const sample = await getSample(name);
    if (sample.code) {
      setCode(sample.code);
    }
  } catch (err) {
    console.error("Failed to load sample:", err);
  }
});

loadSamples();
