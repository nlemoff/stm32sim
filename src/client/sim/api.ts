/**
 * @module client/sim/api
 * @description REST API client for the STM32 simulation backend.
 * All endpoints use same-origin fetch (empty API_BASE).
 */

const API_BASE = "";

/**
 * Compile C source code.
 * POST /api/compile
 */
export async function compile(code: string) {
  const res = await fetch(`${API_BASE}/api/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error || `Compile failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Start a simulation run.
 * POST /api/run
 */
export async function run(compilationId: string, speed?: number) {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compilationId, speed }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error || `Run failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Stop a running simulation.
 * POST /api/stop
 */
export async function stop(simulationId: string) {
  const res = await fetch(`${API_BASE}/api/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulationId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error || `Stop failed: ${res.status}`);
  }
  return res.json();
}

/**
 * List available sample projects.
 * GET /api/samples
 */
export async function listSamples() {
  const res = await fetch(`${API_BASE}/api/samples`);
  if (!res.ok) {
    throw new Error(`Failed to list samples: ${res.status}`);
  }
  return res.json();
}

/**
 * Get a specific sample project by name.
 * GET /api/samples/:name
 */
export async function getSample(name: string) {
  const res = await fetch(`${API_BASE}/api/samples/${name}`);
  if (!res.ok) {
    throw new Error(`Failed to get sample '${name}': ${res.status}`);
  }
  return res.json();
}
