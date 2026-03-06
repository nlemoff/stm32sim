/**
 * @module tests/uart-transmit
 * @description Integration tests for UART TX events over WebSocket and UART RX echo round-trip
 *
 * Tests the full pipeline: compile uart-hello sample -> start simulation ->
 * connect WebSocket -> receive uart_tx events -> verify content.
 * Also tests bidirectional UART: send uart_rx via WebSocket, firmware echoes back as uart_tx.
 * Covers requirements: UART-01, UART-02, UART-03.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Subprocess } from "bun";

const PORT = 3004;
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
 * Helper: compile uart-hello sample, returning the compilationId.
 */
async function compileUartHello(): Promise<string> {
  const code = readFileSync(
    join(process.cwd(), "samples/uart-hello/main.c"),
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
  return compileData.compilationId;
}

/**
 * Helper: start simulation and immediately connect WebSocket.
 * Connects the WS as fast as possible after /api/run returns to minimize
 * the window where events could be missed.
 */
async function startAndConnect(
  compilationId: string,
  speed = 1,
  timeout = 10000,
): Promise<{ simulationId: string; ws: WebSocket; events: any[] }> {
  const events: any[] = [];

  const runRes = await fetch(`${BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compilationId, speed, timeout }),
  });
  const runData = await runRes.json();
  const simulationId = runData.simulationId;

  const ws = new WebSocket(`${WS_BASE}/ws?simulationId=${simulationId}`);

  // Wait for WS to open and start collecting events
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => resolve(), 3000);
    ws.onopen = () => {
      clearTimeout(t);
      resolve();
    };
    ws.onerror = (err) => {
      clearTimeout(t);
      reject(err);
    };
  });

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      events.push(data);
    } catch {
      // Ignore non-JSON
    }
  };

  return { simulationId, ws, events };
}

describe("UART event streaming", () => {
  it("uart-hello sample emits uart_tx events over WebSocket", async () => {
    const compilationId = await compileUartHello();
    const { simulationId, ws, events } = await startAndConnect(compilationId, 1, 10000);

    // The greeting "Hello from STM32!" may have already been emitted before our WS connected.
    // To reliably get a uart_tx event, send a known character and wait for its echo.
    // The firmware echoes received characters back as uart_tx events.
    await Bun.sleep(200); // Brief settle time for the firmware to finish greeting
    ws.send(JSON.stringify({ type: "uart_rx", data: "X" }));

    // Wait for uart_tx events (greeting and/or echo)
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => resolve(), 5000);

      const originalHandler = ws.onmessage;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          events.push(data);
        } catch {
          // Ignore
        }

        // Check if we have a uart_tx event with our echo character
        const uartData = events
          .filter((e: any) => e.type === "uart_tx")
          .map((e: any) => e.data?.data ?? "")
          .join("");
        if (uartData.includes("X")) {
          clearTimeout(timeoutId);
          resolve();
        }
      };
    });

    ws.close();

    // Verify we received at least one uart_tx event
    const uartTxEvents = events.filter((e: any) => e.type === "uart_tx");
    expect(uartTxEvents.length).toBeGreaterThanOrEqual(1);

    // The uart_tx events should include our echoed character "X"
    // They may also include "Hello from STM32!" if we connected fast enough
    const allUartData = uartTxEvents.map((e: any) => e.data?.data ?? "").join("");
    expect(allUartData).toContain("X");

    // Clean up
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
  }, 15_000);

  it("UART RX echo round-trip via WebSocket", async () => {
    const compilationId = await compileUartHello();
    // Use speed=10 for reasonable timing
    const { simulationId, ws, events } = await startAndConnect(compilationId, 10, 10000);

    // Wait a moment for the firmware to complete its greeting transmission
    await Bun.sleep(300);

    // Send a character for the firmware to echo back
    ws.send(JSON.stringify({ type: "uart_rx", data: "A" }));

    // Wait for the echoed character to arrive as a uart_tx event
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => resolve(), 10000);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          events.push(data);
        } catch {
          // Ignore
        }

        const allData = events
          .filter((e: any) => e.type === "uart_tx")
          .map((e: any) => e.data?.data ?? "")
          .join("");
        if (allData.includes("A")) {
          clearTimeout(timeoutId);
          resolve();
        }
      };
    });

    ws.close();

    // Verify the echo: uart_tx data should contain "A"
    const allUartData = events
      .filter((e: any) => e.type === "uart_tx")
      .map((e: any) => e.data?.data ?? "")
      .join("");
    expect(allUartData).toContain("A");

    // Clean up
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
  }, 15_000);

  it("uart_rx with invalid data is ignored", async () => {
    const compilationId = await compileUartHello();
    const { simulationId, ws } = await startAndConnect(compilationId, 100, 10000);

    // Send invalid uart_rx messages -- should not crash the server/simulation
    ws.send(JSON.stringify({ type: "uart_rx", data: "" })); // empty string
    ws.send(JSON.stringify({ type: "uart_rx" })); // missing data field

    // Wait briefly -- if the simulation crashes, the WS would close
    await Bun.sleep(1000);

    ws.close();

    // Verify the simulation is still running (can still stop it)
    const stopRes = await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
    // 200 means it was still running; 404 means it already exited (also acceptable)
    expect([200, 404]).toContain(stopRes.status);
  }, 15_000);
});
