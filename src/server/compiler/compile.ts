/**
 * @module compile
 * @description GCC invocation, temp dir management, compilation orchestration
 *
 * Compiles user-submitted STM32 C code against mock HAL stubs using
 * the host's native GCC. Returns structured compilation results with
 * errors, warnings, and the path to the compiled binary.
 */
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { globSync } from "node:fs";
import { parseGccDiagnostics, type DiagnosticMessage } from "./errors";

/**
 * Result of a compilation attempt.
 */
export interface CompileResult {
  success: boolean;
  compilationId?: string;
  binaryPath?: string;
  errors: DiagnosticMessage[];
  warnings: DiagnosticMessage[];
  rawOutput: string;
}

// Resolve HAL paths relative to project root (process.cwd())
const HAL_INCLUDE_PATH = join(process.cwd(), "hal", "include");
const HAL_SRC_DIR = join(process.cwd(), "hal", "src");

/**
 * Get all HAL C source files to link against.
 */
function getHalSources(): string[] {
  return globSync(join(HAL_SRC_DIR, "*.c"));
}

/**
 * Compile user C code against the mock HAL stubs.
 *
 * Creates a temp directory, writes the user code to main.c,
 * invokes GCC with JSON diagnostics, and parses the result.
 *
 * @param code - The C source code to compile
 * @returns Compilation result with structured errors/warnings
 */
export async function compile(code: string): Promise<CompileResult> {
  const workDir = await mkdtemp(join(tmpdir(), "stm32sim-"));
  const userFile = join(workDir, "main.c");
  const outputBinary = join(workDir, "firmware");

  await writeFile(userFile, code);

  const halSources = getHalSources();

  const proc = Bun.spawnSync(
    [
      "gcc",
      "-fdiagnostics-format=json",
      "-I",
      HAL_INCLUDE_PATH,
      "-o",
      outputBinary,
      userFile,
      ...halSources,
      "-lm",
    ],
    {
      stderr: "pipe",
      stdout: "pipe",
    }
  );

  const rawOutput = proc.stderr.toString();
  const { errors, warnings } = parseGccDiagnostics(rawOutput);

  if (proc.success) {
    const compilationId = crypto.randomUUID();
    return {
      success: true,
      compilationId,
      binaryPath: outputBinary,
      errors: [],
      warnings,
      rawOutput,
    };
  }

  return {
    success: false,
    errors,
    warnings,
    rawOutput,
  };
}

/**
 * Clean up compilation artifacts (temp directory with source and binary).
 *
 * @param compilationId - The compilation ID (for logging purposes)
 * @param binaryPath - Path to the compiled binary (parent dir is removed)
 */
export async function cleanupCompilation(
  compilationId: string,
  binaryPath: string
): Promise<void> {
  await rm(dirname(binaryPath), { recursive: true, force: true });
}
