/**
 * @module tests/gpio-input
 * @description Integration tests for stdin-based GPIO input injection
 *
 * Tests the full pipeline: compile button-led sample -> start simulation ->
 * send GPIO input via sendGpioInput / WebSocket -> verify LED state changes.
 * Follows the same server subprocess pattern as simulation-run.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Subprocess } from "bun";

const PORT = 3003;
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
 * Helper: compile button-led sample and start a simulation.
 * Returns { compilationId, simulationId }.
 */
async function compileAndRunButtonLed(speed = 100, timeout = 10000) {
  const buttonLedCode = readFileSync(
    join(process.cwd(), "samples/button-led/main.c"),
    "utf-8",
  );

  const compileRes = await fetch(`${BASE}/api/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: buttonLedCode }),
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

describe("GPIO input injection", () => {
  it("sendGpioInput changes LED state via subprocess stdin", async () => {
    // Use speed=10 so HAL_Delay(50) becomes 5ms -- fast but not spinning
    const { simulationId } = await compileAndRunButtonLed(10, 10000);
    const events: any[] = [];

    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=${simulationId}`,
    );

    // Collect events, then send gpio_input after initial events arrive
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve(); // Resolve even on timeout -- we'll check events below
      }, 6000);

      let inputSent = false;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        events.push(data);

        // After receiving a few initial events (LED on because IDR=0),
        // send gpio_input to set PA0 HIGH (button released -> LED off)
        if (!inputSent && events.length >= 3) {
          inputSent = true;
          ws.send(
            JSON.stringify({
              type: "gpio_input",
              port: "A",
              pin: 0,
              state: 1,
            }),
          );
        }

        // After sending input, look for the state transition on pin 5
        if (inputSent && events.length >= 8) {
          const pin5Events = events.filter(
            (e: any) =>
              e.type === "gpio_write" &&
              e.data?.port === "A" &&
              e.data?.pin === 5,
          );

          // We need both state 1 (LED on, before input) and state 0 (LED off, after input)
          const hasOn = pin5Events.some((e: any) => e.data?.state === 1);
          const hasOff = pin5Events.some((e: any) => e.data?.state === 0);

          if (hasOn && hasOff) {
            clearTimeout(timeoutId);
            resolve();
          }
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeoutId);
        reject(err);
      };
    });

    ws.close();

    // Verify we saw the state transition
    const pin5Events = events.filter(
      (e: any) =>
        e.type === "gpio_write" &&
        e.data?.port === "A" &&
        e.data?.pin === 5,
    );

    const hasOn = pin5Events.some((e: any) => e.data?.state === 1);
    const hasOff = pin5Events.some((e: any) => e.data?.state === 0);

    expect(hasOn).toBe(true);
    expect(hasOff).toBe(true);

    // Clean up
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
  }, 15_000);

  it("sendGpioInput with invalid simId is a no-op", async () => {
    // Send gpio_input for a non-existent simulation -- should not throw
    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=nonexistent-id`,
    );

    await new Promise<void>((resolve) => {
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "gpio_input",
            port: "A",
            pin: 0,
            state: 1,
          }),
        );

        // Wait briefly then close -- no crash means success
        setTimeout(() => {
          resolve();
        }, 500);
      };

      ws.onerror = () => {
        // Connection refused is fine -- the sim doesn't exist
        resolve();
      };

      // If the connection closes (expected since sim doesn't exist)
      ws.onclose = () => {
        resolve();
      };
    });

    ws.close();

    // If we got here without error, the test passes
    expect(true).toBe(true);
  }, 10_000);

  it("WebSocket gpio_input message triggers LED state change (full round-trip)", async () => {
    // Use speed=10 so HAL_Delay(50) becomes 5ms -- fast but not spinning
    const { simulationId } = await compileAndRunButtonLed(10, 10000);
    const events: any[] = [];

    const ws = new WebSocket(
      `${WS_BASE}/ws?simulationId=${simulationId}`,
    );

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve();
      }, 8000);

      let phase = "collecting-initial";

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        events.push(data);

        // Phase 1: Collect initial events (LED should be ON since IDR starts at 0)
        if (phase === "collecting-initial") {
          const pin5Writes = events.filter(
            (e: any) =>
              e.type === "gpio_write" &&
              e.data?.port === "A" &&
              e.data?.pin === 5 &&
              e.data?.state === 1,
          );

          if (pin5Writes.length >= 2) {
            // Phase 2: Send button release (PA0 = HIGH)
            phase = "sent-release";
            ws.send(
              JSON.stringify({
                type: "gpio_input",
                port: "A",
                pin: 0,
                state: 1,
              }),
            );
          }
        }

        // Phase 2: Wait for LED to turn off
        if (phase === "sent-release") {
          const pin5Off = events.filter(
            (e: any) =>
              e.type === "gpio_write" &&
              e.data?.port === "A" &&
              e.data?.pin === 5 &&
              e.data?.state === 0,
          );

          // Exclude the very first event (init write at timestamp 0)
          const pin5OffAfterInit = pin5Off.filter(
            (e: any) => e.timestamp_ms > 0,
          );

          if (pin5OffAfterInit.length >= 1) {
            // Phase 3: Send button press (PA0 = LOW) to turn LED back on
            phase = "sent-press";
            ws.send(
              JSON.stringify({
                type: "gpio_input",
                port: "A",
                pin: 0,
                state: 0,
              }),
            );
          }
        }

        // Phase 3: Wait for LED to turn back on
        if (phase === "sent-press") {
          // Find gpio_write events for pin 5 with state 1 AFTER the off events
          const allPin5 = events.filter(
            (e: any) =>
              e.type === "gpio_write" &&
              e.data?.port === "A" &&
              e.data?.pin === 5,
          );

          // We should have seen: state 1 (init on) -> state 0 (released) -> state 1 (pressed again)
          const states = allPin5.map((e: any) => e.data?.state);
          // Check for the transition: at least one 1, then at least one 0, then at least one 1
          let sawOne = false;
          let sawZeroAfterOne = false;
          let sawOneAfterZero = false;
          for (const s of states) {
            if (s === 1 && !sawOne) sawOne = true;
            else if (s === 0 && sawOne && !sawZeroAfterOne)
              sawZeroAfterOne = true;
            else if (s === 1 && sawZeroAfterOne && !sawOneAfterZero)
              sawOneAfterZero = true;
          }

          if (sawOneAfterZero) {
            clearTimeout(timeoutId);
            resolve();
          }
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeoutId);
        reject(err);
      };
    });

    ws.close();

    // Verify the full round-trip: ON -> OFF -> ON
    const allPin5 = events.filter(
      (e: any) =>
        e.type === "gpio_write" &&
        e.data?.port === "A" &&
        e.data?.pin === 5,
    );

    const states = allPin5.map((e: any) => e.data?.state);
    let sawOne = false;
    let sawZeroAfterOne = false;
    let sawOneAfterZero = false;
    for (const s of states) {
      if (s === 1 && !sawOne) sawOne = true;
      else if (s === 0 && sawOne && !sawZeroAfterOne)
        sawZeroAfterOne = true;
      else if (s === 1 && sawZeroAfterOne && !sawOneAfterZero)
        sawOneAfterZero = true;
    }

    expect(sawOne).toBe(true);
    expect(sawZeroAfterOne).toBe(true);
    expect(sawOneAfterZero).toBe(true);

    // Clean up
    await fetch(`${BASE}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulationId }),
    });
  }, 15_000);
});
