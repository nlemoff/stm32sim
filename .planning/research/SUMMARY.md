# Project Research Summary

**Project:** STM32 Virtual Test Bench
**Domain:** Web-based MCU simulator with peripheral simulation
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

The STM32 Virtual Test Bench is a browser-based tool that lets users write standard STM32 HAL C code, compile it on the server, and see peripheral behavior (LEDs, UART output, pin states) visualized in real time. The expert-recommended approach for this class of product is a **Mock HAL pattern**: user code compiles against fake HAL headers using the server's native gcc (not the ARM cross-compiler), producing a Linux executable that emits JSON events to stdout whenever a HAL function is called. A TypeScript state manager parses these events and broadcasts state deltas to the browser over WebSocket. This avoids the entire category of problems associated with ARM instruction-level emulation (which PROJECT.md explicitly scopes out) while still letting users write real, portable STM32 C code.

The recommended stack is Bun + Hono for the backend, Svelte 5 + Vite for the frontend, CodeMirror 6 for the code editor, and xterm.js for the UART console. Every technology choice is well-documented, production-ready, and sized appropriately for a demo/PoC. The architecture is a clean three-tier system: browser SPA, Bun API server with WebSocket, and sandboxed subprocess execution. The critical path runs through the Mock HAL layer and the compilation service -- these must be built and validated first because every other component depends on the event format they produce.

The top risks are: (1) accidentally sliding into register-level or ARM-binary emulation, which would blow up scope; (2) the infinite-loop/timing problem inherent in bare-metal firmware execution; (3) remote code execution vulnerabilities from compiling and running user-submitted C; and (4) scope creep through peripheral expansion. All four have clear mitigations identified in research. The project should hard-commit to HAL-level simulation, implement virtual time from day one, sandbox compilation/execution with process isolation and timeouts, and lock the peripheral list to GPIO, UART, and SPI/I2C loopback.

## Key Findings

### Recommended Stack

The stack centers on Bun as the server runtime (native WebSocket, fast subprocess spawning, built-in TypeScript), Hono as the HTTP framework (lightweight, runtime-agnostic), and Svelte 5 as the frontend framework (compile-time reactivity maps perfectly to real-time simulation state). Vite is required for the frontend build because Bun's bundler lacks Svelte plugin support and chunk splitting. The most consequential stack decision is using **host-native gcc** (not arm-none-eabi-gcc) as the primary compiler, compiling user code against custom Mock HAL headers that emit JSON events instead of accessing hardware.

**Core technologies:**
- **Bun + Hono**: Backend runtime and API -- native WebSocket pub/sub, fast subprocess spawning via Bun.spawn(), zero-dependency HTTP routing
- **Svelte 5 + Vite**: Frontend SPA -- $state/$derived runes for reactive pin/LED/UART state, Vite for build tooling with official Svelte plugin
- **CodeMirror 6 + @codemirror/lang-cpp**: Code editor -- 300KB modular editor vs Monaco's 5-10MB, C syntax via Lezer parser
- **@xterm/xterm**: UART console -- industry-standard web terminal with ANSI rendering and scrollback
- **Host gcc + Custom Mock HAL**: Compilation and execution -- native binaries that emit JSON events, no ARM cross-compilation needed for execution
- **arm-none-eabi-gcc (optional)**: Validation-only cross-compilation to catch ARM-specific syntax errors; output is NOT executed

### Expected Features

**Must have (table stakes):**
- Code editor with C syntax highlighting (the input surface)
- Server-side compilation with clear error output (the pipeline)
- GPIO digital I/O simulation with virtual LED visualization (the "aha moment")
- UART serial console output (the universal embedded debugging tool)
- Pin state table showing all GPIO states at a glance
- Run/Stop simulation controls with status feedback
- 3-5 sample projects (blink LED, UART hello world, GPIO read)
- File upload for .c/.h files

**Should have (differentiators, post-core):**
- SPI/I2C loopback simulation and visualization
- Inline compilation error annotations in the editor
- Interactive input simulation (virtual buttons/switches)
- Execution speed control
- Shareable simulation links

**Defer (v2+):**
- Peripheral register inspector, real-time waveform view, Timer/PWM simulation
- Bidirectional UART input, breakpoint debugging, multiple board configs
- Schematic editor, multi-MCU support, DMA/ADC/DAC -- these are anti-features for demo scope

### Architecture Approach

Three-tier architecture: Svelte 5 SPA in the browser, Bun + Hono API server, and sandboxed subprocess execution. HTTP REST handles compilation requests (POST /api/compile). WebSocket handles real-time simulation state streaming. The Mock HAL layer is the critical architectural innovation -- it bridges user STM32 code and the simulation engine by replacing HAL function implementations with JSON event emitters compiled into the user binary via host gcc.

**Major components:**
1. **Mock HAL Layer (C)** -- Implements STM32 HAL function signatures; emits JSON events to stdout on every peripheral call; compiled alongside user code with host gcc
2. **Compilation Service** -- Receives user .c source, prepends mock HAL includes, invokes host gcc, returns native executable or parsed errors
3. **Execution Runner** -- Spawns compiled binary as sandboxed subprocess via Bun.spawn() with timeout/resource limits; captures stdout for event parsing
4. **State Manager (TypeScript)** -- Parses JSON events from subprocess stdout; maintains in-memory peripheral state (GPIO pins, UART buffers, SPI/I2C data); computes deltas
5. **WebSocket Bridge** -- Broadcasts state deltas at throttled rate (30-60 Hz) to connected browser clients; handles connection lifecycle and process cleanup
6. **Frontend Visualizers** -- LED grid, pin state table, UART console (xterm.js), simulation controls; all driven by WebSocket state updates via Svelte 5 runes

### Critical Pitfalls

1. **Wrong simulation abstraction level** -- Commit to HAL-level simulation immediately. Do NOT attempt register-level emulation. Document that `GPIOA->ODR |= (1<<5)` style code is unsupported. This decision must be locked in Phase 1.
2. **Execution model trap (ARM binaries cannot run on x86)** -- Compile with host-native gcc against mock HAL stubs, NOT with arm-none-eabi-gcc. The ARM cross-compiler is optional validation only. Ask the question: "what CPU executes the output binary?"
3. **Infinite loop / timing deadlock** -- All firmware runs `while(1)`. Mock HAL_Delay() must use real usleep() + virtual tick advancement, not busy-wait on a SysTick that never fires. Hard timeout (30s) on all simulation subprocesses.
4. **Remote code execution from user-submitted C** -- Compilation and execution are RCE by definition. Sandbox with process isolation, no network access, filesystem restrictions, resource limits, and timeouts from day one. Even for demo, basic sandboxing is non-negotiable.
5. **Scope creep via peripheral expansion** -- Hard-lock to GPIO, UART, SPI/I2C loopback. Build the full edit-compile-execute-visualize pipeline for GPIO alone before touching any other peripheral. Treat additions as separate milestones.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Mock HAL Layer and Compilation Pipeline

**Rationale:** The Mock HAL is the foundation of the entire project. Every other component depends on the event format it produces. Building and validating this first answers the most critical architectural question ("can real STM32 HAL code compile and run against our stubs?") before any frontend work begins. This is where Pitfalls 1, 2, and 6 live -- getting this wrong invalidates everything.
**Delivers:** Custom Mock HAL C headers (stm32f4xx_hal.h, GPIO, UART stubs); compilation service that takes .c source and produces a native executable; basic event emission verified on stdout. A "blink LED" sample compiles and produces JSON events when run from the command line.
**Addresses:** Server-side compilation (P1 feature), Mock HAL architecture decision
**Avoids:** Wrong abstraction level (Pitfall 1), execution model trap (Pitfall 2), HAL header dependency hell (Pitfall 6)

### Phase 2: Simulation Engine and State Management

**Rationale:** With the Mock HAL producing events, the next layer is the TypeScript state manager that consumes them and the execution runner that manages subprocess lifecycle. This phase solves the infinite loop / timing problem and establishes the WebSocket broadcasting protocol. Must be built before the frontend because it defines the data contract the UI consumes.
**Delivers:** Execution runner with Bun.spawn(), virtual clock with HAL_Delay() support, state manager tracking GPIO/UART state, WebSocket server broadcasting state deltas at throttled rate, process lifecycle management (kill on disconnect, timeout).
**Addresses:** Simulation execution engine (P1 feature), Run/Stop controls backend
**Avoids:** Infinite loop deadlock (Pitfall 3), state flooding (Pitfall 7), process orphaning (Pitfall 13), startup code assumptions (Pitfall 8)

### Phase 3: Frontend -- Editor, Controls, and GPIO Visualization

**Rationale:** The backend API is now stable. This phase builds the complete user-facing loop for the simplest peripheral (GPIO): write code, compile, run, see LEDs blink and pin states change. Completing the full pipeline end-to-end for one peripheral validates the entire architecture before expanding to UART or SPI.
**Delivers:** Svelte 5 SPA with CodeMirror 6 editor (C syntax highlighting), compile button with error display, Run/Stop controls, WebSocket connection to backend, virtual LED visualization, pin state table, sample project loading.
**Addresses:** Code editor (P1), GPIO simulation visualization (P1), virtual LEDs (P1), pin state table (P1), Run/Stop controls (P1), status feedback (P1)
**Avoids:** Editor overkill (Pitfall 11 -- use CodeMirror, not Monaco), scope creep (build GPIO end-to-end first)

### Phase 4: UART Peripheral and Serial Console

**Rationale:** UART is the second most fundamental peripheral and every competitor has a serial monitor. The Mock HAL already has UART stub scaffolding from Phase 1. This phase extends the simulation engine with UART buffering and adds xterm.js as the console UI. It validates that the peripheral model is extensible beyond GPIO.
**Delivers:** Mock HAL UART implementation (HAL_UART_Transmit emitting JSON events), state manager UART buffering, xterm.js console panel in the frontend, UART hello world sample project.
**Addresses:** UART simulation + serial console (P1), file upload (P1), sample projects for UART
**Avoids:** UART encoding issues (Pitfall 14 -- normalize line endings, handle binary data)

### Phase 5: SPI/I2C Loopback and Polish

**Rationale:** SPI/I2C loopback is the final peripheral tier, confirming the architecture handles bus protocols. This phase also covers compilation error UX polish (inline annotations), additional sample projects, and overall integration testing. It is the first phase that can be cut or reduced if time is short.
**Delivers:** SPI/I2C mock HAL stubs with loopback visualization, inline compiler error annotations in editor, polished sample project suite (3-5 tested examples), basic sandboxing hardening for compilation/execution.
**Addresses:** SPI/I2C loopback (P2), compilation error UX (P2), sample projects validation
**Avoids:** Sample code that does not work (Pitfall 12 -- write samples after engine is complete), expectation mismatch (Pitfall 10 -- clear "simulator not emulator" messaging)

### Phase 6: Interactive Features and Hardening

**Rationale:** Post-core features that improve the user experience but are not required for the demo to function. Interactive inputs (virtual buttons), execution speed control, shareable links, and security hardening for any deployment beyond localhost.
**Delivers:** Virtual button/switch inputs for GPIO, execution speed slider, shareable simulation links (URL-encoded state), production sandboxing (nsjail/container), dark mode.
**Addresses:** Interactive input (P2), execution speed control (P2), shareable links (P2), dark mode (P2)
**Avoids:** RCE vulnerabilities in production (Pitfall 4 -- full sandboxing for deployment)

### Phase Ordering Rationale

- **Backend-first order** is dictated by the dependency chain: Mock HAL defines the event format, state manager defines the data contract, frontend consumes both. Changing the event format after building visualizers causes rework. Research and architecture both confirm this order.
- **GPIO-first, then UART, then SPI/I2C** follows the complexity gradient and feature dependency graph from FEATURES.md. GPIO is the minimum viable peripheral; UART is the minimum viable debugging tool; SPI/I2C validates extensibility.
- **Samples come last** (Pitfall 12) because they must be tested against the actual simulation engine. Writing them early risks shipping broken examples that destroy first impressions.
- **Security sandboxing is split**: basic process isolation with timeouts from Phase 2 (non-negotiable), full container sandboxing deferred to Phase 6 (appropriate for production deployment, overkill for localhost demo).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Mock HAL):** Needs research into exact STM32 HAL function signatures to mock, CMSIS type definitions to replicate, and host-compiler compatibility shims for ARM-specific macros (__IO, __ASM, etc.). Reference UM1725 (STM32F4 HAL docs) and STM32CubeF4 headers.
- **Phase 2 (Simulation Engine):** Needs research into Bun.spawn() subprocess management patterns, stdout streaming/parsing performance, and WebSocket backpressure handling in Bun. The virtual clock design (HAL_Delay with usleep vs cooperative yielding) needs prototyping.
- **Phase 5 (SPI/I2C):** Needs research into what "loopback visualization" means concretely -- what data to display, what format, how to render bus transactions meaningfully.

Phases with standard patterns (skip additional research):
- **Phase 3 (Frontend - Editor/GPIO Viz):** CodeMirror 6 + Svelte 5 integration is well-documented. LED visualization is straightforward SVG/CSS. WebSocket consumption in Svelte is standard.
- **Phase 4 (UART Console):** xterm.js integration is well-documented with many examples. UART mock is a straightforward extension of the GPIO mock pattern.
- **Phase 6 (Interactive Features):** Virtual buttons, shareable links, and dark mode are standard web development patterns with no domain-specific complexity.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs and npm registries. Version numbers confirmed. Bun WebSocket, Hono, Svelte 5, CodeMirror 6 are all mature and well-documented. |
| Features | HIGH | Competitor analysis covers 5 products (Wokwi, Proteus, Tinkercad, SimulIDE, Renode). Feature prioritization is grounded in what competitors ship and what the project scope allows. |
| Architecture | HIGH | Mock HAL pattern is documented in multiple sources (embeddedrelated.com, VisualGDB, Design News). Compilation sandboxing patterns from Compiler Explorer (nsjail) are production-proven. Native compilation avoids the ARM-binary dead end. |
| Pitfalls | HIGH | Pitfalls are sourced from real projects (nviennot/stm32-emulator, Renode issues, Compiler Explorer architecture) and verified against the project's specific constraints. Phase-specific warnings are actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **Mock HAL completeness**: Research identifies the pattern but the exact list of HAL functions to stub needs enumeration during Phase 1 planning. The STM32F4 HAL has hundreds of functions; the mock needs only ~20-30 for GPIO, UART, SPI, I2C, and system init. Enumerate during phase planning.
- **Virtual clock fidelity**: The mock HAL_Delay() using usleep() introduces real wall-clock delays. An alternative (cooperative yielding with virtual-only time) runs faster but loses real-time animation feel. The right balance needs prototyping in Phase 2.
- **Sandboxing depth for demo vs production**: Research recommends nsjail/Docker for production but says "basic subprocess isolation is sufficient for demo." The exact boundary (what is "basic"?) needs a decision during Phase 2 planning: at minimum, unprivileged user + timeout + memory limit + no network.
- **Multi-file project support**: FEATURES.md mentions file upload for .c/.h but the architecture assumes single-file compilation. Multi-file projects (user provides main.c + custom header) need a compilation strategy decision in Phase 1.
- **Svelte-codemirror-editor Svelte 5 compatibility**: Marked MEDIUM confidence in STACK.md. The wrapper (v2.1.0) claims Svelte 5 support but may have edge cases. Fallback is direct CodeMirror 6 integration without the wrapper.

## Sources

### Primary (HIGH confidence)
- [STM32F4 HAL Documentation UM1725](https://www.st.com/resource/en/user_manual/um1725-description-of-stm32f4-hal-and-lowlayer-drivers-stmicroelectronics.pdf) -- HAL function signatures to mock
- [Bun official docs - WebSockets](https://bun.com/docs/runtime/http/websockets) -- Native WebSocket API
- [Bun official docs - Bun.spawn](https://bun.com/docs/runtime/child-process) -- Subprocess management
- [Hono official docs](https://hono.dev/) -- HTTP framework API
- [Svelte 5 official site](https://svelte.dev/) -- Runes reactivity system
- [CodeMirror 6 official site](https://codemirror.net/) -- Editor API and extensions
- [nviennot/stm32-emulator](https://github.com/nviennot/stm32-emulator) -- Register-level approach complexity (validates why NOT to go this route)
- [How Compiler Explorer Works](https://xania.org/202506/how-compiler-explorer-works) -- Server-side compilation and nsjail sandboxing
- [Renode STM32 Issues](https://github.com/renode/renode/issues) -- Peripheral model gaps in mature emulator
- [RCE Sandbox best practices - Northflank](https://northflank.com/blog/remote-code-execution-sandbox) -- Sandboxing strategies

### Secondary (MEDIUM confidence)
- [Simulating Embedded Projects on Your Computer](https://www.embeddedrelated.com/showarticle/1695.php) -- HAL intercept pattern
- [avr8js (Wokwi)](https://github.com/wokwi/avr8js) -- JavaScript MCU simulator architecture reference
- [Wokwi STM32](https://wokwi.com/stm32) -- Web-based MCU simulator reference
- [WebSocket architecture best practices - Ably](https://ably.com/topic/websocket-architecture-best-practices) -- State sync patterns
- [Bun WebSocket benchmark](https://lemire.me/blog/2023/11/25/a-simple-websocket-benchmark-in-javascript-node-js-versus-bun/) -- 7x throughput vs Node.js
- [5 Techniques to Simulate Embedded Software](https://www.designnews.com/embedded-systems/5-techniques-to-simulate-firmware) -- Simulation abstraction levels

### Tertiary (LOW confidence)
- [elflib](https://github.com/jhmaster2000/elflib) -- JavaScript ELF parser (only relevant if ARM emulation path is ever pursued, which it should not be)

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
