/**
 * @module routes/samples
 * @description GET /api/samples and /api/samples/:name handlers
 *
 * Lists available sample firmware programs and returns their source code.
 * Sample metadata (title, description) is extracted from the first comment
 * block in each main.c file.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { withCors } from "./compile";

const SAMPLES_DIR = join(process.cwd(), "samples");

interface SampleInfo {
  name: string;
  title: string;
  description: string;
}

/**
 * Extract title and description from the first comment block in a C file.
 *
 * Looks for the pattern:
 *   /**
 *    * Title Here
 *    *
 *    * Description text...
 *    */
function extractMetadata(content: string): {
  title: string;
  description: string;
} {
  // Match the first block comment: /** ... */
  const commentMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\*\//);
  if (!commentMatch) {
    return { title: "Untitled", description: "" };
  }

  // Clean up comment lines: remove leading " * " or " *"
  const lines = commentMatch[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter((_, i, arr) => {
      // Remove empty lines at start and end
      return true;
    });

  // First non-empty line is the title
  const titleLine = lines.find((line) => line.length > 0);
  const title = titleLine || "Untitled";

  // Description is everything after the title, skipping the first blank line
  const titleIndex = lines.indexOf(titleLine || "");
  const descLines = lines
    .slice(titleIndex + 1)
    .join(" ")
    .trim();

  // Take the first sentence or first 200 chars as description
  const firstSentence = descLines.match(/^[^.]+\./);
  const description = firstSentence
    ? firstSentence[0]
    : descLines.substring(0, 200);

  return { title, description };
}

/**
 * Handle GET /api/samples
 *
 * Lists all available sample programs with their names, titles, and descriptions.
 */
export function handleListSamples(): Response {
  try {
    const entries = readdirSync(SAMPLES_DIR, { withFileTypes: true });
    const samples: SampleInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const mainCPath = join(SAMPLES_DIR, entry.name, "main.c");
      if (!existsSync(mainCPath)) continue;

      const content = readFileSync(mainCPath, "utf-8");
      const { title, description } = extractMetadata(content);

      samples.push({
        name: entry.name,
        title,
        description,
      });
    }

    // Sort alphabetically by name for consistency
    samples.sort((a, b) => a.name.localeCompare(b.name));

    return withCors(Response.json(samples));
  } catch (err) {
    return withCors(
      Response.json(
        { error: "Failed to list samples" },
        { status: 500 }
      )
    );
  }
}

/**
 * Handle GET /api/samples/:name
 *
 * Returns the source code of a specific sample program.
 */
export async function handleGetSample(name: string): Promise<Response> {
  const sampleDir = join(SAMPLES_DIR, name);
  const mainCPath = join(sampleDir, "main.c");

  if (!existsSync(mainCPath)) {
    return withCors(
      Response.json(
        { error: `Sample '${name}' not found` },
        { status: 404 }
      )
    );
  }

  try {
    const content = readFileSync(mainCPath, "utf-8");

    return withCors(
      Response.json({
        name,
        files: [{ name: "main.c", content }],
      })
    );
  } catch {
    return withCors(
      Response.json(
        { error: "Failed to read sample" },
        { status: 500 }
      )
    );
  }
}
