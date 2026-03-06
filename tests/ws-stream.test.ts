/**
 * @module tests/ws-stream
 * @description WebSocket integration tests for real-time GPIO event streaming
 *
 * Tests the full pipeline: compile blink sample -> start simulation ->
 * connect WebSocket -> receive GPIO events -> verify event types and content.
 * Also tests disconnect cleanup (simulation stops when last client disconnects).
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Subprocess } from "bun";

const PORT = 3002;
const BASE = `http://localhost:${PORT}`;
const WS_BASE = `ws://localhost:${PORT}`;

let serverProc: Subprocess;

beforeAll(async () => {
  // Start the server as a subprocess on a test port
  serverProc = Bun.spawn(["bun", "run", "src/server/index.ts"], {
    env: { ...process.env, PORT: String(PORT) },
    stdout: "pipe",
    stderr: "pipe",
  });

  // Wait for the server to be ready
  const maxWait = 10_000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`${BASE}/api/samples`);
      if (res.ok) break;
    } catch {
      // Server not ready yet
    }
    await Bun.sleep(200);
  }
});

afterAll(() => {
  if (serverProc) {
    serverProc.kill();
  }
});

/**
 * Helper: compile blink sample and start a simulation.
 * Returns { compilationId, simulationId }.
 */
async function compileAndRun(speed = 100, timeout = 10000) {
  const blinkCode = readFileSync(
    join(process.cwd(), "samples/blink/main.c"),
    "utf-8"
  );

  const compileRes = await fetch(`${BASE}/api/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: blinkCode }),
  });
  const compileData = await compileRes.json();
  if (!compileData.success) {
    throw new Error(`Compilation failed: ${JSON.stringify(compileData.errors)}`);
  }

  const runRes = await fetch(`${BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compilationId: compileData.compilationId,
      speed,
      timeout,
    }),
  });
  const runData = await runRes.json();

  return {
    compilationId: compileData.compilationId,
    simulationId: runData.simulationId,
  };
}

describe("WebSocket event streaming", () => {
  it("connects and receives simulation events", async () => {
    const { simulationId } = await compileAndRun(100, 10000);

    const events: any[] = [];

    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=${simulationId}`
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Timed out waiting for simulation events"));
      }, 8000);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        events.push(data);

        // Accept any simulation event (sim_start may arrive before WS connects,
        // so gpio_write/gpio_init events prove the stream is working)
        if (events.length >= 1) {
          clearTimeout(timeout);
          resolve();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });

    ws.close();

    // Verify we received at least one valid simulation event
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]).toHaveProperty("type");
    expect(events[0]).toHaveProperty("timestamp_ms");

    // Clean up
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
  }, 15_000);

  it("receives gpio_write events with port A, pin 5", async () => {
    const { simulationId } = await compileAndRun(100, 10000);

    const events: any[] = [];

    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=${simulationId}`
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Resolve even if we didn't get gpio_write -- we'll check below
        resolve();
      }, 5000);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        events.push(data);

        // Once we have some gpio_write events, resolve early
        const gpioWrites = events.filter((e) => e.type === "gpio_write");
        if (gpioWrites.length >= 2) {
          clearTimeout(timeout);
          resolve();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });

    ws.close();

    // Verify we received gpio_write events
    const gpioWrites = events.filter((e) => e.type === "gpio_write");
    expect(gpioWrites.length).toBeGreaterThanOrEqual(1);

    // Check that at least one event is for port A, pin 5
    const pa5Events = gpioWrites.filter(
      (e) => e.data?.port === "A" && e.data?.pin === 5
    );
    expect(pa5Events.length).toBeGreaterThanOrEqual(1);

    // Verify events are valid JSON with expected structure
    for (const event of events) {
      expect(event).toHaveProperty("type");
      expect(typeof event.type).toBe("string");
      expect(event).toHaveProperty("timestamp_ms");
      expect(typeof event.timestamp_ms).toBe("number");
    }

    // Clean up
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
  }, 15_000);

  it("receives sim_exit event when simulation is stopped", async () => {
    const { simulationId } = await compileAndRun(100, 10000);

    const events: any[] = [];
    let gotSimExit = false;

    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=${simulationId}`
    );

    const exitPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(); // Resolve even on timeout -- we'll check below
      }, 8000);

      ws.onopen = async () => {
        // Wait a moment for subscription, then stop the simulation
        await Bun.sleep(500);
        await fetch(`${BASE}/api/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simulationId }),
        });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        events.push(data);

        if (data.type === "sim_exit") {
          gotSimExit = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });

    await exitPromise;
    ws.close();

    expect(gotSimExit).toBe(true);
    const exitEvent = events.find((e) => e.type === "sim_exit");
    expect(exitEvent).toBeDefined();
    expect(exitEvent.data).toHaveProperty("exitCode");
  }, 15_000);

  it("simulation stops when last WebSocket client disconnects", async () => {
    const { simulationId } = await compileAndRun(100, 10000);

    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=${simulationId}`
    );

    // Wait for connection to open and receive at least one event
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 3000);
      ws.onmessage = () => {
        clearTimeout(timeout);
        resolve();
      };
      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });

    // Close the WebSocket (last client disconnect should trigger simulation stop)
    ws.close();

    // Wait for the simulation to be cleaned up
    await Bun.sleep(1000);

    // Try to stop the simulation -- should return 404 because it was already
    // cleaned up by the disconnect handler
    const stopRes = await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });

    expect(stopRes.status).toBe(404);
  }, 15_000);
});
