/**
 * @module routes/compile
 * @description POST /api/compile handler
 *
 * Accepts C code in the request body, compiles it against mock HAL stubs
 * using GCC, and returns a structured compilation result with errors,
 * warnings, and a compilationId for subsequent run requests.
 */
import { compile, type CompileResult } from "../compiler/compile";

/**
 * Map of compilationId -> binaryPath for successful compilations.
 * Used by the /api/run route to locate the compiled binary.
 */
export const compilationMap = new Map<string, string>();

/**
 * Add CORS headers to a Response.
 */
export function withCors(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
  return response;
}

/**
 * Handle POST /api/compile
 *
 * Expects JSON body: { code: string }
 * Returns JSON: CompileResult (success/errors/warnings/compilationId)
 */
export async function handleCompile(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return withCors(
      Response.json({ error: "Invalid JSON body" }, { status: 400 })
    );
  }

  const { code } = body;

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return withCors(
      Response.json(
        { error: "code must be a non-empty string" },
        { status: 400 }
      )
    );
  }

  const result: CompileResult = await compile(code);

  // Store successful compilation for later /api/run use
  if (result.success && result.compilationId && result.binaryPath) {
    compilationMap.set(result.compilationId, result.binaryPath);
  }

  return withCors(Response.json(result));
}
