/**
 * HAL Compilation and Runtime Integration Tests
 *
 * Validates that:
 * 1. All three sample programs compile against mock HAL stubs
 * 2. Compiled blink binary emits valid JSON events
 * 3. JSON events have correct structure (type, timestamp_ms, data)
 * 4. GPIO events reference the correct port and pin
 * 5. Invalid C code fails compilation appropriately
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

const PROJECT_ROOT = join(import.meta.dir, "..");
const HAL_INCLUDE = join(PROJECT_ROOT, "hal", "include");
const HAL_SOURCES = [
  join(PROJECT_ROOT, "hal", "src", "hal_gpio.c"),
  join(PROJECT_ROOT, "hal", "src", "hal_system.c"),
  join(PROJECT_ROOT, "hal", "src", "hal_uart.c"),
  join(PROJECT_ROOT, "hal", "src", "hal_spi.c"),
  join(PROJECT_ROOT, "hal", "src", "hal_i2c.c"),
  join(PROJECT_ROOT, "hal", "src", "sim_main.c"),
  join(PROJECT_ROOT, "hal", "src", "sim_runtime.c"),
];

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "stm32sim-test-"));
});

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

/**
 * Helper: compile a sample program.
 * Returns the spawnSync result and the output binary path.
 */
function compileSample(sampleName: string) {
  const samplePath = join(PROJECT_ROOT, "samples", sampleName, "main.c");
  const outputPath = join(tempDir, `test_${sampleName}`);

  const result = Bun.spawnSync([
    "gcc",
    "-I", HAL_INCLUDE,
    "-o", outputPath,
    samplePath,
    ...HAL_SOURCES,
    "-lm",
  ]);

  return { result, outputPath };
}

describe("Sample Compilation", () => {
  test("blink sample compiles successfully", () => {
    const { result, outputPath } = compileSample("blink");
    expect(result.exitCode).toBe(0);
    expect(existsSync(outputPath)).toBe(true);
  }, 10000);

  test("knight-rider sample compiles successfully", () => {
    const { result, outputPath } = compileSample("knight-rider");
    expect(result.exitCode).toBe(0);
    expect(existsSync(outputPath)).toBe(true);
  }, 10000);

  test("button-led sample compiles successfully", () => {
    const { result, outputPath } = compileSample("button-led");
    expect(result.exitCode).toBe(0);
    expect(existsSync(outputPath)).toBe(true);
  }, 10000);
});

describe("Blink Runtime Output", () => {
  test("blink binary emits valid JSON lines to stdout", async () => {
    // Compile blink
    const { result: compileResult, outputPath } = compileSample("blink");
    expect(compileResult.exitCode).toBe(0);

    // Run with high speed multiplier for fast execution
    const proc = Bun.spawn([outputPath], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, SIM_SPEED: "1000" },
    });

    // Collect output for up to 2 seconds
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let output = "";
    const timeout = Date.now() + 2000;

    while (Date.now() < timeout) {
      const readPromise = reader.read();
      const timeoutPromise = new Promise<{ done: true; value: undefined }>(
        (resolve) => setTimeout(() => resolve({ done: true, value: undefined }), 500)
      );
      const { done, value } = await Promise.race([readPromise, timeoutPromise]);
      if (done) break;
      if (value) output += decoder.decode(value, { stream: true });
      // Stop once we have enough data
      if (output.split("\n").filter(Boolean).length >= 10) break;
    }

    // Kill the process
    proc.kill();
    await proc.exited;

    // Parse JSON lines
    const lines = output.split("\n").filter((line) => line.trim());
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const event = JSON.parse(line);
      expect(event).toHaveProperty("type");
      expect(event).toHaveProperty("timestamp_ms");
      expect(typeof event.type).toBe("string");
      expect(typeof event.timestamp_ms).toBe("number");
    }
  }, 10000);

  test("blink binary stdout contains gpio_write events with port A, pin 5", async () => {
    const { result: compileResult, outputPath } = compileSample("blink");
    expect(compileResult.exitCode).toBe(0);

    const proc = Bun.spawn([outputPath], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, SIM_SPEED: "1000" },
    });

    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let output = "";
    const timeout = Date.now() + 2000;

    while (Date.now() < timeout) {
      const readPromise = reader.read();
      const timeoutPromise = new Promise<{ done: true; value: undefined }>(
        (resolve) => setTimeout(() => resolve({ done: true, value: undefined }), 500)
      );
      const { done, value } = await Promise.race([readPromise, timeoutPromise]);
      if (done) break;
      if (value) output += decoder.decode(value, { stream: true });
      if (output.split("\n").filter(Boolean).length >= 10) break;
    }

    proc.kill();
    await proc.exited;

    const lines = output.split("\n").filter((line) => line.trim());
    const events = lines.map((line) => JSON.parse(line));

    // Find gpio_write events
    const gpioWrites = events.filter((e: any) => e.type === "gpio_write");
    expect(gpioWrites.length).toBeGreaterThan(0);

    // Verify port and pin
    for (const event of gpioWrites) {
      expect(event.data.port).toBe("A");
      expect(event.data.pin).toBe(5);
      expect([0, 1]).toContain(event.data.state);
    }
  }, 10000);

  test("blink binary stdout starts with sim_start event", async () => {
    const { result: compileResult, outputPath } = compileSample("blink");
    expect(compileResult.exitCode).toBe(0);

    const proc = Bun.spawn([outputPath], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, SIM_SPEED: "1000" },
    });

    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let output = "";
    const timeout = Date.now() + 2000;

    while (Date.now() < timeout) {
      const readPromise = reader.read();
      const timeoutPromise = new Promise<{ done: true; value: undefined }>(
        (resolve) => setTimeout(() => resolve({ done: true, value: undefined }), 500)
      );
      const { done, value } = await Promise.race([readPromise, timeoutPromise]);
      if (done) break;
      if (value) output += decoder.decode(value, { stream: true });
      if (output.includes("\n")) break;
    }

    proc.kill();
    await proc.exited;

    const lines = output.split("\n").filter((line) => line.trim());
    expect(lines.length).toBeGreaterThan(0);

    const firstEvent = JSON.parse(lines[0]);
    expect(firstEvent.type).toBe("sim_start");
    expect(firstEvent.timestamp_ms).toBe(0);
  }, 10000);
});

describe("Compilation Failure", () => {
  test("invalid C code fails compilation with non-zero exit code", async () => {
    // Write deliberately broken C code to a temp file
    const brokenFile = join(tempDir, "broken.c");
    await Bun.write(brokenFile, "int main() { undefined_func(); }");

    const result = Bun.spawnSync([
      "gcc",
      "-I", HAL_INCLUDE,
      "-o", join(tempDir, "broken_output"),
      brokenFile,
      ...HAL_SOURCES,
      "-lm",
    ]);

    expect(result.exitCode).not.toBe(0);
  }, 10000);
});
