/**
 * @module tests/spi-i2c-loopback
 * @description Integration tests for SPI/I2C loopback events over WebSocket
 *
 * Tests the full pipeline: compile spi-loopback sample -> start simulation ->
 * connect WebSocket -> receive spi_transfer events -> verify content.
 * Covers requirements: SPII-01, SPII-02.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Subprocess } from "bun";

const PORT = 3005;
const BASE = `http://localhost:${PORT}`;
const WS_BASE = `ws://localhost:${PORT}`;

let serverProc: Subprocess;

beforeAll(async () => {
  serverProc = Bun.spawn(["bun", "run", "src/server/index.ts"], {
    env: { ...process.env, PORT: String(PORT) },
    stdout: "pipe",
    stderr: "pipe",
  });

  // Wait for the server to be ready (poll until it responds)
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
 * Helper: compile spi-loopback sample and start a simulation.
 * Returns { compilationId, simulationId }.
 */
async function compileAndRunSpiLoopback(speed = 100, timeout = 10000) {
  const code = readFileSync(
    join(process.cwd(), "samples/spi-loopback/main.c"),
    "utf-8",
  );

  const compileRes = await fetch(`${BASE}/api/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const compileData = await compileRes.json();
  if (!compileData.success) {
    throw new Error(
      `Compilation failed: ${JSON.stringify(compileData.errors)}`,
    );
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

describe("SPI/I2C event streaming", () => {
  it("spi-loopback sample emits spi_transfer events over WebSocket", async () => {
    const { simulationId } = await compileAndRunSpiLoopback(100, 10000);
    const events: any[] = [];

    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=${simulationId}`,
    );

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve(); // Resolve on timeout -- check events below
      }, 5000);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        events.push(data);

        // Resolve early once we have a spi_transfer event
        const spiEvents = events.filter((e: any) => e.type === "spi_transfer");
        if (spiEvents.length >= 1) {
          clearTimeout(timeoutId);
          resolve();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeoutId);
        reject(err);
      };
    });

    ws.close();

    // Verify we received at least one spi_transfer event
    const spiEvents = events.filter((e: any) => e.type === "spi_transfer");
    expect(spiEvents.length).toBeGreaterThanOrEqual(1);

    // Verify the spi_transfer event contains the expected hex payload
    const firstSpi = spiEvents[0];
    expect(firstSpi.data.data).toContain("DE AD BE EF");
    expect(firstSpi.data.direction).toBe("txrx");
    expect(firstSpi.data.size).toBe(4);

    // Clean up
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
  }, 15_000);

  it("spi_transfer events include timestamp", async () => {
    // Use speed=100 to get fast events (HAL_Delay(1000) -> 10ms real)
    const { simulationId } = await compileAndRunSpiLoopback(100, 10000);
    const events: any[] = [];

    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=${simulationId}`,
    );

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve(); // Resolve on timeout -- check events below
      }, 5000);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        events.push(data);

        // Wait for at least 2 spi_transfer events to compare timestamps
        const spiEvents = events.filter((e: any) => e.type === "spi_transfer");
        if (spiEvents.length >= 2) {
          clearTimeout(timeoutId);
          resolve();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeoutId);
        reject(err);
      };
    });

    ws.close();

    // Verify we have at least 2 spi_transfer events
    const spiEvents = events.filter((e: any) => e.type === "spi_transfer");
    expect(spiEvents.length).toBeGreaterThanOrEqual(2);

    // Verify each event has a timestamp_ms field that is a positive number
    for (const evt of spiEvents) {
      expect(evt).toHaveProperty("timestamp_ms");
      expect(typeof evt.timestamp_ms).toBe("number");
      expect(evt.timestamp_ms).toBeGreaterThanOrEqual(0);
    }

    // Verify second event's timestamp > first event's timestamp (time passes)
    expect(spiEvents[1].timestamp_ms).toBeGreaterThan(spiEvents[0].timestamp_ms);

    // Clean up
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
  }, 15_000);
});
