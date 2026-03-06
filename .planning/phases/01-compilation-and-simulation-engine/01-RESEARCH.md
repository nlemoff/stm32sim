# Phase 1: Compilation and Simulation Engine - Research

**Researched:** 2026-03-05
**Domain:** Server-side C compilation pipeline, subprocess execution, real-time WebSocket streaming
**Confidence:** HIGH

## Summary

Phase 1 builds a backend pipeline where STM32 C code is compiled using native GCC (v13.3.0, already installed) against mock HAL stub headers, executed as a subprocess, and its GPIO state changes streamed over WebSocket. The architecture has three major components: (1) mock HAL headers and a runtime library that make STM32 code compile on the host and emit JSON events to stdout, (2) a Bun HTTP/WebSocket server that accepts code via REST API, invokes GCC, and manages simulation subprocesses, and (3) a stdout-to-WebSocket bridge that captures the simulation's line-by-line JSON output and broadcasts it to connected clients.

GCC 13.3.0 is available on the system and supports `-fdiagnostics-format=json` for structured error output -- this eliminates the need to parse gcc error text manually. Bun provides `Bun.serve()` with built-in routing (no framework needed), native WebSocket support with pub/sub, and `Bun.spawn()` for subprocess management with streaming stdout. The mock HAL approach is straightforward: header files define the same types and function signatures as the real STM32F4 HAL, while a `.c` implementation file provides stub bodies that print JSON to stdout.

**Primary recommendation:** Use Bun's built-in `Bun.serve()` with routes + WebSocket (no external framework), GCC's native JSON diagnostics, and a simple stdout-based IPC protocol between the compiled firmware and the Bun server.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full STM32 HAL boilerplate: user code includes HAL_Init(), SystemClock_Config(), full GPIO_InitTypeDef structs -- looks like real STM32CubeIDE code
- System/clock config stubs silently succeed (no-ops) but must compile
- GPIO ports GPIOA through GPIOE supported (5 ports, 80 pins)
- All peripheral stubs exist in Phase 1: GPIO fully functional, UART/SPI/I2C stubs compile as no-ops (behavior wired up in Phase 3)
- HAL_Delay() uses real sleep with simulation speed multiplier (1x = real time, configurable for fast-forward)
- Compilation errors parsed from gcc output into structured JSON: file, line, column, severity, message
- Raw gcc output also available as fallback
- Distinct error categories: compilation errors, linker errors, and runtime errors (segfault, timeout)
- All errors returned (no cap) -- Phase 2 UI can paginate/truncate as needed
- Warnings included but clearly separated from errors (Phase 2 renders as yellow vs red)
- Three sample programs ship with Phase 1: Blink LED (PA5 toggle 500ms), Knight Rider (PA5-PA8 chase), Button LED (PA0 input toggles PA5 output)
- Samples live in top-level `samples/` directory with subdirectories per sample
- All samples include educational comments explaining HAL calls
- Code should look like it came from STM32CubeIDE -- authentic experience, not a toy API

### Claude's Discretion
- State event JSON format (structure of GPIO state-change events over WebSocket)
- API endpoint design (REST routes for compile/run/stop)
- Subprocess isolation implementation details
- Exact HAL function list beyond what samples require
- WebSocket protocol details (connection, heartbeat, reconnection)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | User can compile STM32 C code server-side using native gcc with mock HAL stubs | GCC 13.3.0 available; mock HAL header architecture documented; compilation pipeline design with temp directories |
| COMP-02 | User can run compiled firmware and see execution results streamed to the browser in real-time | Bun.spawn() with streaming stdout; stdout JSON protocol; WebSocket pub/sub broadcasting |
| COMP-03 | User sees clear, readable compilation errors when code fails to compile | GCC `-fdiagnostics-format=json` produces structured JSON with file, line, column, severity, message |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun | latest (install via `curl -fsSL https://bun.com/install \| bash`) | Runtime, HTTP server, WebSocket, subprocess management | Project constraint; built-in serve + WebSocket + spawn eliminates framework dependencies |
| GCC | 13.3.0 (already installed) | Host-native compilation of C code | Already on system; supports `-fdiagnostics-format=json` for structured errors |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` (Bun-compatible) | built-in | Temp directory creation (`mkdtemp`), file writing | Creating per-compilation temp directories, writing user code to files |
| `node:os` (Bun-compatible) | built-in | `os.tmpdir()` for temp file base path | Locating system temp directory |
| `node:path` (Bun-compatible) | built-in | Path manipulation for includes, temp dirs | Building gcc include paths, output paths |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bun built-in routing | Hono or Elysia | Unnecessary complexity -- only ~5 routes needed; Bun's built-in router handles path params, method dispatch |
| stdout JSON protocol | Unix sockets / shared memory | stdout is simpler, portable, naturally line-delimited; no need for shared memory complexity |
| GCC JSON diagnostics | Regex parsing of gcc text output | GCC's native JSON is authoritative and handles edge cases; regex is fragile |

**Installation:**
```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.com/install | bash

# GCC is already available: gcc 13.3.0
# No npm packages needed for Phase 1 -- Bun built-ins cover everything
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  server/
    index.ts              # Bun.serve() entry point with routes + WebSocket
    routes/
      compile.ts          # POST /api/compile -- compile user code
      run.ts              # POST /api/run -- start simulation subprocess
      stop.ts             # POST /api/stop -- kill simulation subprocess
      samples.ts          # GET /api/samples -- list sample programs
    ws/
      handler.ts          # WebSocket open/message/close handlers
      broadcaster.ts      # Manages stdout-to-WebSocket forwarding
    compiler/
      compile.ts          # GCC invocation, temp dir management, error parsing
      errors.ts           # Parse GCC JSON diagnostics into API response format
    runner/
      process-manager.ts  # Spawn/kill simulation subprocesses, enforce timeout
      stdout-parser.ts    # Parse line-delimited JSON from subprocess stdout
    state/
      simulation.ts       # Track active simulations, their WebSocket clients
hal/
  include/
    stm32f4xx.h           # Top-level include (what user code #includes)
    stm32f4xx_hal.h       # HAL umbrella header
    stm32f4xx_hal_conf.h  # HAL configuration (enable/disable modules)
    stm32f4xx_hal_def.h   # HAL_StatusTypeDef, common macros
    stm32f4xx_hal_gpio.h  # GPIO types, function prototypes
    stm32f4xx_hal_uart.h  # UART types, function prototypes (no-op stubs)
    stm32f4xx_hal_spi.h   # SPI types, function prototypes (no-op stubs)
    stm32f4xx_hal_i2c.h   # I2C types, function prototypes (no-op stubs)
    stm32f4xx_hal_rcc.h   # RCC (clock) types, function prototypes (no-op)
    stm32f4xx_hal_cortex.h # NVIC/SysTick stubs
  src/
    hal_gpio.c            # GPIO stub implementations -- emit JSON events
    hal_system.c          # HAL_Init, HAL_Delay, SystemClock_Config, etc.
    hal_uart.c            # UART no-op stubs (wired in Phase 3)
    hal_spi.c             # SPI no-op stubs (wired in Phase 3)
    hal_i2c.c             # I2C no-op stubs (wired in Phase 3)
    sim_main.c            # Provides main() wrapper or startup glue
    sim_runtime.c         # JSON output helpers, speed multiplier, time tracking
samples/
  blink/
    main.c                # PA5 toggle every 500ms
  knight-rider/
    main.c                # PA5-PA8 chase pattern
  button-led/
    main.c                # PA0 input toggles PA5 output
```

### Pattern 1: Mock HAL with JSON Event Emission

**What:** HAL function stubs that compile identically to real STM32 code but emit JSON to stdout instead of touching hardware registers.

**When to use:** Every HAL function that changes observable peripheral state.

**Example:**
```c
// hal/src/hal_gpio.c
#include "stm32f4xx_hal_gpio.h"
#include "sim_runtime.h"
#include <stdio.h>

// In-memory GPIO state (5 ports x 16 pins)
static uint16_t gpio_odr[5] = {0}; // Output data registers
static uint16_t gpio_idr[5] = {0}; // Input data registers
static uint32_t gpio_mode[5] = {0}; // Pin modes

static int port_index(GPIO_TypeDef *GPIOx) {
    if (GPIOx == GPIOA) return 0;
    if (GPIOx == GPIOB) return 1;
    if (GPIOx == GPIOC) return 2;
    if (GPIOx == GPIOD) return 3;
    if (GPIOx == GPIOE) return 4;
    return -1;
}

void HAL_GPIO_Init(GPIO_TypeDef *GPIOx, GPIO_InitTypeDef *GPIO_Init) {
    int idx = port_index(GPIOx);
    if (idx < 0) return;
    // Store mode info for later queries
    for (int pin = 0; pin < 16; pin++) {
        if (GPIO_Init->Pin & (1 << pin)) {
            // Track mode per pin
        }
    }
    sim_emit_event("gpio_init", "{\"port\":%d,\"pin_mask\":%u,\"mode\":%u}",
                   idx, GPIO_Init->Pin, GPIO_Init->Mode);
}

void HAL_GPIO_WritePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin, GPIO_PinState PinState) {
    int idx = port_index(GPIOx);
    if (idx < 0) return;
    if (PinState == GPIO_PIN_SET) {
        gpio_odr[idx] |= GPIO_Pin;
    } else {
        gpio_odr[idx] &= ~GPIO_Pin;
    }
    sim_emit_event("gpio_write", "{\"port\":%d,\"pin\":%u,\"state\":%d}",
                   idx, GPIO_Pin, PinState);
}

void HAL_GPIO_TogglePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin) {
    int idx = port_index(GPIOx);
    if (idx < 0) return;
    gpio_odr[idx] ^= GPIO_Pin;
    int state = (gpio_odr[idx] & GPIO_Pin) ? 1 : 0;
    sim_emit_event("gpio_write", "{\"port\":%d,\"pin\":%u,\"state\":%d}",
                   idx, GPIO_Pin, state);
}

GPIO_PinState HAL_GPIO_ReadPin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin) {
    int idx = port_index(GPIOx);
    if (idx < 0) return GPIO_PIN_RESET;
    return (gpio_idr[idx] & GPIO_Pin) ? GPIO_PIN_SET : GPIO_PIN_RESET;
}
```

### Pattern 2: JSON Event Protocol over stdout

**What:** Line-delimited JSON protocol for firmware-to-host communication.

**When to use:** All simulation events emitted by HAL stubs.

**Example:**
```c
// hal/src/sim_runtime.c
#include <stdio.h>
#include <stdarg.h>
#include <time.h>
#include <unistd.h>

static double speed_multiplier = 1.0;

// CRITICAL: Disable stdout buffering so events reach parent immediately
void sim_init(void) {
    setvbuf(stdout, NULL, _IONBF, 0);  // Unbuffered stdout
    // Read speed multiplier from environment
    const char *speed = getenv("SIM_SPEED");
    if (speed) speed_multiplier = atof(speed);
    // Emit init event
    printf("{\"type\":\"sim_start\",\"timestamp_ms\":0}\n");
    fflush(stdout);
}

void sim_emit_event(const char *type, const char *data_fmt, ...) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    long ms = ts.tv_sec * 1000 + ts.tv_nsec / 1000000;

    printf("{\"type\":\"%s\",\"timestamp_ms\":%ld,\"data\":", type, ms);
    va_list args;
    va_start(args, data_fmt);
    vprintf(data_fmt, args);
    va_end(args);
    printf("}\n");
    // No fflush needed -- stdout is unbuffered
}

void HAL_Delay(uint32_t Delay) {
    uint32_t actual_ms = (uint32_t)(Delay / speed_multiplier);
    sim_emit_event("delay", "{\"requested_ms\":%u,\"actual_ms\":%u}", Delay, actual_ms);
    usleep(actual_ms * 1000);
}
```

### Pattern 3: Bun Server with HTTP Routes + WebSocket

**What:** Single Bun.serve() instance handling REST API and WebSocket on the same port.

**When to use:** The main server entry point.

**Example:**
```typescript
// src/server/index.ts
const server = Bun.serve({
  port: 3000,
  routes: {
    "POST /api/compile": async (req) => {
      const { code } = await req.json();
      const result = await compile(code);
      return Response.json(result);
    },
    "POST /api/run": async (req) => {
      const { compilationId } = await req.json();
      const simId = await startSimulation(compilationId);
      return Response.json({ simulationId: simId });
    },
    "POST /api/stop": async (req) => {
      const { simulationId } = await req.json();
      await stopSimulation(simulationId);
      return Response.json({ stopped: true });
    },
    "GET /api/samples": () => {
      return Response.json(listSamples());
    },
    "GET /api/samples/:name": (req) => {
      const code = readSample(req.params.name);
      return Response.json({ code });
    },
  },
  fetch(req, server) {
    // WebSocket upgrade for /ws path
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const simId = url.searchParams.get("simulationId");
      if (server.upgrade(req, { data: { simulationId: simId } })) {
        return; // upgraded
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      const simId = ws.data.simulationId;
      ws.subscribe(`sim:${simId}`);
      // Register client for this simulation
    },
    message(ws, message) {
      // Handle client messages (e.g., GPIO input for button simulation)
      const msg = JSON.parse(message);
      if (msg.type === "gpio_input") {
        sendInputToSimulation(ws.data.simulationId, msg);
      }
    },
    close(ws) {
      // Unsubscribe and potentially stop simulation if last client
      ws.unsubscribe(`sim:${ws.data.simulationId}`);
      handleClientDisconnect(ws.data.simulationId);
    },
  },
});
```

### Pattern 4: Subprocess Management with Timeout

**What:** Spawn compiled binary, stream stdout, enforce timeout, clean up on disconnect.

**When to use:** Every simulation run.

**Example:**
```typescript
// src/server/runner/process-manager.ts
interface Simulation {
  id: string;
  process: Subprocess;
  compiledPath: string;
  timeout: Timer;
  clients: Set<string>;
}

const simulations = new Map<string, Simulation>();

async function startSimulation(compiledPath: string, timeoutMs = 30000): Promise<string> {
  const id = crypto.randomUUID();

  const proc = Bun.spawn([compiledPath], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      SIM_SPEED: "1.0",
    },
  });

  const timeout = setTimeout(() => {
    stopSimulation(id);
  }, timeoutMs);

  const sim: Simulation = { id, process: proc, compiledPath, timeout, clients: new Set() };
  simulations.set(id, sim);

  // Stream stdout line-by-line and broadcast via WebSocket pub/sub
  streamOutput(sim);

  // Handle process exit
  proc.exited.then((exitCode) => {
    server.publish(`sim:${id}`, JSON.stringify({
      type: "sim_exit",
      exitCode,
      signal: proc.signalCode,
    }));
    cleanup(id);
  });

  return id;
}

async function streamOutput(sim: Simulation) {
  const reader = sim.process.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        server.publish(`sim:${sim.id}`, line);
      }
    }
  }
}

function stopSimulation(id: string) {
  const sim = simulations.get(id);
  if (!sim) return;
  sim.process.kill();
  clearTimeout(sim.timeout);
  cleanup(id);
}
```

### Pattern 5: GCC Compilation with JSON Diagnostics

**What:** Invoke GCC with `-fdiagnostics-format=json` to get structured error output.

**When to use:** Every compile request.

**Example:**
```typescript
// src/server/compiler/compile.ts
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HAL_INCLUDE_PATH = join(import.meta.dir, "../../../hal/include");
const HAL_SOURCES = [
  join(import.meta.dir, "../../../hal/src/hal_gpio.c"),
  join(import.meta.dir, "../../../hal/src/hal_system.c"),
  join(import.meta.dir, "../../../hal/src/hal_uart.c"),
  join(import.meta.dir, "../../../hal/src/hal_spi.c"),
  join(import.meta.dir, "../../../hal/src/hal_i2c.c"),
  join(import.meta.dir, "../../../hal/src/sim_runtime.c"),
];

interface CompileResult {
  success: boolean;
  compilationId?: string;
  binaryPath?: string;
  errors: DiagnosticMessage[];
  warnings: DiagnosticMessage[];
  rawOutput: string;
}

interface DiagnosticMessage {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "note";
  message: string;
  option?: string;
}

async function compile(code: string): Promise<CompileResult> {
  const workDir = await mkdtemp(join(tmpdir(), "stm32sim-"));
  const userFile = join(workDir, "main.c");
  const outputBinary = join(workDir, "firmware");

  await writeFile(userFile, code);

  const proc = Bun.spawnSync([
    "gcc",
    "-fdiagnostics-format=json",
    "-I", HAL_INCLUDE_PATH,
    "-o", outputBinary,
    userFile,
    ...HAL_SOURCES,
    "-lm",  // math library
  ], {
    stderr: "pipe",
  });

  const rawOutput = proc.stderr.toString();

  if (proc.success) {
    const compilationId = crypto.randomUUID();
    return {
      success: true,
      compilationId,
      binaryPath: outputBinary,
      errors: [],
      warnings: parseGccJson(rawOutput, "warning"),
      rawOutput,
    };
  }

  return {
    success: false,
    errors: parseGccJson(rawOutput, "error"),
    warnings: parseGccJson(rawOutput, "warning"),
    rawOutput,
  };
}

function parseGccJson(raw: string, filterKind?: string): DiagnosticMessage[] {
  // GCC outputs JSON array to stderr with -fdiagnostics-format=json
  try {
    const diagnostics = JSON.parse(raw);
    return diagnostics
      .filter((d: any) => !filterKind || d.kind === filterKind)
      .map((d: any) => ({
        file: d.locations?.[0]?.caret?.file || "unknown",
        line: d.locations?.[0]?.caret?.line || 0,
        column: d.locations?.[0]?.caret?.column || 0,
        severity: d.kind,
        message: d.message,
        option: d.option,
      }));
  } catch {
    // If JSON parsing fails, return raw as a single error
    return [{ file: "unknown", line: 0, column: 0, severity: "error", message: raw }];
  }
}
```

### Anti-Patterns to Avoid
- **Buffered stdout in C subprocess:** If stdout is not set to unbuffered mode (`setvbuf(stdout, NULL, _IONBF, 0)`), output will be block-buffered (4096 bytes) when piped, causing events to arrive in batches instead of real-time. This is the single most common cause of "events are delayed" bugs.
- **Parsing GCC text output with regex:** GCC's text error format varies between versions and locales. Use `-fdiagnostics-format=json` instead.
- **Polling for process exit:** Use `proc.exited` Promise instead of polling `proc.exitCode`.
- **Global mutable state for simulations:** Each simulation should be isolated with its own process, state, and cleanup. Use a Map keyed by simulation ID.
- **Not cleaning up temp directories:** Every compilation creates a temp directory. Use try/finally or process exit hooks to clean up.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP server + routing | Express-like router from scratch | `Bun.serve()` with `routes` | Built-in, zero deps, SIMD-accelerated routing |
| WebSocket server | Manual upgrade handling | `Bun.serve()` `websocket` option | Built on uWebSockets, handles upgrade/pub-sub natively |
| GCC error parsing | Regex-based gcc output parser | `gcc -fdiagnostics-format=json` | Authoritative, handles all edge cases, locale-independent |
| Process spawning | `child_process` Node compat | `Bun.spawn()` / `Bun.spawnSync()` | 60% faster, native streaming stdout |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Built into Bun runtime |
| JSON line splitting | Custom parser | TextDecoder + split('\n') | Simple, handles streaming chunks correctly |
| STM32 HAL types | Simplified custom types | Real STM32F4 HAL type definitions | Must match what STM32CubeIDE generates (user constraint) |

**Key insight:** Bun's built-in APIs (serve, spawn, WebSocket) eliminate every dependency that would normally be needed. Phase 1 should have zero npm dependencies.

## Common Pitfalls

### Pitfall 1: stdout Buffering Kills Real-Time Streaming
**What goes wrong:** GPIO events from the C subprocess arrive in 4KB batches instead of one-by-one.
**Why it happens:** When stdout is piped (not a terminal), C's stdio defaults to block buffering (4096 bytes). Events accumulate in the buffer until it fills or the process exits.
**How to avoid:** Call `setvbuf(stdout, NULL, _IONBF, 0)` at the very start of the simulation's main() before any HAL calls. Alternatively, use `setlinebuf(stdout)` for line buffering (events end with `\n`).
**Warning signs:** Events only appear when the simulation exits or after long delays.

### Pitfall 2: Orphaned Simulation Processes
**What goes wrong:** Compiled binaries keep running after the WebSocket client disconnects or the server restarts.
**Why it happens:** No cleanup on WebSocket close, no timeout enforcement, or the process ignores SIGTERM.
**How to avoid:** (1) Set a configurable timeout (default 30s) per simulation. (2) Kill the process on WebSocket close if it's the last client. (3) Track all active simulations in a Map and kill them on server shutdown. (4) Use `proc.exited` Promise to detect unexpected exits.
**Warning signs:** `ps aux | grep firmware` shows zombie processes after client disconnects.

### Pitfall 3: GCC JSON Output Mixed with Text
**What goes wrong:** GCC's `-fdiagnostics-format=json` puts JSON on stderr, but linker errors may still be text on stderr. The JSON parser chokes on mixed content.
**Why it happens:** The JSON format flag only affects GCC's own diagnostics, not the linker's. Linker errors (undefined reference, missing library) come as plain text.
**How to avoid:** Try JSON parsing first; if it fails, fall back to regex-based parsing for linker errors. Distinguish compilation vs. linker errors in the response.
**Warning signs:** `JSON.parse()` throws on certain error types.

### Pitfall 4: GPIO Pin Numbering Confusion
**What goes wrong:** Pin masks like `GPIO_PIN_5` (0x0020) get reported as "pin 32" or the wrong pin number.
**Why it happens:** STM32 uses bitmask representation (`GPIO_PIN_5 = (1 << 5) = 0x0020`), not sequential numbers. The event JSON must decode the bitmask to a pin number.
**How to avoid:** In the HAL stub, convert bitmask to pin number: `for (int i = 0; i < 16; i++) if (pin_mask & (1 << i)) emit_for_pin(i);`. Emit one event per pin if multiple pins are in the mask.
**Warning signs:** Frontend shows wrong LEDs lighting up, or pin table shows wrong pins.

### Pitfall 5: Race Between Process Exit and stdout Drain
**What goes wrong:** The simulation process exits before all stdout data is read, causing the last few events to be lost.
**Why it happens:** `proc.exited` resolves when the process exits, but the stdout ReadableStream may still have buffered data.
**How to avoid:** Always drain stdout completely (read until `done: true`) before processing the exit event. The `for await` loop on the ReadableStream handles this correctly -- it completes when the stream closes, not when the process exits.
**Warning signs:** Last GPIO state change before process exit is missing from WebSocket stream.

### Pitfall 6: Temp Directory Accumulation
**What goes wrong:** Thousands of temp directories fill up disk after many compilations.
**Why it happens:** Each compilation creates a new `mkdtemp` directory with the user's source and compiled binary. Without cleanup, they accumulate.
**How to avoid:** Clean up temp directories after the simulation ends (not after compilation, since the binary needs to persist). Use a cleanup-on-exit handler for the simulation. Consider a periodic sweep for orphaned directories older than 1 hour.
**Warning signs:** `ls /tmp/stm32sim-*` shows thousands of directories.

## Code Examples

### STM32 HAL Type Definitions (Mock Headers)

```c
// hal/include/stm32f4xx_hal_def.h
#ifndef __STM32F4xx_HAL_DEF_H
#define __STM32F4xx_HAL_DEF_H

#include <stdint.h>

typedef enum {
  HAL_OK       = 0x00U,
  HAL_ERROR    = 0x01U,
  HAL_BUSY     = 0x02U,
  HAL_TIMEOUT  = 0x03U
} HAL_StatusTypeDef;

#define __IO volatile
#define __I  volatile const

typedef enum { RESET = 0, SET = !RESET } FlagStatus, ITStatus;
typedef enum { DISABLE = 0, ENABLE = !DISABLE } FunctionalState;

#define UNUSED(X) (void)X

#endif
```

```c
// hal/include/stm32f4xx_hal_gpio.h
#ifndef __STM32F4xx_HAL_GPIO_H
#define __STM32F4xx_HAL_GPIO_H

#include "stm32f4xx_hal_def.h"

typedef struct {
  __IO uint32_t MODER;
  __IO uint32_t OTYPER;
  __IO uint32_t OSPEEDR;
  __IO uint32_t PUPDR;
  __IO uint32_t IDR;
  __IO uint32_t ODR;
  __IO uint32_t BSRR;
  __IO uint32_t LCKR;
  __IO uint32_t AFR[2];
} GPIO_TypeDef;

typedef struct {
  uint32_t Pin;
  uint32_t Mode;
  uint32_t Pull;
  uint32_t Speed;
  uint32_t Alternate;
} GPIO_InitTypeDef;

typedef enum {
  GPIO_PIN_RESET = 0,
  GPIO_PIN_SET
} GPIO_PinState;

// Pin definitions (bitmask)
#define GPIO_PIN_0    ((uint16_t)0x0001)
#define GPIO_PIN_1    ((uint16_t)0x0002)
#define GPIO_PIN_2    ((uint16_t)0x0004)
#define GPIO_PIN_3    ((uint16_t)0x0008)
#define GPIO_PIN_4    ((uint16_t)0x0010)
#define GPIO_PIN_5    ((uint16_t)0x0020)
#define GPIO_PIN_6    ((uint16_t)0x0040)
#define GPIO_PIN_7    ((uint16_t)0x0080)
#define GPIO_PIN_8    ((uint16_t)0x0100)
#define GPIO_PIN_9    ((uint16_t)0x0200)
#define GPIO_PIN_10   ((uint16_t)0x0400)
#define GPIO_PIN_11   ((uint16_t)0x0800)
#define GPIO_PIN_12   ((uint16_t)0x1000)
#define GPIO_PIN_13   ((uint16_t)0x2000)
#define GPIO_PIN_14   ((uint16_t)0x4000)
#define GPIO_PIN_15   ((uint16_t)0x8000)
#define GPIO_PIN_All  ((uint16_t)0xFFFF)

// Mode definitions
#define GPIO_MODE_INPUT          0x00000000U
#define GPIO_MODE_OUTPUT_PP      0x00000001U
#define GPIO_MODE_OUTPUT_OD      0x00000011U
#define GPIO_MODE_AF_PP          0x00000002U
#define GPIO_MODE_AF_OD          0x00000012U
#define GPIO_MODE_ANALOG         0x00000003U

// Pull definitions
#define GPIO_NOPULL              0x00000000U
#define GPIO_PULLUP              0x00000001U
#define GPIO_PULLDOWN            0x00000002U

// Speed definitions
#define GPIO_SPEED_FREQ_LOW      0x00000000U
#define GPIO_SPEED_FREQ_MEDIUM   0x00000001U
#define GPIO_SPEED_FREQ_HIGH     0x00000002U
#define GPIO_SPEED_FREQ_VERY_HIGH 0x00000003U

// GPIO port instances (allocated in hal_gpio.c as global structs)
extern GPIO_TypeDef _GPIOA_Instance, _GPIOB_Instance, _GPIOC_Instance,
                    _GPIOD_Instance, _GPIOE_Instance;
#define GPIOA (&_GPIOA_Instance)
#define GPIOB (&_GPIOB_Instance)
#define GPIOC (&_GPIOC_Instance)
#define GPIOD (&_GPIOD_Instance)
#define GPIOE (&_GPIOE_Instance)

// Function prototypes
void HAL_GPIO_Init(GPIO_TypeDef *GPIOx, GPIO_InitTypeDef *GPIO_Init);
void HAL_GPIO_DeInit(GPIO_TypeDef *GPIOx, uint32_t GPIO_Pin);
GPIO_PinState HAL_GPIO_ReadPin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin);
void HAL_GPIO_WritePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin, GPIO_PinState PinState);
void HAL_GPIO_TogglePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin);
HAL_StatusTypeDef HAL_GPIO_LockPin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin);

#endif
```

### Blink LED Sample (Authentic STM32CubeIDE Style)

```c
// samples/blink/main.c
/**
 * STM32 Blink LED Example
 *
 * Classic "Hello World" for microcontrollers.
 * Toggles the LED on PA5 (pin 5 of GPIO port A) every 500ms.
 *
 * On the STM32 Nucleo-F401RE board, PA5 is connected to the green LED (LD2).
 * This code looks exactly like what STM32CubeIDE generates.
 */

#include "stm32f4xx_hal.h"

/* Private function prototypes */
void SystemClock_Config(void);
static void MX_GPIO_Init(void);

int main(void)
{
  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* Configure the system clock */
  SystemClock_Config();

  /* Initialize all configured peripherals */
  MX_GPIO_Init();

  /* Infinite loop */
  while (1)
  {
    /* Toggle LED on PA5 */
    HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);

    /* Wait 500ms */
    HAL_Delay(500);
  }
}

/**
 * @brief GPIO Initialization Function
 *
 * Configures PA5 as a push-pull output. This is how STM32CubeIDE
 * generates GPIO initialization code.
 */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};

  /* GPIO Port A Clock Enable - in real STM32, this enables the clock
     to the GPIO peripheral. Our simulator stub accepts this as a no-op. */
  __HAL_RCC_GPIOA_CLK_ENABLE();

  /* Configure GPIO pin Output Level - start with LED off */
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);

  /* Configure GPIO pin: PA5 (LED) */
  GPIO_InitStruct.Pin = GPIO_PIN_5;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;  /* Push-pull output */
  GPIO_InitStruct.Pull = GPIO_NOPULL;           /* No pull-up/pull-down */
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;  /* Low speed is fine for LED */
  HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
}
```

### GCC JSON Diagnostic Output Format (Verified with GCC 13.3.0)

```json
[
  {
    "kind": "warning",
    "message": "initialization of 'int' from 'char *' makes integer from pointer without a cast",
    "option": "-Wint-conversion",
    "option_url": "https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html#index-Wint-conversion",
    "children": [],
    "column-origin": 1,
    "locations": [
      {
        "caret": {
          "file": "/tmp/test_diag.c",
          "line": 1,
          "display-column": 22,
          "byte-column": 22,
          "column": 22
        },
        "finish": {
          "file": "/tmp/test_diag.c",
          "line": 1,
          "display-column": 28,
          "byte-column": 28,
          "column": 28
        }
      }
    ],
    "escape-source": false
  }
]
```

**Note:** GCC 13 outputs JSON diagnostics as an array on stderr. Fields: `kind` (error/warning/note), `message`, `locations[].caret.{file, line, column}`, `option` (which flag controls it), `children` (sub-diagnostics). This was verified by running `gcc -fdiagnostics-format=json` on the installed GCC 13.3.0.

### Recommended Event JSON Format (Claude's Discretion)

```typescript
// State event sent over WebSocket
interface SimulationEvent {
  type: "gpio_init" | "gpio_write" | "gpio_read" | "delay" | "sim_start" | "sim_exit" | "error";
  timestamp_ms: number;   // Milliseconds since simulation start (from CLOCK_MONOTONIC)
  data: Record<string, unknown>;  // Type-specific payload
}

// gpio_write event (most common)
// { "type": "gpio_write", "timestamp_ms": 1234, "data": { "port": "A", "pin": 5, "state": 1 } }

// gpio_init event
// { "type": "gpio_init", "timestamp_ms": 0, "data": { "port": "A", "pins": [5], "mode": "output_pp" } }

// sim_start event (first event)
// { "type": "sim_start", "timestamp_ms": 0, "data": { "speed": 1.0 } }

// sim_exit event (sent by Bun, not the C process)
// { "type": "sim_exit", "timestamp_ms": 5000, "data": { "exitCode": 0, "signal": null } }
```

### Recommended API Endpoints (Claude's Discretion)

```
POST /api/compile        - Submit C code for compilation
  Request:  { "code": "..." }
  Response: { "success": true, "compilationId": "uuid", "errors": [], "warnings": [...] }
            { "success": false, "errors": [...], "warnings": [...], "rawOutput": "..." }

POST /api/run            - Start a simulation from a successful compilation
  Request:  { "compilationId": "uuid", "speed": 1.0, "timeout": 30000 }
  Response: { "simulationId": "uuid", "wsUrl": "ws://localhost:3000/ws?simulationId=uuid" }

POST /api/stop           - Stop a running simulation
  Request:  { "simulationId": "uuid" }
  Response: { "stopped": true }

GET  /api/samples        - List available sample programs
  Response: { "samples": [{ "name": "blink", "title": "Blink LED", "description": "..." }] }

GET  /api/samples/:name  - Get sample source code
  Response: { "name": "blink", "files": [{ "name": "main.c", "content": "..." }] }

WebSocket /ws?simulationId=uuid  - Real-time event stream
  Server sends: line-delimited JSON events (gpio_write, gpio_init, delay, sim_start, sim_exit)
  Client sends: { "type": "gpio_input", "port": "A", "pin": 0, "state": 1 } (for button sim)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GCC text error parsing with regex | `gcc -fdiagnostics-format=json` | GCC 9 (2019) | Structured errors without fragile parsing |
| Node.js + Express + ws | Bun.serve() with built-in routing + WebSocket | Bun 1.2.3 (2025) | Zero-dependency server with better performance |
| `child_process.spawn()` | `Bun.spawn()` | Bun 1.0 (2023) | 60% faster process spawning, native streaming |
| Manual WebSocket pub/sub | `Bun.serve()` pub/sub API | Bun 1.0 (2023) | Built-in topic-based broadcasting |

**Deprecated/outdated:**
- GCC `-fdiagnostics-format=json` is deprecated in GCC 15, removed in GCC 16 (in favor of SARIF). GCC 13.3.0 (installed) fully supports it. No action needed now, but if GCC is upgraded to 15+, switch to SARIF or keep GCC 13.
- Bun `routes` + `websocket` TypeScript types conflict was fixed in @types/bun 1.2.6. Ensure types package is current.

## Open Questions

1. **GPIO Input Mechanism (Button Sample)**
   - What we know: The button-led sample needs PA0 to be readable as input. The WebSocket client will send `gpio_input` messages.
   - What's unclear: How does the Bun server deliver the input state to the C subprocess? Options: (a) Write to stdin and have the C process poll, (b) Use a shared file/pipe, (c) Environment variable polled periodically.
   - Recommendation: Use stdin -- `Bun.spawn()` supports `stdin: "pipe"`, and the C process can read from stdin in a non-blocking way or check a flag set by a signal handler. Simplest: have `HAL_GPIO_ReadPin()` check a global that's updated by a background thread reading stdin. For Phase 1 demo, a simpler approach works: have the button sample use a timer-based toggle pattern, and wire real input in Phase 2.

2. **Simulation Speed Multiplier Mechanism**
   - What we know: HAL_Delay() should use `usleep(ms / speed_multiplier * 1000)`. Speed is configurable.
   - What's unclear: Can speed be changed mid-simulation, or only at start?
   - Recommendation: Start with speed set at simulation launch via environment variable. Changing mid-simulation would require stdin-based messaging -- defer to Phase 2 if needed.

3. **Concurrent Simulation Limit**
   - What we know: Each simulation is a subprocess consuming resources.
   - What's unclear: Should there be a limit on concurrent simulations?
   - Recommendation: Limit to a reasonable number (e.g., 10) with a clear error when exceeded. For demo purposes, even 1 at a time is fine.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test runner (built-in, `bun test`) |
| Config file | none -- see Wave 0 |
| Quick run command | `bun test --filter "phase1"` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | POST code, receive compiled binary or errors | integration | `bun test tests/compile.test.ts -x` | Wave 0 |
| COMP-01 | GCC JSON error parsing works correctly | unit | `bun test tests/error-parser.test.ts -x` | Wave 0 |
| COMP-01 | Mock HAL headers compile with user code | integration | `bun test tests/hal-compile.test.ts -x` | Wave 0 |
| COMP-02 | Compiled blink sample emits GPIO events to stdout | integration | `bun test tests/simulation-run.test.ts -x` | Wave 0 |
| COMP-02 | WebSocket receives real-time events from simulation | integration | `bun test tests/ws-stream.test.ts -x` | Wave 0 |
| COMP-02 | Simulation stops after timeout | unit | `bun test tests/process-manager.test.ts -x` | Wave 0 |
| COMP-03 | Compilation errors returned as structured JSON | unit | `bun test tests/error-parser.test.ts -x` | Wave 0 |
| COMP-03 | Warnings separated from errors | unit | `bun test tests/error-parser.test.ts -x` | Wave 0 |
| COMP-03 | Linker errors handled gracefully | unit | `bun test tests/error-parser.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test --filter "phase1"`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/compile.test.ts` -- covers COMP-01 compilation flow
- [ ] `tests/error-parser.test.ts` -- covers COMP-01, COMP-03 error parsing
- [ ] `tests/hal-compile.test.ts` -- covers COMP-01 HAL stub compilation
- [ ] `tests/simulation-run.test.ts` -- covers COMP-02 execution and stdout streaming
- [ ] `tests/ws-stream.test.ts` -- covers COMP-02 WebSocket broadcasting
- [ ] `tests/process-manager.test.ts` -- covers COMP-02 timeout and cleanup
- [ ] Bun test runner setup: `bunfig.toml` with test configuration
- [ ] Framework install: `curl -fsSL https://bun.com/install | bash` -- Bun not yet installed

## Sources

### Primary (HIGH confidence)
- GCC 13.3.0 `-fdiagnostics-format=json` -- verified by running on installed GCC, output structure confirmed
- [Bun HTTP/WebSocket docs](https://bun.com/docs/runtime/http/websockets) -- Bun.serve() with routes + WebSocket API
- [Bun spawn docs](https://bun.com/docs/runtime/child-process) -- Bun.spawn() API with streaming stdout
- [Bun routing docs](https://bun.com/docs/runtime/http/routing) -- Built-in routes with path params
- [STM32F4 HAL GPIO header](https://github.com/dhylands/stm32-test/blob/master/hal/f4/stm32f4xx_hal_gpio.h) -- GPIO type definitions and function prototypes
- [STM32F439xx HAL manual](https://www.disca.upv.es/aperles/arm_cortex_m3/llibre/st/STM32F439xx_User_Manual/group__hal__exported__functions__group1.html) -- HAL_Init, HAL_Delay signatures

### Secondary (MEDIUM confidence)
- [GCC diagnostic format docs](https://gcc.gnu.org/onlinedocs/gcc/Diagnostic-Message-Formatting-Options.html) -- JSON format deprecation in GCC 15/16
- [Bun routes + websocket type fix](https://github.com/oven-sh/bun/issues/18314) -- TypeScript types issue resolved in @types/bun 1.2.6
- [STM32 GPIO TypeDef struct](https://gist.github.com/iwalpola/6c36c9573fd322a268ce890a118571ca) -- GPIO register layout

### Tertiary (LOW confidence)
- GPIO input mechanism (stdin-based IPC) -- design recommendation, not verified with working prototype

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- GCC verified on system, Bun APIs well-documented with current official docs
- Architecture: HIGH -- stdout JSON protocol is proven pattern, Bun serve/spawn APIs verified
- Pitfalls: HIGH -- stdout buffering, orphaned processes, and GCC JSON parsing are well-known issues with documented solutions
- HAL type definitions: HIGH -- verified against official ST HAL headers on GitHub
- GPIO input mechanism: LOW -- stdin IPC approach is theoretical, needs prototyping

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain, 30-day validity)
