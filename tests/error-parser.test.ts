/**
 * Error Parser Tests
 *
 * Tests for COMP-03: GCC JSON diagnostic parsing, linker error fallback,
 * and mixed output handling.
 */
import { describe, test, expect } from "bun:test";
import { parseGccDiagnostics, type DiagnosticMessage } from "../src/server/compiler/errors";

describe("parseGccDiagnostics", () => {
  test("Test 1: parses GCC JSON diagnostic array into DiagnosticMessage[]", () => {
    const gccJson = JSON.stringify([
      {
        kind: "error",
        message: "expected ';' before '}' token",
        locations: [
          {
            caret: {
              file: "/tmp/stm32sim-abc/main.c",
              line: 10,
              column: 5,
            },
          },
        ],
      },
    ]);

    const result = parseGccDiagnostics(gccJson);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe("/tmp/stm32sim-abc/main.c");
    expect(result.errors[0].line).toBe(10);
    expect(result.errors[0].column).toBe(5);
    expect(result.errors[0].severity).toBe("error");
    expect(result.errors[0].message).toBe("expected ';' before '}' token");
  });

  test("Test 2: separates errors from warnings by severity field", () => {
    const gccJson = JSON.stringify([
      {
        kind: "warning",
        message: "unused variable 'x'",
        option: "-Wunused-variable",
        locations: [{ caret: { file: "main.c", line: 5, column: 7 } }],
      },
      {
        kind: "error",
        message: "undeclared identifier 'y'",
        locations: [{ caret: { file: "main.c", line: 8, column: 3 } }],
      },
      {
        kind: "warning",
        message: "implicit declaration of function 'foo'",
        option: "-Wimplicit-function-declaration",
        locations: [{ caret: { file: "main.c", line: 12, column: 3 } }],
      },
    ]);

    const result = parseGccDiagnostics(gccJson);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(2);
    expect(result.errors[0].severity).toBe("error");
    expect(result.warnings[0].severity).toBe("warning");
    expect(result.warnings[1].severity).toBe("warning");
  });

  test("Test 3: handles empty diagnostics array (no errors)", () => {
    const gccJson = JSON.stringify([]);
    const result = parseGccDiagnostics(gccJson);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  test("Test 4: falls back gracefully when GCC outputs non-JSON (linker errors)", () => {
    const linkerOutput =
      "/usr/bin/ld: /tmp/stm32sim-abc/main.o: in function `main':\n" +
      "main.c:(.text+0x15): undefined reference to `some_function'\n" +
      "collect2: error: ld returned 1 exit status";

    const result = parseGccDiagnostics(linkerOutput);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe("linker");
    expect(result.errors[0].line).toBe(0);
    expect(result.errors[0].column).toBe(0);
    expect(result.errors[0].severity).toBe("error");
    expect(result.errors[0].message).toContain("undefined reference");
  });

  test("Test 5: parses mixed output where JSON is followed by linker text", () => {
    // GCC sometimes outputs JSON diagnostics for compile errors, then linker text after
    const mixedOutput =
      JSON.stringify([
        {
          kind: "warning",
          message: "unused variable 'x'",
          option: "-Wunused-variable",
          locations: [{ caret: { file: "main.c", line: 3, column: 7 } }],
        },
      ]) +
      "\n/usr/bin/ld: undefined reference to `missing_func'\ncollect2: error: ld returned 1 exit status\n";

    const result = parseGccDiagnostics(mixedOutput);
    // Should at least parse the JSON portion
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    // The linker part might appear as an error
    expect(result.errors.length + result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  test("Test 6: includes option field when present", () => {
    const gccJson = JSON.stringify([
      {
        kind: "warning",
        message: "unused variable 'count'",
        option: "-Wunused-variable",
        locations: [{ caret: { file: "main.c", line: 5, column: 7 } }],
      },
      {
        kind: "error",
        message: "expected ';' before '}'",
        locations: [{ caret: { file: "main.c", line: 10, column: 1 } }],
      },
    ]);

    const result = parseGccDiagnostics(gccJson);
    const warning = result.warnings[0];
    expect(warning.option).toBe("-Wunused-variable");
    const error = result.errors[0];
    expect(error.option).toBeUndefined();
  });
});
