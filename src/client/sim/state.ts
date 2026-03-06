/**
 * @module client/sim/state
 * @description Simulation state machine.
 * Tracks the current simulation lifecycle status and notifies listeners.
 */

export type SimStatus = "idle" | "compiling" | "running" | "stopped" | "error";

type StatusListener = (status: SimStatus, detail?: string) => void;

let currentStatus: SimStatus = "idle";
const listeners: StatusListener[] = [];

/**
 * Get the current simulation status.
 */
export function getStatus(): SimStatus {
  return currentStatus;
}

/**
 * Update the simulation status and notify all listeners.
 */
export function setStatus(status: SimStatus, detail?: string): void {
  currentStatus = status;
  for (const fn of listeners) {
    fn(status, detail);
  }
}

/**
 * Register a listener that fires whenever the simulation status changes.
 */
export function onStatusChange(fn: StatusListener): void {
  listeners.push(fn);
}
