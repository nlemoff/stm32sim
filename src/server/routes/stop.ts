/**
 * @module routes/stop
 * @description POST /api/stop handler
 *
 * Terminates a running simulation by killing its subprocess.
 */
import { withCors } from "./compile";
import { stopSimulation } from "../runner/process-manager";

/**
 * Handle POST /api/stop
 *
 * Expects JSON body: { simulationId: string }
 * Returns JSON: { stopped: true } or 404 if not found
 */
export async function handleStop(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return withCors(
      Response.json({ error: "Invalid JSON body" }, { status: 400 })
    );
  }

  const { simulationId } = body;

  if (!simulationId || typeof simulationId !== "string") {
    return withCors(
      Response.json(
        { error: "simulationId must be a non-empty string" },
        { status: 400 }
      )
    );
  }

  const stopped = stopSimulation(simulationId);

  if (!stopped) {
    return withCors(
      Response.json(
        { error: "Simulation not found or already stopped" },
        { status: 404 }
      )
    );
  }

  return withCors(Response.json({ stopped: true }));
}
