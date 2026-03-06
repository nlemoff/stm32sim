/**
 * Compiler Module Tests
 *
 * Tests for COMP-01: GCC invocation, temp dir management,
 * compilation orchestration with structured error/warning output.
 */
import { describe, test, expect, afterAll } from "bun:test";
import { compile, cleanupCompilation, type CompileResult } from "../src/server/compiler/compile";
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");

// Track binary paths for cleanup
const binaryPaths: string[] = [];

afterAll(async () => {
  for (const bp of binaryPaths) {
    try {
      const { dirname } = await import("node:path");
      const { rm } = await import("node:fs/promises");
      await rm(dirname(bp), { recursive: true, force: true });
    } catch {}
  }
});

// Read blink sample code for use in tests
const blinkCode = await readFile(
  join(PROJECT_ROOT, "samples", "blink", "main.c"),
  "utf-8"
);

describe("Compiler - compile()", () => {
  test("Test 7: compiling valid blink sample returns success with compilationId and binaryPath", async () => {
    const result = await compile(blinkCode);
    if (result.binaryPath) binaryPaths.push(result.binaryPath);

    expect(result.success).toBe(true);
    expect(result.compilationId).toBeDefined();
    expect(typeof result.compilationId).toBe("string");
    expect(result.compilationId!.length).toBeGreaterThan(0);
    expect(result.binaryPath).toBeDefined();
    expect(result.errors).toHaveLength(0);
    // warnings may or may not be present, but should be an array
    expect(Array.isArray(result.warnings)).toBe(true);
  }, 15000);

  test("Test 8: compiled binary at binaryPath is executable", async () => {
    const result = await compile(blinkCode);
    if (result.binaryPath) binaryPaths.push(result.binaryPath);

    expect(result.success).toBe(true);
    expect(result.binaryPath).toBeDefined();
    expect(existsSync(result.binaryPath!)).toBe(true);

    // Check the binary is executable
    const stat = statSync(result.binaryPath!);
    // On Linux, check executable bit (owner execute = 0o100)
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  }, 15000);

  test("Test 9: compiling code with syntax error returns structured errors", async () => {
    const brokenCode = `
#include "stm32f4xx_hal.h"
int main(void) {
  // Missing semicolon
  int x = 5
  return 0;
}
`;
    const result = await compile(brokenCode);
    if (result.binaryPath) binaryPaths.push(result.binaryPath);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const firstError = result.errors[0];
    expect(firstError.file).toBeDefined();
    expect(firstError.line).toBeGreaterThan(0);
    expect(firstError.column).toBeGreaterThan(0);
    expect(firstError.severity).toBe("error");
    expect(typeof firstError.message).toBe("string");
  }, 15000);

  test("Test 10: compiling code with undefined reference returns linker error", async () => {
    const linkerErrorCode = `
#include "stm32f4xx_hal.h"
extern void this_function_does_not_exist(void);
int main(void) {
  HAL_Init();
  this_function_does_not_exist();
  return 0;
}
`;
    const result = await compile(linkerErrorCode);
    if (result.binaryPath) binaryPaths.push(result.binaryPath);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // The error message should reference the undefined function
    const allMessages = result.errors.map((e) => e.message).join(" ");
    expect(allMessages).toContain("this_function_does_not_exist");
  }, 15000);

  test("Test 11: rawOutput field always contains the full gcc stderr text", async () => {
    // Test with successful compilation
    const successResult = await compile(blinkCode);
    if (successResult.binaryPath) binaryPaths.push(successResult.binaryPath);
    expect(typeof successResult.rawOutput).toBe("string");

    // Test with failing compilation
    const failResult = await compile("int main() { syntax error here }");
    expect(typeof failResult.rawOutput).toBe("string");
    expect(failResult.rawOutput.length).toBeGreaterThan(0);
  }, 15000);

  test("Test 12: temp directory is created in system tmpdir with stm32sim- prefix", async () => {
    const result = await compile(blinkCode);
    if (result.binaryPath) binaryPaths.push(result.binaryPath);

    expect(result.success).toBe(true);
    expect(result.binaryPath).toBeDefined();

    // The binaryPath should be inside a temp directory with stm32sim- prefix
    const systemTmp = tmpdir();
    expect(result.binaryPath!.startsWith(systemTmp)).toBe(true);
    // Extract directory name from binaryPath
    const { dirname, basename } = await import("node:path");
    const dirName = basename(dirname(result.binaryPath!));
    expect(dirName.startsWith("stm32sim-")).toBe(true);
  }, 15000);
});
