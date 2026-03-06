/**
 * Process Manager Tests
 *
 * Tests for COMP-02: subprocess management -- spawn, stream events,
 * timeout enforcement, multi-simulation tracking, cleanup.
 *
 * Uses the compile() function from Task 1 to produce a binary
 * from the blink sample, then tests the runner against it.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { compile, cleanupCompilation } from "../src/server/compiler/compile";
import {
  startSimulation,
  stopSimulation,
  getSimulation,
  stopAllSimulations,
} from "../src/server/runner/process-manager";
import type { SimulationEvent } from "../src/server/runner/stdout-parser";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");

let compilationId: string;
let binaryPath: string;

beforeAll(async () => {
  // Compile the blink sample once for all tests
  const blinkCode = await readFile(
    join(PROJECT_ROOT, "samples", "blink", "main.c"),
    "utf-8"
  );
  const result = await compile(blinkCode);
  if (!result.success || !result.compilationId || !result.binaryPath) {
    throw new Error(`Failed to compile blink sample: ${result.rawOutput}`);
  }
  compilationId = result.compilationId;
  binaryPath = result.binaryPath;
});

afterAll(async () => {
  // Kill any remaining simulations
  stopAllSimulations();
  // Clean up compiled binary
  if (compilationId && binaryPath) {
    await cleanupCompilation(compilationId, binaryPath);
  }
});

describe("Process Manager", () => {
  test("Test 1: startSimulation spawns subprocess and returns simulation ID", async () => {
    const events: SimulationEvent[] = [];
    let exited = false;

    const simId = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000, // Fast speed for testing
      timeoutMs: 5000,
      onEvent: (event) => events.push(event),
      onExit: () => {
        exited = true;
      },
    });

    expect(typeof simId).toBe("string");
    expect(simId.length).toBeGreaterThan(0);

    // Give it a moment to start
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should be running
    const sim = getSimulation(simId);
    expect(sim).toBeDefined();

    // Cleanup
    stopSimulation(simId);
  }, 10000);

  test("Test 2: simulation stdout emits parseable SimulationEvent objects via callback", async () => {
    const events: SimulationEvent[] = [];

    const simId = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000,
      timeoutMs: 5000,
      onEvent: (event) => events.push(event),
    });

    // Wait for some events to come in
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(events.length).toBeGreaterThan(0);

    // Each event should be a valid SimulationEvent
    for (const event of events) {
      expect(typeof event.type).toBe("string");
      expect(typeof event.timestamp_ms).toBe("number");
      expect(event.data).toBeDefined();
    }

    stopSimulation(simId);
  }, 10000);

  test("Test 3: events include sim_start and gpio_write types with correct structure", async () => {
    const events: SimulationEvent[] = [];

    const simId = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000,
      timeoutMs: 5000,
      onEvent: (event) => events.push(event),
    });

    // Wait for events including at least one gpio_write (after delay)
    await new Promise((resolve) => setTimeout(resolve, 500));

    const simStart = events.find((e) => e.type === "sim_start");
    expect(simStart).toBeDefined();
    expect(simStart!.timestamp_ms).toBe(0);
    expect(simStart!.data).toHaveProperty("speed");

    const gpioWrite = events.find((e) => e.type === "gpio_write");
    expect(gpioWrite).toBeDefined();
    expect(gpioWrite!.data).toHaveProperty("port");
    expect(gpioWrite!.data).toHaveProperty("pin");
    expect(gpioWrite!.data).toHaveProperty("state");

    stopSimulation(simId);
  }, 10000);

  test("Test 4: stopSimulation kills the subprocess (process exits)", async () => {
    let exitCalled = false;

    const simId = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000,
      timeoutMs: 10000,
      onEvent: () => {},
      onExit: () => {
        exitCalled = true;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const result = stopSimulation(simId);
    expect(result).toBe(true);

    // Wait for exit callback
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(exitCalled).toBe(true);

    // getSimulation should return undefined after stop
    expect(getSimulation(simId)).toBeUndefined();
  }, 10000);

  test("Test 5: simulation auto-terminates after configurable timeout", async () => {
    let exitCalled = false;

    const simId = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000,
      timeoutMs: 1500, // Short timeout for test
      onEvent: () => {},
      onExit: () => {
        exitCalled = true;
      },
    });

    // Should still be running at 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(getSimulation(simId)).toBeDefined();

    // Wait past the timeout (1500ms + buffer)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Should have been auto-killed
    expect(exitCalled).toBe(true);
    expect(getSimulation(simId)).toBeUndefined();
  }, 10000);

  test("Test 6: getSimulation returns simulation state while running, undefined after stopped", async () => {
    const simId = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000,
      timeoutMs: 5000,
      onEvent: () => {},
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should return state while running
    const state = getSimulation(simId);
    expect(state).toBeDefined();
    expect(state!.id).toBe(simId);
    expect(state!.binaryPath).toBe(binaryPath);
    expect(state!.compilationId).toBe(compilationId);

    // Stop it
    stopSimulation(simId);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should return undefined
    expect(getSimulation(simId)).toBeUndefined();
  }, 10000);

  test("Test 7: onExit callback fires when process exits naturally or is killed", async () => {
    let exitCode: number | null = null;
    let exitSignal: string | null = null;

    const simId = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000,
      timeoutMs: 5000,
      onEvent: () => {},
      onExit: (code, signal) => {
        exitCode = code;
        exitSignal = signal;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    stopSimulation(simId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // onExit should have fired with either a code or signal
    expect(exitCode !== null || exitSignal !== null).toBe(true);
  }, 10000);

  test("Test 8: multiple concurrent simulations are tracked independently", async () => {
    const events1: SimulationEvent[] = [];
    const events2: SimulationEvent[] = [];

    const simId1 = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000,
      timeoutMs: 5000,
      onEvent: (event) => events1.push(event),
    });

    const simId2 = await startSimulation({
      compilationId,
      binaryPath,
      speed: 1000,
      timeoutMs: 5000,
      onEvent: (event) => events2.push(event),
    });

    expect(simId1).not.toBe(simId2);

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Both should be running
    expect(getSimulation(simId1)).toBeDefined();
    expect(getSimulation(simId2)).toBeDefined();

    // Both should have received events
    expect(events1.length).toBeGreaterThan(0);
    expect(events2.length).toBeGreaterThan(0);

    // Stop first, second should still be running
    stopSimulation(simId1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(getSimulation(simId1)).toBeUndefined();
    expect(getSimulation(simId2)).toBeDefined();

    // Cleanup
    stopSimulation(simId2);
  }, 10000);
});
