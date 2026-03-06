# Architecture Patterns

**Domain:** Web-based STM32 microcontroller simulator
**Researched:** 2026-03-05

## Recommended Architecture

The system follows a **three-tier architecture**: a browser-based frontend for code editing and visualization, a Bun backend for compilation orchestration and simulation execution, and a sandboxed compilation service using `arm-none-eabi-gcc`. Communication between frontend and backend uses HTTP REST for compilation requests and WebSocket for real-time simulation state streaming.

### Why This Shape

Full CPU emulation (QEMU-style) is explicitly out of scope per PROJECT.md. The architecture instead uses a **HAL-intercept pattern**: user-written STM32 C code is compiled against a mock HAL layer that replaces real hardware register access with function calls that report state changes back to the simulation engine. This avoids the complexity of instruction-level emulation (ARM Cortex-M4 decode, pipeline simulation, memory-mapped I/O interception) while still letting users write real STM32 HAL code.

This is the same pattern described by Nathan Jones in "Simulating Your Embedded Project on Your Computer" -- separate hardware-dependent code into its own source file, provide a desktop-compatible implementation that substitutes printf/state-tracking for actual register writes, and compile the whole thing natively. The difference here is that "natively" means on the server (or compiled to a form the server can execute), not on the user's desktop.

```
+--------------------------------------------------+
|                    BROWSER                        |
|                                                   |
|  +------------+  +------------+  +--------------+ |
|  | Code Editor|  | Simulation |  | Peripheral   | |
|  | (Monaco)   |  | Controls   |  | Visualizers  | |
|  +------+-----+  +------+-----+  +-------+------+ |
|         |               |                |         |
|         +-------+-------+--------+-------+         |
|                 |                |                  |
|           HTTP REST        WebSocket               |
+--------------------------------------------------+
                  |                |
+--------------------------------------------------+
|                  BUN SERVER                        |
|                                                    |
|  +----------------+  +-------------------------+   |
|  | Compilation    |  | Simulation Engine        |   |
|  | Service        |  |                          |   |
|  |                |  |  +--------------------+  |   |
|  | - Receives .c  |  |  | HAL Mock Layer     |  |   |
|  | - Prepends     |  |  | (captures GPIO,    |  |   |
|  |   mock HAL     |  |  |  UART, SPI, I2C    |  |   |
|  | - Compiles     |  |  |  calls as events)  |  |   |
|  | - Returns      |  |  +--------------------+  |   |
|  |   executable   |  |  | State Manager      |  |   |
|  |   or errors    |  |  | (pin states, UART  |  |   |
|  +-------+--------+  |  |  buffers, bus data) |  |   |
|          |            |  +--------------------+  |   |
|          |            |  | Execution Runner   |  |   |
|          +----------->|  | (runs compiled     |  |   |
|                       |  |  code as subprocess)|  |   |
|                       |  +--------------------+  |   |
|                       +-----------+--------------+   |
|                                   |                  |
|                            WebSocket                 |
+--------------------------------------------------+
                                    |
                              To Browser
```

### Component Boundaries

| Component | Responsibility | Communicates With | Technology |
|-----------|---------------|-------------------|------------|
| **Code Editor** | Text editing, syntax highlighting, file management, sample project loading | Compilation Service (HTTP), Simulation Controls | Monaco Editor, frontend framework |
| **Simulation Controls** | Start/stop/reset simulation, speed control | Simulation Engine (WebSocket) | Frontend framework |
| **Peripheral Visualizers** | Render LED states, UART console, pin state table, SPI/I2C bus data | Simulation Engine (WebSocket, receive only) | Frontend framework, Canvas/SVG |
| **Compilation Service** | Receive source code, inject mock HAL headers, invoke compiler, return binary or errors | Code Editor (HTTP), Simulation Engine (internal) | Bun HTTP server, arm-none-eabi-gcc in sandbox |
| **Mock HAL Layer** | Provide stm32f4xx_hal compatible function signatures that emit state-change events instead of accessing hardware registers | Compiled into user code, events consumed by State Manager | C source files (shipped with server) |
| **State Manager** | Track all peripheral state (144 GPIO pins, UART buffers, SPI/I2C bus), apply state changes, broadcast deltas | Execution Runner (receives events), WebSocket (sends state) | TypeScript, in-memory state |
| **Execution Runner** | Run compiled user firmware as a sandboxed subprocess, relay HAL events to State Manager | Compilation Service (receives binary), State Manager (sends events) | Bun subprocess, IPC via stdout/pipe |

### Data Flow

**Compilation Flow (HTTP, request-response):**

```
User writes code in editor
    |
    v
POST /api/compile  { source: string, files?: File[] }
    |
    v
Server prepends mock HAL includes to user source
    |
    v
arm-none-eabi-gcc compiles (or native gcc with mock HAL)
    |
    v
Returns: { success: bool, binary?: path, errors?: CompileError[] }
```

**Simulation Flow (WebSocket, streaming):**

```
User clicks "Run"
    |
    v
WS message: { type: "start" }
    |
    v
Server spawns compiled binary as subprocess
    |
    v
Binary executes user's main() with mock HAL
    |
    v
Each HAL call (e.g., HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET))
  writes a structured event to stdout:
  {"peripheral":"gpio","port":"A","pin":5,"state":"high","tick":12345}
    |
    v
State Manager applies event to in-memory state
    |
    v
State deltas broadcast via WebSocket:
  {"type":"state","gpio":{"A5":"high"},"tick":12345}
    |
    v
Browser updates LED visualization, pin table
```

**UART Output Flow:**

```
User code calls HAL_UART_Transmit(&huart2, data, len, timeout)
    |
    v
Mock HAL writes: {"peripheral":"uart","instance":2,"data":"Hello\\n","tick":12400}
    |
    v
State Manager buffers UART output
    |
    v
WebSocket: {"type":"uart","instance":2,"data":"Hello\\n"}
    |
    v
Browser appends to UART console panel
```

## Critical Architectural Decision: Compilation Target

There are two viable approaches for what the compiler actually produces. This is the most consequential architecture decision in the project.

### Option A: Compile to Native Host Binary (RECOMMENDED)

Compile user C code + mock HAL with the server's native `gcc` (not arm-none-eabi-gcc) to produce a Linux executable that runs as a subprocess on the server.

**Pros:**
- Simple execution model -- just spawn a process
- Mock HAL is plain C with printf/stdout for event emission
- No ELF parsing, no ARM instruction decoding
- Native execution speed
- Easy to sandbox with process-level isolation (nsjail, seccomp, or container)

**Cons:**
- User code that uses ARM-specific intrinsics or inline assembly will not compile
- Not "real" cross-compilation (but we are not claiming to be QEMU)

### Option B: Cross-Compile to ARM ELF + Emulate

Use arm-none-eabi-gcc to produce an ARM ELF binary, then use an emulator (Unicorn, QEMU user-mode) to execute it, intercepting memory-mapped register accesses via hooks.

**Pros:**
- Users can use ARM intrinsics
- Closer to real hardware behavior

**Cons:**
- Dramatically more complex (ELF loading, ARM instruction emulation, register map hooking)
- Requires SVD file parsing for 1537+ registers on STM32F407
- Performance overhead from instruction-level emulation
- Debugging emulator bugs is hard

### Recommendation

**Use Option A (native compilation with mock HAL).** The project is explicitly a demo/proof-of-concept, not a production emulator. The mock HAL approach lets users write standard STM32 HAL code (HAL_GPIO_WritePin, HAL_UART_Transmit, etc.) and see results, which delivers the core value proposition. Users who need ARM intrinsics or cycle-accurate behavior need QEMU or real hardware -- that is out of scope.

If the project later needs to support arm-none-eabi-gcc compiled code, Option B can be layered on top without changing the frontend or state management architecture. The event format from the mock HAL is identical regardless of how the binary is executed.

## Patterns to Follow

### Pattern 1: Mock HAL as Event Emitter

The mock HAL layer replaces STM32 HAL functions with implementations that emit structured JSON events to stdout. User code includes the same headers and calls the same functions -- it does not know it is running in a simulator.

**What:** Each HAL function writes a JSON line to stdout describing what happened.
**When:** Every peripheral interaction in user code.
**Example:**

```c
// mock_hal/stm32f4xx_hal_gpio.h
#include <stdio.h>

typedef struct { int port_id; } GPIO_TypeDef;

// Mirror real HAL pin definitions
#define GPIO_PIN_0  ((uint16_t)0x0001)
#define GPIO_PIN_5  ((uint16_t)0x0020)

extern GPIO_TypeDef gpioa_instance;
#define GPIOA (&gpioa_instance)

static inline void HAL_GPIO_WritePin(GPIO_TypeDef* GPIOx, uint16_t pin, int state) {
    fprintf(stdout, "{\"p\":\"gpio\",\"port\":%d,\"pin\":%d,\"val\":%d}\n",
            GPIOx->port_id, pin, state);
    fflush(stdout);
}

static inline int HAL_GPIO_ReadPin(GPIO_TypeDef* GPIOx, uint16_t pin) {
    // Read from simulation input (stdin or shared memory)
    // For now, return default low
    return 0;
}
```

```c
// User code -- identical to real STM32 code
#include "stm32f4xx_hal.h"

int main(void) {
    HAL_Init();
    while (1) {
        HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);
        HAL_Delay(500);
        HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
        HAL_Delay(500);
    }
}
```

### Pattern 2: State Delta Broadcasting

Rather than sending the full peripheral state on every change, broadcast only what changed. This keeps WebSocket traffic manageable even with rapid GPIO toggling.

**What:** State Manager tracks previous state, computes diff, sends only deltas.
**When:** Every state change from the Execution Runner.
**Example:**

```typescript
// State Manager
interface PeripheralState {
  gpio: Record<string, Record<number, "high" | "low">>;  // port -> pin -> state
  uart: Record<number, string[]>;  // instance -> output buffer
  spi: Record<number, { tx: number[], rx: number[] }>;
  i2c: Record<number, { tx: number[], rx: number[] }>;
}

function computeDelta(prev: PeripheralState, next: PeripheralState): object {
  // Return only changed fields
}
```

### Pattern 3: Compilation Sandboxing

User-submitted C code must never be able to harm the server. Use process isolation.

**What:** Compile and run user code in a restricted environment.
**When:** Every compilation and execution request.
**Approach:**

```
Compilation:
  - Timeout: 10 seconds
  - No network access
  - Read-only filesystem except /tmp work directory
  - Memory limit: 256MB
  - Output size limit: 10MB

Execution:
  - Timeout: 30 seconds (configurable simulation duration)
  - No network access
  - No filesystem access beyond the binary itself
  - Memory limit: 64MB
  - stdout captured by parent process for event parsing
```

For a demo/PoC, Bun's subprocess spawning with timeout + resource limits via ulimit is sufficient. For production, nsjail (as used by Compiler Explorer) or Docker containers provide stronger isolation.

### Pattern 4: Simulated Time

User code calls HAL_Delay(ms) which should not actually sleep for real milliseconds -- that would make a 10-second firmware loop take 10 real seconds. Instead, the mock HAL tracks a virtual tick counter and emits timing events.

**What:** Virtual time that advances based on HAL_Delay calls, not wall clock.
**When:** Any time-dependent user code.
**Example:**

```c
// mock_hal/stm32f4xx_hal.c
static uint32_t virtual_tick = 0;

uint32_t HAL_GetTick(void) {
    return virtual_tick;
}

void HAL_Delay(uint32_t delay_ms) {
    virtual_tick += delay_ms;
    fprintf(stdout, "{\"p\":\"tick\",\"val\":%u}\n", virtual_tick);
    fflush(stdout);
}
```

The browser can then animate state changes over time rather than displaying them all instantly.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Full Register-Level Emulation for a Demo

**What:** Implementing all 1537 STM32F407 registers with proper read/write semantics, bit masking, and side effects.
**Why bad:** Enormous complexity for zero user-visible benefit in a demo. The nviennot/stm32-emulator project demonstrates this requires SVD file parsing, memory-mapped I/O hooks, and per-register behavior modeling. That is a multi-month effort.
**Instead:** Use the mock HAL approach. Users call HAL_GPIO_WritePin(), the mock implements it as an event emission. No registers needed.

### Anti-Pattern 2: Polling for State Updates

**What:** Frontend polling the server every 100ms for peripheral state.
**Why bad:** Introduces latency, wastes bandwidth, and does not scale. A GPIO pin toggling at 1KHz would require 10x polling rate to capture accurately.
**Instead:** Use WebSocket with server-push state deltas. Bun's native WebSocket implementation handles 7x more throughput than Node.js + ws.

### Anti-Pattern 3: Monolithic Simulation Process

**What:** Running compilation, execution, and state management in the same process as the web server.
**Why bad:** A hung user binary blocks the server. A compilation OOM crashes everything. No isolation between users.
**Instead:** Compilation and execution run as separate subprocesses with timeouts and resource limits. The Bun server process only manages WebSocket connections and state.

### Anti-Pattern 4: Compiling on Every Keystroke

**What:** Triggering server-side compilation as the user types, like a linter.
**Why bad:** arm-none-eabi-gcc (or even native gcc) takes 1-3 seconds per compilation. This would overwhelm the server and produce a terrible UX with constant error flashing.
**Instead:** Compile only on explicit user action (click "Build" or "Run"). Use client-side syntax highlighting for instant feedback.

## Component Build Order

Dependencies between components dictate the implementation order.

```
Phase 1: Mock HAL Layer + Compilation Service
  |  (Can be tested standalone: compile C code, verify events on stdout)
  v
Phase 2: Execution Runner + State Manager
  |  (Can be tested standalone: run a binary, verify state tracking)
  v
Phase 3: WebSocket Bridge
  |  (Connect State Manager to browser, verify state arrives)
  v
Phase 4: Frontend - Code Editor + Controls
  |  (Can be tested against the backend API)
  v
Phase 5: Frontend - Peripheral Visualizers (LEDs, UART console, Pin Table)
  |  (Consumes WebSocket state, pure rendering)
  v
Phase 6: SPI/I2C Loopback + Polish
  (Extends mock HAL with SPI/I2C, adds visualization)
```

**Why this order:**
1. The mock HAL is the foundation -- everything depends on the event format it produces. Building it first lets you validate the entire approach (can real STM32 HAL code compile against it?) before writing any frontend code.
2. State Manager is the second core abstraction -- it defines what the frontend will consume.
3. WebSocket bridge is thin glue between State Manager and browser.
4. Frontend comes after the backend API is stable. Changing the event format after building visualizers causes rework.
5. SPI/I2C loopback is the most optional feature and can be cut if time is short.

## Scalability Considerations

| Concern | Single User (Demo) | 10 Concurrent Users | 100+ Users |
|---------|---------------------|----------------------|------------|
| Compilation | Sequential gcc calls, < 3s each | Queue with concurrency limit (2-3 parallel) | Container pool, separate compilation servers |
| Execution | Single subprocess | Multiple subprocesses with resource limits | Worker pool with per-user memory/CPU caps |
| WebSocket | Single connection | Bun handles easily (7x Node.js throughput) | Standard WebSocket scaling, consider pub/sub |
| State | In-memory per session | In-memory per session, cleanup on disconnect | Redis-backed state if persistence needed |

For a demo/PoC targeting single-user usage, none of these scalability concerns apply. The architecture supports them if needed later without structural changes.

## Sources

- [nviennot/stm32-emulator](https://github.com/nviennot/stm32-emulator) - Rust-based STM32 emulator using Unicorn + SVD files, demonstrates register-level approach complexity (HIGH confidence)
- [avr8js](https://github.com/wokwi/avr8js) - Wokwi's JavaScript AVR simulator, shows CPU-core-only design with external peripheral glue (HIGH confidence)
- [Simulating Your Embedded Project on Your Computer](https://www.embeddedrelated.com/showarticle/1695.php) - HAL intercept pattern for testing firmware without hardware (HIGH confidence)
- [How Compiler Explorer Works (2025)](https://xania.org/202506/how-compiler-explorer-works) - Server-side compilation architecture with nsjail sandboxing (HIGH confidence)
- [Bun WebSocket Performance](https://lemire.me/blog/2023/11/25/a-simple-websocket-benchmark-in-javascript-node-js-versus-bun/) - Benchmark showing Bun 7x faster than Node.js for WebSocket (MEDIUM confidence)
- [Docker arm-none-eabi-gcc containers](https://github.com/hoo2/gcc-arm-none-eabi-docker) - Containerized ARM cross-compiler approach (HIGH confidence)
- [STM32F4 HAL Documentation (UM1725)](https://www.st.com/resource/en/user_manual/um1725-description-of-stm32f4-hal-and-lowlayer-drivers-stmicroelectronics.pdf) - Official HAL function signatures to mock (HIGH confidence)
- [elflib](https://github.com/jhmaster2000/elflib) - JavaScript ELF parser, relevant if Option B (ARM emulation) is ever pursued (LOW confidence - not recommended path)
- [Wokwi](https://wokwi.com/) - Leading web-based MCU simulator, architecture informed by their open-source components (MEDIUM confidence)
