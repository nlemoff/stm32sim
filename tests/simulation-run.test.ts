/**
 * @module tests/simulation-run
 * @description Full compile-run-stop pipeline integration tests (REST API)
 *
 * Tests the complete HTTP API flow: compile code, run simulation, stop it,
 * and list/get sample programs. Starts a real server on a test port.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Subprocess } from "bun";

const PORT = 3001;
const BASE = `http://localhost:${PORT}`;

let serverProc: Subprocess;

beforeAll(async () => {
  // Start the server as a subprocess on a test port
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

describe("POST /api/compile", () => {
  it("compiles blink sample successfully", async () => {
    const blinkCode = readFileSync(
      join(process.cwd(), "samples/blink/main.c"),
      "utf-8"
    );

    const res = await fetch(`${BASE}/api/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: blinkCode }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.compilationId).toBeDefined();
    expect(typeof data.compilationId).toBe("string");
    expect(data.errors).toEqual([]);
  }, 15_000);

  it("returns structured errors for invalid code", async () => {
    const badCode = `
      #include "stm32f4xx_hal.h"
      int main(void) {
        undeclared_function();
        return 0;
      }
    `;

    const res = await fetch(`${BASE}/api/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: badCode }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.errors.length).toBeGreaterThan(0);
    expect(data.errors[0]).toHaveProperty("message");
    expect(data.errors[0]).toHaveProperty("severity");
  }, 15_000);
});

describe("POST /api/run", () => {
  it("starts simulation with valid compilationId", async () => {
    // First compile something
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
    expect(compileData.success).toBe(true);

    // Now run it
    const runRes = await fetch(`${BASE}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compilationId: compileData.compilationId,
        speed: 100,
        timeout: 5000,
      }),
    });

    expect(runRes.status).toBe(200);
    const runData = await runRes.json();
    expect(runData.simulationId).toBeDefined();
    expect(typeof runData.simulationId).toBe("string");
    expect(runData.wsUrl).toContain("ws://localhost:");
    expect(runData.wsUrl).toContain("simulationId=");

    // Clean up -- stop the simulation
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId: runData.simulationId }),
    });
  }, 15_000);

  it("returns 404 for invalid compilationId", async () => {
    const res = await fetch(`${BASE}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compilationId: "nonexistent-id" }),
    });

    expect(res.status).toBe(404);
  }, 15_000);
});

describe("POST /api/stop", () => {
  it("stops a running simulation", async () => {
    // Compile and run first
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

    const runRes = await fetch(`${BASE}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compilationId: compileData.compilationId,
        speed: 100,
        timeout: 10000,
      }),
    });
    const runData = await runRes.json();

    // Now stop it
    const stopRes = await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId: runData.simulationId }),
    });

    expect(stopRes.status).toBe(200);
    const stopData = await stopRes.json();
    expect(stopData.stopped).toBe(true);
  }, 15_000);
});

describe("GET /api/samples", () => {
  it("returns array with all sample firmware programs", async () => {
    const res = await fetch(`${BASE}/api/samples`);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(5);

    const names = data.map((s: any) => s.name);
    expect(names).toContain("blink");
    expect(names).toContain("knight-rider");
    expect(names).toContain("button-led");
    expect(names).toContain("uart-hello");
    expect(names).toContain("spi-loopback");

    // Each sample should have title and description
    for (const sample of data) {
      expect(sample).toHaveProperty("title");
      expect(sample).toHaveProperty("description");
      expect(typeof sample.title).toBe("string");
      expect(typeof sample.description).toBe("string");
    }
  }, 15_000);
});

describe("GET /api/samples/:name", () => {
  it("returns blink sample source code", async () => {
    const res = await fetch(`${BASE}/api/samples/blink`);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("blink");
    expect(Array.isArray(data.files)).toBe(true);
    expect(data.files.length).toBe(1);
    expect(data.files[0].name).toBe("main.c");
    expect(data.files[0].content).toContain("HAL_GPIO_TogglePin");
    expect(data.files[0].content).toContain("GPIO_PIN_5");
  }, 15_000);
});
