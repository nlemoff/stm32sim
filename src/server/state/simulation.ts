/**
 * @module simulation
 * @description Active simulation registry (Map by ID)
 *
 * Stores all currently running simulations, keyed by their unique ID.
 * The process-manager module adds/removes entries as simulations
 * start and stop.
 */

import type { Subprocess } from "bun";

/**
 * State of a single running simulation.
 */
export interface SimulationState {
  id: string;
  process: Subprocess;
  binaryPath: string;
  compilationId: string;
  timeout: Timer | null;
  startedAt: number;
  speed: number;
}

/**
 * Global store of all active simulations, keyed by simulation ID.
 */
export const simulationStore = new Map<string, SimulationState>();
