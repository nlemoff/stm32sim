/**
 * @module client/controls/toolbar
 * @description Simulation control toolbar.
 * Wires up Run/Stop buttons, speed selector, and status badge.
 * Accepts dependencies via init to avoid circular imports.
 */

import type { SimConnection } from "../sim/websocket";
import type { SimStatus } from "../sim/state";
import { showErrors, clearErrors } from "./error-panel";
import { clearLeds } from "../gpio/led-panel";
import { clearPinTable } from "../gpio/pin-table";
import { clearButtons } from "../gpio/button-panel";
import { clearTerminal } from "../uart/uart-terminal";
import { clearBusLog } from "../bus/bus-log";
import type { GpioState } from "../gpio/gpio-state";

export interface ToolbarDeps {
  getCode: () => string;
  compile: (code: string) => Promise<any>;
  run: (compilationId: string, speed?: number) => Promise<any>;
  stop: (simulationId: string) => Promise<any>;
  setStatus: (status: SimStatus, detail?: string) => void;
  getStatus: () => SimStatus;
  onStatusChange: (fn: (status: SimStatus, detail?: string) => void) => void;
  conn: SimConnection;
  gpioState: GpioState;
}

/**
 * Initialize the toolbar controls: Run/Stop buttons, speed selector, status badge.
 * Wires event handlers for the compile-run-stop lifecycle.
 */
export function initToolbar(deps: ToolbarDeps): void {
  const {
    getCode,
    compile,
    run,
    stop,
    setStatus,
    getStatus,
    onStatusChange,
    conn,
    gpioState,
  } = deps;

  const btnRun = document.getElementById("btn-run") as HTMLButtonElement;
  const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
  const speedSelect = document.getElementById("speed-select") as HTMLSelectElement;
  const statusBadge = document.getElementById("status-badge") as HTMLElement;

  // Track the current simulation ID for stop
  let currentSimulationId: string | null = null;
  let userInitiatedStop = false;

  // Enable Run button (initially disabled in HTML)
  btnRun.disabled = false;

  // Populate speed selector with additional options beyond what HTML has
  const speedOptions = [
    { value: "0.25", label: "0.25x" },
    { value: "0.5", label: "0.5x" },
    { value: "1", label: "1x" },
    { value: "2", label: "2x" },
    { value: "5", label: "5x" },
    { value: "10", label: "10x" },
  ];

  // Replace existing options with the full set
  speedSelect.innerHTML = "";
  for (const opt of speedOptions) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === "1") option.selected = true;
    speedSelect.appendChild(option);
  }

  // --- Run button handler ---
  btnRun.addEventListener("click", async () => {
    // Reset state for new run (Pitfall 2: clear all visualization)
    clearErrors();
    clearLeds();
    clearPinTable();
    clearButtons();
    clearTerminal();
    clearBusLog();
    gpioState.reset();

    // Disable Run, enable Stop
    btnRun.disabled = true;
    btnStop.disabled = false;
    userInitiatedStop = false;

    // Step 1: Compile
    setStatus("compiling");
    let compileResult: any;
    try {
      compileResult = await compile(getCode());
    } catch (err: any) {
      showErrors([{ message: err.message || "Compilation request failed" }]);
      setStatus("error", err.message);
      btnRun.disabled = false;
      btnStop.disabled = true;
      return;
    }

    // Check if compilation had errors
    if (!compileResult.success) {
      showErrors(compileResult.errors || [{ message: "Compilation failed" }]);
      setStatus("error");
      btnRun.disabled = false;
      btnStop.disabled = true;
      return;
    }

    // Step 2: Run simulation
    const speed = parseFloat(speedSelect.value);
    setStatus("running");

    let runResult: any;
    try {
      runResult = await run(compileResult.compilationId, speed);
    } catch (err: any) {
      showErrors([{ message: err.message || "Failed to start simulation" }]);
      setStatus("error", err.message);
      btnRun.disabled = false;
      btnStop.disabled = true;
      return;
    }

    currentSimulationId = runResult.simulationId;

    // Step 3: Connect WebSocket for GPIO events
    // Per Pitfall 1: set status to 'running' from API response, not WS event
    conn.connect(runResult.simulationId);
  });

  // --- Stop button handler ---
  btnStop.addEventListener("click", async () => {
    if (!currentSimulationId) return;
    userInitiatedStop = true;

    try {
      await stop(currentSimulationId);
    } catch (err) {
      // Even if stop API fails, disconnect and reset UI
      console.warn("Stop API error:", err);
    }

    conn.disconnect();
    setStatus("stopped");
    btnRun.disabled = false;
    btnStop.disabled = true;
    currentSimulationId = null;
  });

  // --- Handle sim_exit WebSocket event ---
  conn.on("sim_exit", () => {
    setStatus("stopped");
    btnRun.disabled = false;
    btnStop.disabled = true;
    currentSimulationId = null;
  });

  // --- Handle unexpected WebSocket close ---
  conn.onClose(() => {
    if (!userInitiatedStop && getStatus() === "running") {
      setStatus("stopped");
      btnRun.disabled = false;
      btnStop.disabled = true;
      currentSimulationId = null;
    }
  });

  // --- Status badge updates ---
  const statusLabels: Record<SimStatus, string> = {
    idle: "Idle",
    compiling: "Compiling",
    running: "Running",
    stopped: "Stopped",
    error: "Error",
  };

  function updateBadge(status: SimStatus): void {
    statusBadge.textContent = statusLabels[status];
    statusBadge.className = `status-${status}`;
  }

  onStatusChange(updateBadge);

  // Set initial badge state
  updateBadge(getStatus());
}
