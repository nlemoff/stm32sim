/**
 * @module stdout-parser
 * @description Line-delimited JSON parser for subprocess stdout
 *
 * Reads raw byte chunks from a subprocess stdout stream, splits them
 * on newlines (buffering partial lines), and yields parsed SimulationEvent
 * objects. Non-JSON lines are silently skipped.
 */

/**
 * A single simulation event emitted by the compiled firmware process.
 */
export interface SimulationEvent {
  type: string;
  timestamp_ms: number;
  data: Record<string, unknown>;
}

/**
 * Parse a single JSON line into a SimulationEvent.
 * Returns null if the line is empty or not valid JSON.
 */
export function parseEventLine(line: string): SimulationEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.type === "string" &&
      typeof parsed.timestamp_ms === "number"
    ) {
      return parsed as SimulationEvent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Async generator that reads chunks from a ReadableStream, splits on
 * newlines (buffering partial lines across chunks), and yields parsed
 * SimulationEvent objects.
 *
 * Non-JSON lines are silently skipped.
 */
export async function* streamEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SimulationEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep the last element (possibly incomplete line) in the buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      const event = parseEventLine(line);
      if (event) {
        yield event;
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.trim()) {
    const event = parseEventLine(buffer);
    if (event) {
      yield event;
    }
  }
}
