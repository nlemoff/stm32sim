/**
 * @module process-manager
 * @description Subprocess spawn, timeout, kill, cleanup
 *
 * Manages simulation subprocesses: spawns compiled firmware binaries,
 * streams their stdout as SimulationEvent objects, enforces timeout,
 * and handles cleanup on stop or exit.
 */
import { simulationStore, type SimulationState } from "../state/simulation";
import { streamEvents, type SimulationEvent } from "./stdout-parser";

/**
 * Options for starting a simulation.
 */
export interface StartOptions {
  compilationId: string;
  binaryPath: string;
  speed?: number;
  timeoutMs?: number;
  onEvent?: (event: SimulationEvent) => void;
  onExit?: (exitCode: number | null, signal: string | null) => void;
}

/**
 * Start a simulation subprocess.
 *
 * Spawns the compiled binary, sets up stdout event streaming,
 * configures the timeout, and stores the simulation state.
 *
 * @returns The simulation ID
 */
export async function startSimulation(options: StartOptions): Promise<string> {
  const {
    compilationId,
    binaryPath,
    speed = 1.0,
    timeoutMs = 30000,
    onEvent,
    onExit,
  } = options;

  const id = crypto.randomUUID();

  const proc = Bun.spawn([binaryPath], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      SIM_SPEED: String(speed),
    },
  });

  // Set up timeout for auto-termination
  const timeout = setTimeout(() => {
    stopSimulation(id);
  }, timeoutMs);

  const simState: SimulationState = {
    id,
    process: proc,
    binaryPath,
    compilationId,
    timeout,
    startedAt: Date.now(),
    speed,
  };

  simulationStore.set(id, simState);

  // Start async stdout reading loop
  if (proc.stdout) {
    const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
    (async () => {
      try {
        for await (const event of streamEvents(reader)) {
          if (onEvent) {
            onEvent(event);
          }
        }
      } catch {
        // Stream error (process killed, etc.) -- expected during cleanup
      }
    })();
  }

  // Handle process exit
  proc.exited.then((exitCode) => {
    const signal = proc.signalCode || null;

    // Clear timeout since process has exited
    const sim = simulationStore.get(id);
    if (sim?.timeout) {
      clearTimeout(sim.timeout);
    }

    // Remove from store
    simulationStore.delete(id);

    // Notify caller
    if (onExit) {
      onExit(exitCode, signal);
    }
  });

  return id;
}

/**
 * Stop a running simulation by killing its subprocess.
 *
 * @returns true if the simulation was found and killed, false if not found
 */
export function stopSimulation(id: string): boolean {
  const sim = simulationStore.get(id);
  if (!sim) return false;

  // Kill the process
  sim.process.kill();

  // Clear timeout
  if (sim.timeout) {
    clearTimeout(sim.timeout);
  }

  // Remove from store immediately (exit handler also removes, but this is faster)
  simulationStore.delete(id);

  return true;
}

/**
 * Get the state of a running simulation.
 *
 * @returns The simulation state, or undefined if not found/already stopped
 */
export function getSimulation(id: string): SimulationState | undefined {
  return simulationStore.get(id);
}

/**
 * Stop all running simulations. Used for server shutdown.
 */
export function stopAllSimulations(): void {
  for (const [id] of simulationStore) {
    stopSimulation(id);
  }
}
