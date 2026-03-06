# Technology Stack

**Project:** STM32 Virtual Test Bench
**Researched:** 2026-03-05

## Recommended Stack

### Runtime & Server

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Bun | ^1.3.5 | Backend runtime, package manager, test runner | User requirement. All-in-one runtime with native WebSocket support in `Bun.serve()`, fast subprocess spawning via `Bun.spawn()`, built-in TypeScript support. Handles compilation orchestration and real-time state streaming. | HIGH |
| Hono | ^4.12 | HTTP routing & API layer | Ultrafast, zero-dependency web framework built on Web Standards. Under 12kB (`hono/tiny`). First-class Bun support. Provides clean routing for compilation endpoints, file upload, and WebSocket upgrade without the overhead of Express or Elysia. Hono over Elysia because Hono is runtime-agnostic, more widely adopted, and better documented. | HIGH |

### Frontend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Svelte 5 | ^5.53 | UI framework | Compile-time framework producing minimal JS bundles (1/10th of React). Runes reactivity system (`$state`, `$derived`, `$effect`) maps perfectly to reactive simulation state (pin values, UART output, LED states). No virtual DOM overhead means faster updates for real-time simulation data. For a demo/PoC, Svelte's simplicity beats React's ecosystem advantage. | HIGH |
| Vite | ^6.x | Frontend build tool & dev server | Bun's built-in bundler lacks chunk splitting and mature plugin support needed for Svelte compilation. Vite works seamlessly with Bun as runtime (`bun --bun run dev`). `@sveltejs/vite-plugin-svelte` is the official build pipeline. Do NOT use Bun's bundler for the frontend -- it is not ready for framework builds. | HIGH |

### Code Editor

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| CodeMirror 6 | ^6.0 | In-browser C code editor | Modular architecture, ~300KB core (vs Monaco's 5-10MB). `@codemirror/lang-cpp` v6.0.3 provides C/C++ syntax highlighting via Lezer parser -- C is a subset of C++, so this covers STM32 C code. Mobile-friendly, accessible. For a demo app, CodeMirror's small footprint is the right call over Monaco's kitchen-sink approach. | HIGH |
| svelte-codemirror-editor | ^2.1.0 | Svelte wrapper for CodeMirror 6 | Svelte 5 compatible (v2.0 dropped Svelte 3/4). Provides clean component API for binding editor value, extensions, and themes. Actively maintained. | MEDIUM |
| @codemirror/lang-cpp | ^6.0.3 | C/C++ syntax highlighting | Official CodeMirror package. Lezer-based parser handles C syntax (C is a subset of C++ grammar). Provides highlighting, indentation, and bracket matching for STM32 C code. | HIGH |

### UART Console

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @xterm/xterm | ^5.x | Terminal emulator for UART output | Industry-standard web terminal (powers VS Code terminal). Renders ANSI escape codes, handles scrollback, GPU-accelerated rendering. Perfect for displaying UART serial output with authentic terminal feel. Overkill for plain text, but the polished UX is worth the ~200KB. | HIGH |

### Compilation Toolchain

**Two compilers serve two different roles:**

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Host gcc/clang | System default | **Primary compiler**: compiles user C code + mock HAL stubs into a native Linux executable that the server can run | Produces a binary that actually executes on the server CPU. The mock HAL layer replaces real peripheral access with JSON event emission to stdout. This is the execution path. | HIGH |
| arm-none-eabi-gcc | 14.3.Rel1 or 15.2.Rel1 | **Validation compiler** (optional): cross-compiles user C code to verify it is valid STM32 C | Catches ARM-specific syntax errors and validates against real CMSIS headers. Invoked as a secondary check but the resulting ARM ELF is NOT executed. Install via system package manager or Arm's official downloads. Can be deferred to a later phase. | MEDIUM |
| Custom Mock HAL headers | N/A | Provide STM32 HAL-compatible function signatures that emit JSON events instead of accessing hardware | Users write standard STM32 HAL code (`HAL_GPIO_WritePin`, `HAL_UART_Transmit`). Mock implementations compile with host gcc and emit structured events to stdout that the simulation state manager consumes. This is the key architectural pattern. | HIGH |

**Why two compilers?** ARM ELF binaries cannot run on x86/x64 servers. Cross-compiling with arm-none-eabi-gcc produces a binary with no way to execute it without QEMU (which is out of scope). The solution: compile against mock HAL stubs using the host's native gcc to produce a runnable binary, while optionally using arm-none-eabi-gcc only for validation.

### Real-Time Communication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Bun native WebSocket | (built into Bun) | Stream simulation state to browser | Bun's `Bun.serve()` has built-in WebSocket with pub/sub, compression, and backpressure handling. 7x throughput vs Node.js+ws. No external library needed. Handles streaming GPIO pin states, UART output, and LED states from simulation engine to UI in real time. | HIGH |

### Simulation Engine

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom TypeScript state manager | N/A | Peripheral state tracking & WebSocket broadcasting | Parses JSON events from compiled firmware subprocess stdout. Maintains in-memory state for GPIO pins, UART buffers, SPI/I2C bus data. Computes state deltas and broadcasts to browser via WebSocket at throttled intervals (30-60 Hz). | HIGH |
| Custom C mock HAL layer | N/A | Bridge between user STM32 code and simulation engine | C source files that implement STM32 HAL function signatures. Each function writes a JSON event to stdout (`{"p":"gpio","port":0,"pin":5,"val":1}`). Compiled alongside user code with host gcc. This IS the simulation engine's input source. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| @codemirror/theme-one-dark | ^6.x | Dark editor theme | Default theme for the code editor. Professional look with minimal effort. | HIGH |
| @codemirror/autocomplete | ^6.x | Basic autocomplete | Provide completions for STM32 HAL function names and GPIO pin macros. Not critical for v1 but low effort. | MEDIUM |
| bits-ui | Latest | Accessible Svelte UI primitives | Headless UI components (buttons, dialogs, tabs) for the dashboard. Svelte 5 compatible. Use instead of building from scratch. | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Runtime | Bun | Node.js / Deno | User preference for Bun. Bun's native WebSocket and subprocess spawning are also genuinely faster. |
| Server framework | Hono | Elysia | Elysia is Bun-only (vendor lock). Hono is runtime-agnostic, more widely adopted, better documented. Both are fast. |
| Server framework | Hono | Express | Express is legacy Node.js middleware pattern. Hono is lighter, faster, and designed for modern runtimes. |
| Frontend framework | Svelte 5 | React | React's ecosystem advantage does not matter for a demo PoC. Svelte produces smaller bundles, has simpler reactivity for real-time state, and less boilerplate. |
| Frontend framework | Svelte 5 | Vanilla JS | Vanilla is viable for a demo but Svelte's reactivity eliminates manual DOM manipulation for pin state tables and LED visualization. Worth the small overhead. |
| Code editor | CodeMirror 6 | Monaco Editor | Monaco is 5-10MB (overkill for a C-only editor). CodeMirror is modular, ~300KB for what we need. Monaco's IntelliSense is wasted without a language server. |
| Code editor | CodeMirror 6 | Ace Editor | Ace is legacy, not modular, harder to extend. CodeMirror 6 is the modern standard. |
| Build tool | Vite | Bun bundler | Bun's bundler lacks chunk splitting, HMR maturity, and Svelte plugin support. Vite is the official Svelte build tool. |
| Build tool | Vite | Webpack | Webpack is slow and over-configured for a new project. Vite is the 2025 standard. |
| UART display | xterm.js | Custom textarea | xterm.js provides ANSI rendering, scrollback, and terminal aesthetics. A textarea would need manual implementation of all this. |
| UART display | xterm.js | `<pre>` tag | A `<pre>` tag works for basic output but loses copy/paste UX, scrollback, and ANSI color support. |
| Compilation target | Host-native gcc | arm-none-eabi-gcc only | ARM ELF binaries cannot run on x86/x64 servers without QEMU. Native compilation with mock HAL stubs is the only viable execution path within project scope. |
| Simulation approach | Mock HAL (native compile) | Source-level C parsing | Parsing C source to extract peripheral calls is fragile (must handle macros, pointer arithmetic, control flow). Compiling and running the actual code is more reliable -- the HAL stubs capture all interactions automatically. |
| Simulation approach | Mock HAL (native compile) | QEMU/Renode emulation | Full CPU emulation is explicitly out of scope per PROJECT.md. |
| Simulation approach | Mock HAL (native compile) | WASM compilation | Compiling to WASM via Emscripten is viable but adds toolchain complexity. Host-native gcc is simpler for a demo. WASM could be a future option for client-side execution. |
| SvelteKit | No (plain Svelte + Vite) | SvelteKit | SvelteKit adds SSR, file-based routing, and adapter complexity we do not need. This is a single-page app with a separate Bun API server. Keep it simple. |

## Architecture Decision: Mock HAL Native Compilation (CRITICAL)

**This is the most consequential technical decision in the project.**

The project does NOT do full ARM instruction-set simulation. Instead it uses a **Mock HAL** pattern:

1. **User writes standard STM32 HAL C code** (e.g., `HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET)`)
2. **Server compiles with host-native gcc** against mock HAL headers that replace real hardware access with JSON event emission to stdout
3. **Server runs the compiled native binary** as a subprocess via `Bun.spawn()`
4. **State manager parses stdout events** and broadcasts state deltas to the browser via WebSocket
5. **Browser renders** LED states, pin table, UART console in real time

**Why this works:**
- User code is real C that compiles and runs
- No ARM instruction decoding, no ELF parsing, no QEMU
- Mock HAL stubs are ~200 lines of C covering GPIO, UART, SPI, I2C
- The event format is the contract between compilation and visualization -- it can be extended to new peripherals without changing the architecture

**Key mock HAL components to build:**

```c
// mock_hal/stm32f4xx_hal_gpio.h - Emits JSON when GPIO functions are called
// mock_hal/stm32f4xx_hal_uart.h - Emits JSON when UART transmit/receive is called
// mock_hal/stm32f4xx_hal.h      - Provides HAL_Init(), HAL_Delay() with virtual clock
// mock_hal/stm32f4xx.h          - Type definitions (GPIO_TypeDef, etc.) without memory-mapped addresses
```

**Limitation:** Code using direct register access (`GPIOA->ODR |= (1 << 5)`) will not work. Only HAL API calls are captured. This is an acceptable tradeoff for a demo -- document it clearly.

## Project Structure

```
stm32sim/
  frontend/                  # Svelte 5 SPA (Vite build)
    src/
      lib/
        components/          # CodeMirror editor, LED grid, pin table, UART console
        stores/              # Simulation state ($state runes)
      App.svelte
      main.ts
    vite.config.ts
  server/                    # Bun + Hono API server
    src/
      routes/                # API routes (compile, simulate, samples)
      simulation/            # State manager, WebSocket broadcaster
      compiler/              # gcc invocation, temp file management
    index.ts                 # Bun.serve() entry point
  mock-hal/                  # Custom C headers implementing mock STM32 HAL
    include/
      stm32f4xx_hal.h
      stm32f4xx_hal_gpio.h
      stm32f4xx_hal_uart.h
      stm32f4xx_hal_spi.h
      stm32f4xx_hal_i2c.h
      stm32f4xx.h
    src/
      mock_hal.c             # Implementation of mock HAL functions
  samples/                   # Built-in sample C projects
  package.json
```

## Installation

```bash
# Initialize project
bun init

# Frontend (Svelte 5 + Vite)
bun add svelte
bun add -D vite @sveltejs/vite-plugin-svelte

# Code editor
bun add codemirror @codemirror/lang-cpp @codemirror/theme-one-dark @codemirror/autocomplete
bun add svelte-codemirror-editor

# UART console
bun add @xterm/xterm

# Server framework
bun add hono

# UI primitives (optional, for polished components)
bun add bits-ui

# System dependency: host C compiler (usually pre-installed on Linux)
# Ubuntu/Debian: sudo apt install gcc build-essential
# macOS: xcode-select --install (provides clang)

# Optional: ARM cross-compiler for validation
# Ubuntu/Debian: sudo apt install gcc-arm-none-eabi
# macOS: brew install arm-none-eabi-gcc
# Or download from https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads
```

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| SvelteKit | Adds SSR, adapters, file-based routing complexity. This is a simple SPA with a separate API server. Plain Svelte + Vite is sufficient. |
| Monaco Editor | 5-10MB bundle for features we will not use (IntelliSense, multi-file editing, Git integration). Massive overkill. |
| Socket.IO | Adds an abstraction layer over WebSockets with fallback transports we do not need. Bun's native WebSocket is faster and simpler. |
| Express | Legacy Node.js patterns, middleware overhead. Hono is lighter and faster on Bun. |
| QEMU / Renode | Full CPU emulation is out of scope. We simulate peripherals via mock HAL, not ARM instructions. |
| Docker (for compilation) | Adds deployment complexity for a demo. Install gcc directly. Docker is appropriate for production sandboxing but premature for a PoC. |
| Tailwind CSS | Adds build complexity (PostCSS pipeline). For a demo with limited UI, Svelte's scoped `<style>` blocks plus a small CSS reset are sufficient. If styling becomes painful, reconsider. |
| React | Larger bundle, more boilerplate, virtual DOM overhead. Svelte is better suited for reactive real-time visualization in a demo. |
| arm-none-eabi-gcc as primary compiler | ARM binaries cannot execute on x86/x64 servers. Use host gcc with mock HAL as the primary compilation path. arm-none-eabi-gcc is useful only for optional validation. |
| elfinfo / ELF parsing libraries | Not needed if compiling to native executables. Only relevant if executing ARM binaries (which we are not). |

## Sources

- [Bun official docs - WebSockets](https://bun.com/docs/runtime/http/websockets)
- [Bun official docs - Child Process / Bun.spawn](https://bun.com/docs/runtime/child-process)
- [Bun v1.3 release blog](https://bun.com/blog/bun-v1.3)
- [Bun releases (GitHub)](https://github.com/oven-sh/bun/releases)
- [Hono official docs](https://hono.dev/)
- [Hono + Bun getting started](https://hono.dev/docs/getting-started/bun)
- [Hono npm (v4.12.5)](https://www.npmjs.com/package/hono)
- [Svelte 5 - official site](https://svelte.dev/)
- [Svelte npm (v5.53.7)](https://www.npmjs.com/package/svelte)
- [Svelte 5 runes guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [CodeMirror 6 official site](https://codemirror.net/)
- [@codemirror/lang-cpp npm (v6.0.3)](https://www.npmjs.com/package/@codemirror/lang-cpp)
- [@codemirror/lang-cpp GitHub](https://github.com/codemirror/lang-cpp)
- [svelte-codemirror-editor npm (v2.1.0)](https://www.npmjs.com/package/svelte-codemirror-editor)
- [xterm.js GitHub](https://github.com/xtermjs/xterm.js/)
- [Arm GNU Toolchain Downloads](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads)
- [STM32CubeF4 GitHub](https://github.com/STMicroelectronics/STM32CubeF4)
- [CMSIS device headers for STM32 (modm-io)](https://github.com/modm-io/cmsis-header-stm32)
- [Wokwi simulator](https://wokwi.com/) - Reference architecture for web-based MCU simulation
- [avr8js (Wokwi's AVR simulator)](https://github.com/wokwi/avr8js) - Example of JS-based MCU simulation
- [CodeMirror vs Monaco comparison](https://agenthicks.com/research/codemirror-vs-monaco-editor-comparison)
- [Sourcegraph: Migrating from Monaco to CodeMirror](https://sourcegraph.com/blog/migrating-monaco-codemirror)
- [Vite vs Bun bundler discussion](https://dev.to/this-is-learning/why-use-vite-when-bun-is-also-a-bundler-vite-vs-bun-2723)
- [SvelteKit + Bun guide](https://bun.com/docs/guides/ecosystem/sveltekit)
- [SvelteKit Bun adapter caveat](https://dropanote.de/en/blog/20250831-sveltekit-bun-project-still-runs-on-nodejs/)
- [Simulating Embedded Code without Hardware (VisualGDB)](https://visualgdb.com/tutorials/arm/cmake/simulation/) - HAL intercept pattern reference
- [Embedded simulation techniques (Design News)](https://www.designnews.com/embedded-systems/5-techniques-to-simulate-embedded-software) - Simulation abstraction levels
