/**
 * @module errors
 * @description GCC JSON diagnostic parser with linker error fallback
 *
 * Parses GCC's `-fdiagnostics-format=json` output into structured
 * DiagnosticMessage objects. Falls back to raw text extraction when
 * GCC outputs non-JSON content (e.g., linker errors).
 */

/**
 * A single diagnostic message from GCC compilation.
 */
export interface DiagnosticMessage {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "note";
  message: string;
  option?: string;
}

/**
 * Result of parsing GCC diagnostics, with errors and warnings separated.
 */
export interface ParsedDiagnostics {
  errors: DiagnosticMessage[];
  warnings: DiagnosticMessage[];
}

/**
 * Map a single GCC JSON diagnostic object to a DiagnosticMessage.
 */
function mapDiagnostic(d: any): DiagnosticMessage {
  const caret = d.locations?.[0]?.caret;
  const msg: DiagnosticMessage = {
    file: caret?.file || "unknown",
    line: caret?.line || 0,
    column: caret?.column || 0,
    severity: d.kind as DiagnosticMessage["severity"],
    message: d.message || "",
  };
  if (d.option) {
    msg.option = d.option;
  }
  return msg;
}

/**
 * Separate an array of DiagnosticMessage into errors and warnings.
 * "note" severity is classified with warnings.
 */
function separate(diagnostics: DiagnosticMessage[]): ParsedDiagnostics {
  const errors: DiagnosticMessage[] = [];
  const warnings: DiagnosticMessage[] = [];
  for (const d of diagnostics) {
    if (d.severity === "error") {
      errors.push(d);
    } else {
      warnings.push(d);
    }
  }
  return { errors, warnings };
}

/**
 * Parse GCC diagnostic output into structured error/warning arrays.
 *
 * Handles three cases:
 * 1. Pure JSON array (normal GCC -fdiagnostics-format=json output)
 * 2. Mixed output: JSON array followed by linker text
 * 3. Pure text (linker errors without any JSON)
 *
 * @param rawStderr - The raw stderr output from GCC
 * @returns Separated errors and warnings
 */
export function parseGccDiagnostics(rawStderr: string): ParsedDiagnostics {
  const trimmed = rawStderr.trim();

  // Empty input -- no diagnostics
  if (!trimmed) {
    return { errors: [], warnings: [] };
  }

  // Case 1: Try to parse as pure JSON array
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const diagnostics = parsed.map(mapDiagnostic);
      return separate(diagnostics);
    }
  } catch {
    // Not pure JSON -- try mixed or linker fallback
  }

  // Case 2: Mixed output -- try to extract JSON portion
  // GCC outputs JSON first, then linker text may follow after a newline
  const firstBracket = trimmed.indexOf("[");
  if (firstBracket >= 0) {
    // Find the matching closing bracket by trying progressively shorter substrings
    let lastBracket = trimmed.lastIndexOf("]");
    while (lastBracket > firstBracket) {
      const jsonCandidate = trimmed.substring(firstBracket, lastBracket + 1);
      try {
        const parsed = JSON.parse(jsonCandidate);
        if (Array.isArray(parsed)) {
          const diagnostics = parsed.map(mapDiagnostic);
          const result = separate(diagnostics);

          // Check if there's remaining text after the JSON (linker errors)
          const remaining = trimmed.substring(lastBracket + 1).trim();
          if (remaining) {
            result.errors.push({
              file: "linker",
              line: 0,
              column: 0,
              severity: "error",
              message: remaining,
            });
          }

          return result;
        }
      } catch {
        // Try a shorter substring
        lastBracket = trimmed.lastIndexOf("]", lastBracket - 1);
      }
    }
  }

  // Case 3: Pure text fallback (linker errors or other non-JSON output)
  return {
    errors: [
      {
        file: "linker",
        line: 0,
        column: 0,
        severity: "error",
        message: trimmed,
      },
    ],
    warnings: [],
  };
}
