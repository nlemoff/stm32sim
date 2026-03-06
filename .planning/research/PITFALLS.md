# Domain Pitfalls

**Domain:** Web-based STM32 microcontroller simulator with peripheral simulation, server-side compilation, and browser visualization
**Researched:** 2026-03-05

---

## Critical Pitfalls

Mistakes that cause rewrites, project failure, or make the simulator fundamentally unusable.

### Pitfall 1: Choosing the Wrong Simulation Abstraction Level

**What goes wrong:** The project tries to simulate at the register level (emulating actual ARM Cortex-M4 instructions and memory-mapped peripheral registers) when it should simulate at the HAL/API level, or vice versa. Register-level simulation means building a CPU emulator -- exactly what PROJECT.md marks as out of scope. But HAL-level simulation means user code that writes directly to registers will not work. Picking the wrong level either explodes scope or makes the simulator useless for its target audience.

**Why it happens:** The STM32 ecosystem has two distinct layers: the CMSIS/register layer (direct memory-mapped register access) and the STM32 HAL layer (high-level API calls like `HAL_GPIO_WritePin()`). Developers instinctively want "real" simulation, which pulls toward register-level emulation. Meanwhile, the project scope says "no full CPU emulation."

**Consequences:**
- Register-level path: months of work emulating Cortex-M4 instruction set, NVIC, SysTick, bus matrix -- the project never ships
- HAL-only path: users expect to write `GPIOA->ODR |= (1 << 5)` and it does not work, making the simulator feel broken
- Switching mid-project requires rewriting the entire execution engine

**Prevention:**
- Commit early and explicitly to HAL-level simulation. Document this as a known limitation. The project intercepts HAL function calls (e.g., `HAL_GPIO_WritePin`, `HAL_UART_Transmit`) and provides stub/mock implementations that drive the UI state.
- User code is compiled against STM32 HAL headers but linked against simulator stubs instead of real peripheral drivers.
- Accept that register-level code will not work. This is the correct tradeoff for a demo/proof-of-concept.

**Detection:** Early sign is spending more than 2-3 days designing the "execution engine" without a clear answer to "how does `HAL_GPIO_WritePin` reach the browser UI?"

**Phase impact:** Must be resolved in Phase 1 (architecture). Getting this wrong invalidates all subsequent work.

---

### Pitfall 2: The Execution Model Trap -- How Does Compiled Firmware Actually Run?

**What goes wrong:** The project compiles STM32 C code with `arm-none-eabi-gcc` and produces an ARM ELF binary, then has no way to execute it. ARM binaries do not run on x86/x64 servers. The team realizes too late that "server-side compilation" and "server-side execution" are completely different problems requiring completely different solutions.

**Why it happens:** The mental model of "compile and run" from web development does not apply to cross-compiled embedded firmware. An ARM ELF binary requires either: (a) an ARM CPU emulator (QEMU/Unicorn), (b) recompilation as a native executable with HAL stubs, or (c) a WASM target. Option (a) is the "full CPU emulation" explicitly out of scope. Options (b) and (c) require a fundamentally different compilation strategy.

**Consequences:**
- Dead end: ARM binary is produced but cannot execute on the server
- Scramble to integrate QEMU, violating the "no full CPU emulation" scope constraint
- Complete rearchitecture of the compilation and execution pipeline

**Prevention:**
- Do NOT use `arm-none-eabi-gcc` to produce ARM binaries. Instead, compile user code with a host-native compiler (gcc/clang for x86/x64) that links against HAL stub libraries. The "compilation" step produces a native executable (or shared library) that the server can actually run.
- Alternative: compile to WASM using Emscripten or clang with WASM target, then execute in the browser or on the server via a WASM runtime. This avoids the cross-compilation dead end entirely.
- The STM32 HAL headers can still be used for type definitions and function signatures. The implementations are replaced with simulator stubs at link time.

**Detection:** Ask yourself before writing any code: "After `arm-none-eabi-gcc` produces a binary, what process on what CPU executes it?" If the answer involves QEMU, you have violated scope.

**Phase impact:** Must be resolved in Phase 1. This is THE architectural decision of the project.

---

### Pitfall 3: Infinite Loop and Timing Simulation

**What goes wrong:** All STM32 firmware runs in an infinite `while(1)` loop in `main()`. The simulator either: (a) blocks the server thread forever, (b) consumes 100% CPU spinning, or (c) hangs because `HAL_Delay()` waits for a SysTick interrupt that never fires. The simulation appears to "freeze" or the server becomes unresponsive.

**Why it happens:** Bare-metal firmware assumes it owns the entire CPU forever. `HAL_Delay()` internally polls a tick counter (`uwTick`) that is incremented by the SysTick interrupt handler. Without a simulated SysTick, `HAL_Delay(1000)` becomes `while(uwTick < target) {}` -- an infinite busy-wait. The firmware's `while(1)` loop never returns, so the server process that spawned it never regains control.

**Consequences:**
- Server hangs or spawns processes that never terminate
- Memory leaks from zombie simulation processes
- Users see a frozen UI with no error message
- Resource exhaustion if multiple users start simulations concurrently

**Prevention:**
- Instrument the `while(1)` loop: the simulator runtime must yield control periodically. Options include:
  - Compile with a custom `HAL_Delay()` stub that uses actual `sleep()`/`usleep()` and increments a virtual tick counter
  - Insert yield points at loop boundaries via source-code transformation or a cooperative scheduler
  - Run the simulation in a subprocess with a strict timeout (Bun supports `timeout` option in `Bun.spawn()`)
- Implement a virtual clock that advances `uwTick` without requiring an actual interrupt
- Set hard execution time limits (e.g., 30 seconds max simulation run)
- Use process isolation: never run user firmware in the same process as the web server

**Detection:** First test with `while(1) { HAL_Delay(500); HAL_GPIO_TogglePin(...); }` will expose this immediately. If this pattern does not work, nothing works.

**Phase impact:** Core simulation engine phase. Must be solved alongside the execution model (Pitfall 2).

---

### Pitfall 4: Server-Side Compilation as a Remote Code Execution Vector

**What goes wrong:** The server compiles and executes user-submitted C code. This is, by definition, a remote code execution (RCE) service. Without sandboxing, users can: read server files, access environment variables/credentials, make network requests, fork-bomb the server, or execute arbitrary system commands.

**Why it happens:** The focus on "making compilation work" overshadows security. C code has unrestricted system access when compiled and run natively. Even during compilation, crafted `#include` directives can leak file contents via error messages.

**Consequences:**
- Full server compromise via trivial exploits (`system("rm -rf /")`, `#include "/etc/passwd"`)
- Data exfiltration through network access in compiled code
- Denial of service through resource exhaustion (fork bombs, infinite allocation)
- Legal liability if the server is used to attack other systems

**Prevention:**
- Run compilation AND execution in isolated containers or sandboxes:
  - Docker containers with `--network=none`, read-only filesystem, resource limits (`--memory`, `--cpus`), and dropped capabilities
  - Or use lightweight sandboxing like `nsjail`, `bubblewrap`, or `firejail`
- Apply strict resource limits: CPU time, memory, disk space, process count
- Restrict file access: mount only the user's source files, not the host filesystem
- Disable network access in the sandbox
- Use `seccomp` profiles to limit syscalls
- Set compilation timeouts (30 seconds) and execution timeouts (30 seconds)
- Sanitize compiler flags: do not allow arbitrary `-I` or `-L` paths
- For a demo/PoC: at minimum, run as an unprivileged user in a container with no network

**Detection:** Can you `#include "/etc/shadow"` and see the contents in a compiler error? Can compiled code `open("/etc/passwd", O_RDONLY)`? If yes, you have an RCE vulnerability.

**Phase impact:** Must be addressed when building the compilation service. Not "later" -- from day one. Even for a demo, basic sandboxing is non-negotiable if the app is ever accessible beyond localhost.

---

### Pitfall 5: Scope Creep via Peripheral Expansion

**What goes wrong:** After GPIO works, someone says "let's add Timer/PWM, it's not that hard." Then ADC. Then DMA. Then interrupts. Each peripheral interacts with others (DMA triggers from Timer, Timer drives PWM on GPIO, ADC completion triggers DMA). The project becomes an endless peripheral implementation marathon and never reaches a usable state.

**Why it happens:** Embedded simulators have a uniquely seductive scope creep pattern: each individual peripheral seems small, but peripherals are deeply interconnected. The STM32F4 has 50+ peripheral types. Even Renode (a mature project with a team) has significant gaps in STM32 peripheral coverage. Research shows embedded projects are particularly vulnerable to scope creep due to hardware/software interdependence.

**Consequences:**
- Months spent on peripheral models instead of user-facing features
- Partially implemented peripherals that confuse users (SPI works for writes but not reads)
- Growing test surface with no automation
- Project abandons before core value (write-compile-see) is delivered

**Prevention:**
- Hard-lock the peripheral list: GPIO (digital I/O), UART (serial output), SPI/I2C (loopback only). This is already in PROJECT.md -- enforce it ruthlessly.
- Define "done" for each peripheral before starting: list exact HAL functions supported and explicitly list what is NOT supported.
- Build the full pipeline (edit -> compile -> execute -> visualize) for GPIO first, end-to-end, before touching UART or SPI.
- Treat peripheral additions as separate milestones that require explicit approval, not casual additions.

**Detection:** If the backlog has items like "add basic Timer support" or "wouldn't it be cool if we had PWM," scope creep is already happening.

**Phase impact:** Ongoing risk, but most dangerous in the simulation engine phase. The architecture must make it easy to add peripherals later without requiring them now.

---

## Moderate Pitfalls

### Pitfall 6: STM32 HAL Header Dependency Hell

**What goes wrong:** STM32 HAL headers (`stm32f4xx_hal.h`) pull in CMSIS core headers, device-specific headers, and dozens of peripheral headers. These headers reference ARM-specific types, intrinsics (`__IO`, `__ASM`), and memory-mapped addresses (`#define GPIOA ((GPIO_TypeDef *) GPIOA_BASE)`). Compiling against these headers with a host compiler (gcc/clang for x86) fails with hundreds of errors.

**Why it happens:** STM32 HAL headers were designed exclusively for ARM cross-compilation. They assume `arm-none-eabi-gcc` compiler intrinsics, ARM memory layout, and specific linker scripts. They were never intended to compile on a host system.

**Prevention:**
- Create a minimal set of compatibility headers that:
  - Define `__IO` as `volatile` (which it already is, but the ARM-specific macro may not resolve)
  - Provide type definitions for `GPIO_TypeDef`, `UART_HandleTypeDef`, etc. without memory-mapped base addresses
  - Stub out ARM intrinsics (`__NOP`, `__WFI`, `__DSB`, etc.) as no-ops
- Do NOT try to compile the full STM32CubeF4 HAL source. Only compile user code against a curated subset of headers.
- Alternatively: define a simplified API that mirrors HAL function signatures but is a clean-room implementation. Users write `HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET)` and it compiles against your custom headers.

**Detection:** First attempt to `#include "stm32f4xx_hal.h"` with a host compiler. Count the errors. If there are more than 20, you need a compatibility layer.

**Phase impact:** Compilation service phase. This is grunt work but must be done carefully.

---

### Pitfall 7: Browser-Server State Synchronization Flooding

**What goes wrong:** The simulation engine runs a tight loop toggling GPIO pins thousands of times per second. Each state change generates a WebSocket message. The browser is flooded with messages, the UI freezes trying to render thousands of LED state changes per frame, and the WebSocket buffer overflows.

**Why it happens:** A naive implementation sends every peripheral state change to the browser immediately. Firmware running at simulated MHz speeds generates state changes far faster than a browser can render at 60fps. Even at "slow" simulation speeds, a `while(1) { toggle_pin(); }` loop produces millions of events per second.

**Prevention:**
- Throttle state updates: batch peripheral state changes and send snapshots at a fixed rate (e.g., 30-60 Hz), not per-change
- Use a "dirty flag" pattern: mark which peripherals changed since last snapshot, only send deltas
- Implement backpressure: if the WebSocket send buffer exceeds a threshold, drop intermediate states (only latest matters for GPIO)
- For UART: buffer characters and send them in batches rather than character-by-character
- Consider server-sent events (SSE) for one-way state updates if bidirectional communication is not needed

**Detection:** Run `while(1) { HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5); }` without any delay. If the browser tab crashes or shows "page unresponsive," you have this problem.

**Phase impact:** Visualization/WebSocket phase. Design the protocol with throttling from the start -- retrofitting it is painful.

---

### Pitfall 8: Startup Code and System Initialization Assumptions

**What goes wrong:** STM32 firmware assumes a boot sequence: reset vector, startup assembly code (`startup_stm32f4xx.s`), `SystemInit()`, clock configuration (`SystemClock_Config()`), `HAL_Init()`, then `main()`. The simulator skips all of this and calls `main()` directly. Code that depends on proper clock configuration, interrupt vector table setup, or peripheral clock enables fails silently.

**Why it happens:** The startup sequence configures critical hardware: PLL for clock speed, peripheral clock gates (RCC), interrupt priorities (NVIC), and the SysTick timer. Without these, HAL functions that check clock status or peripheral readiness will fail or return errors.

**Prevention:**
- Provide a simulated `HAL_Init()` that sets up the virtual tick counter and marks peripherals as initialized
- Provide a simulated `SystemClock_Config()` that is a no-op but does not fail
- Pre-enable all peripheral clocks in the simulator (no RCC gating simulation needed for a demo)
- Initialize all simulated peripheral state to sensible defaults before calling user's `main()`
- Document that users should still call `HAL_Init()` and `SystemClock_Config()` in their code for portability, even though the simulator handles it transparently

**Detection:** Run a CubeMX-generated minimal project. If it hangs in `SystemClock_Config()` waiting for PLL lock, the startup simulation is incomplete.

**Phase impact:** Simulation engine phase. Must be addressed alongside HAL stub implementation.

---

### Pitfall 9: Compilation Toolchain Installation and Reproducibility

**What goes wrong:** The server requires `arm-none-eabi-gcc` (or an alternative compiler) installed and accessible. Toolchain versions drift between development and production. Different versions produce incompatible code or accept different language features. The ARM toolchain download servers are unreliable (documented as "slow and flaky"). The toolchain is 500MB+ and complicates container images.

**Why it happens:** Cross-compilation toolchains are large, version-sensitive, and distributed from infrastructure not designed for CI/CD-scale downloads. If the project compiles to native (per Pitfall 2 prevention), the toolchain is simpler (host gcc/clang) but still needs version pinning.

**Prevention:**
- If using host-native compilation (recommended): pin the gcc/clang version in the Docker image. Much simpler and smaller.
- If using `arm-none-eabi-gcc`: pre-bake the toolchain into the Docker image at build time, do not download at runtime. Pin to a specific version (e.g., `gcc-arm-none-eabi-13.2-Rel1`).
- Use a multi-stage Docker build: compilation toolchain in the build stage, only the runtime in the final image.
- Cache compiled outputs: if the same source code is submitted twice, return the cached result.
- Test the entire compilation pipeline in CI with the exact same container image used in production.

**Detection:** Can you build the Docker image from scratch with no network access (after initial pull)? If not, you have a reproducibility problem.

**Phase impact:** Compilation service phase. Decide the toolchain strategy before writing the compilation service.

---

### Pitfall 10: Conflating "Simulation" with "Emulation"

**What goes wrong:** Users, stakeholders, or even the developer expect the simulator to run arbitrary STM32 firmware identically to real hardware. When it does not -- because it is a simulator with HAL-level fidelity, not a cycle-accurate emulator -- it is perceived as "broken" rather than "working as designed."

**Why it happens:** The terminology is ambiguous. "Simulator" and "emulator" are used interchangeably in casual conversation, but they mean fundamentally different things. An emulator reproduces hardware behavior at a low level (QEMU). A simulator approximates behavior at a higher level of abstraction.

**Prevention:**
- Use precise language in all user-facing text: "STM32 HAL Simulator" not "STM32 Emulator"
- Clearly document supported HAL functions and known limitations on the landing page
- Provide sample projects that demonstrate what works, not just an empty editor
- Show clear error messages when unsupported functions are called (e.g., "DMA functions are not supported in this simulator") rather than silent failures
- Set expectations: "This simulator supports STM32 HAL GPIO, UART, and SPI/I2C loopback. It does not emulate the ARM CPU or unsupported peripherals."

**Detection:** Show the project to an embedded developer. If their first question is "can I run my production firmware on this?" -- expectations have not been set correctly.

**Phase impact:** UI/UX phase and documentation. But the messaging should be clear from the project's first public-facing artifact.

---

## Minor Pitfalls

### Pitfall 11: Code Editor Overkill

**What goes wrong:** Significant time is spent configuring Monaco Editor (VS Code's editor) with full C/C++ language services, IntelliSense, and advanced features. The editor becomes the most complex component despite being a commodity feature. Monaco's 5-10MB bundle bloats initial page load.

**Prevention:** Use CodeMirror 6 with basic C syntax highlighting. It is 300KB vs 5-10MB, loads faster, and is simpler to integrate. For a demo/PoC, syntax highlighting and basic editing is sufficient. Auto-complete for STM32 HAL functions would be a differentiator but is a Phase 2+ concern.

**Phase impact:** Frontend phase. Choose CodeMirror 6, keep it simple, move on.

---

### Pitfall 12: Sample Code That Does Not Actually Work

**What goes wrong:** The built-in sample projects use HAL functions or patterns that the simulator does not actually support. Users load a sample, click run, and it fails. First impression is destroyed.

**Prevention:**
- Write sample code AFTER the simulation engine is complete, not before
- Every sample must be an automated test case: CI compiles and runs each sample, verifying expected output
- Start with the absolute simplest sample: blink an LED (toggle GPIO pin with delay)
- Do not include samples that use unsupported features "for illustration"

**Phase impact:** Final integration phase. Samples are the last thing built, not the first.

---

### Pitfall 13: WebSocket Connection Lifecycle Mismanagement

**What goes wrong:** When a user navigates away or closes the tab, the simulation process keeps running on the server. When a user refreshes the page, a new simulation starts while the old one is still running. Orphaned processes accumulate.

**Prevention:**
- Track simulation processes by WebSocket connection ID
- On WebSocket close: immediately kill the associated simulation process
- On new simulation request: kill any existing simulation for that session
- Implement a maximum concurrent simulations limit
- Add a periodic reaper that kills simulation processes older than N minutes

**Phase impact:** Backend architecture phase. Design process lifecycle management from the start.

---

### Pitfall 14: Ignoring UART Output Encoding and Line Endings

**What goes wrong:** STM32 UART output often uses `\r\n` line endings, or sends binary data, or uses `printf` with format strings that behave differently on the host vs ARM. The UART console in the browser garbles output, shows extra blank lines, or corrupts non-ASCII data.

**Prevention:**
- Normalize line endings in the UART console display (`\r\n` -> `\n`, strip bare `\r`)
- Support both text and hex display modes for UART output
- Ensure `printf` formatting (especially `%d` for `int32_t` vs `int`) works correctly on the host compiler
- Test with binary data, not just ASCII strings

**Phase impact:** UART simulation phase. Small detail, easy to fix if caught, confusing if not.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Architecture / System Design | Wrong simulation abstraction level (Pitfall 1) | Commit to HAL-level simulation explicitly in architecture doc |
| Architecture / System Design | Execution model trap (Pitfall 2) | Decide: native compilation with HAL stubs, NOT ARM cross-compilation |
| Compilation Service | RCE vulnerability (Pitfall 4) | Containerize from day one with network=none, resource limits |
| Compilation Service | Toolchain reproducibility (Pitfall 9) | Pin compiler version in Docker image, pre-bake toolchain |
| Compilation Service | HAL header conflicts (Pitfall 6) | Build compatibility header layer before attempting user code compilation |
| Simulation Engine | Infinite loop / timing (Pitfall 3) | Implement virtual clock, yield points, hard timeouts |
| Simulation Engine | Startup code assumptions (Pitfall 8) | Provide simulated HAL_Init/SystemClock_Config stubs |
| Simulation Engine | Scope creep via peripherals (Pitfall 5) | Hard-lock GPIO/UART/SPI-I2C list, build end-to-end for GPIO first |
| Frontend / Visualization | State synchronization flooding (Pitfall 7) | Design throttled snapshot protocol, not per-event streaming |
| Frontend / Visualization | Editor complexity (Pitfall 11) | Use CodeMirror 6, basic C highlighting only |
| Integration / Polish | Sample code failures (Pitfall 12) | Write samples AFTER engine works, make them CI test cases |
| Integration / Polish | Expectation mismatch (Pitfall 10) | Clear "simulator not emulator" messaging in UI |
| Backend Lifecycle | Process orphaning (Pitfall 13) | Track processes by connection, kill on disconnect |

---

## Sources

- [Simulating Your Embedded Project on Your Computer (Part 1) - Nathan Jones](https://www.embeddedrelated.com/showarticle/1695.php) - Practical simulation approaches and tradeoffs (MEDIUM confidence)
- [nviennot/stm32-emulator - GitHub](https://github.com/nviennot/stm32-emulator) - STM32 emulation architecture using Unicorn/SVD files (HIGH confidence)
- [Remote code execution sandbox: secure isolation at scale - Northflank](https://northflank.com/blog/remote-code-execution-sandbox) - Sandboxing strategies for code execution services (HIGH confidence)
- [4 ways to sandbox untrusted code in 2026 - DEV Community](https://dev.to/mohameddiallo/4-ways-to-sandbox-untrusted-code-in-2026-1ffb) - Modern sandboxing approaches (MEDIUM confidence)
- [Renode STM32 Issues - GitHub](https://github.com/renode/renode/issues) - Real-world peripheral model gaps in a mature emulator (HIGH confidence)
- [From Specification to Reality: Scope Creep in Embedded Projects](https://medium.com/@lanceharvieruntime/from-specification-to-reality-how-to-avoid-scope-creep-in-embedded-projects-a58b42bf380f) - Embedded-specific scope creep patterns (MEDIUM confidence)
- [WebSocket architecture best practices - Ably](https://ably.com/topic/websocket-architecture-best-practices) - State synchronization and backpressure patterns (HIGH confidence)
- [Bun.spawn documentation](https://bun.com/docs/runtime/child-process) - Subprocess timeout and kill signal handling (HIGH confidence)
- [CodeMirror vs Monaco Editor comparison](https://agenthicks.com/research/codemirror-vs-monaco-editor-comparison) - Editor bundle size and performance tradeoffs (MEDIUM confidence)
- [STM32 HAL SysTick and HAL_Delay](https://deepbluembedded.com/stm32-systick-timer-microseconds-delay-us-delay-function/) - SysTick timer dependency in HAL_Delay (HIGH confidence)
- [Docker arm-none-eabi-gcc containers](https://blog.feabhas.com/2017/11/introduction-docker-embedded-developers-part-3-cross-compiling-cortex-m/) - Cross-compilation container setup challenges (MEDIUM confidence)
- [5 Techniques to Simulate Embedded Software - Design News](https://www.designnews.com/embedded-systems/5-techniques-to-simulate-firmware) - Simulation strategy comparison (MEDIUM confidence)
- [Simulating ARM Cortex-M with QEMU: Tips](https://s-o-c.org/simulating-arm-cortex-m-with-qemu-tips/) - QEMU Cortex-M limitations and peripheral gaps (MEDIUM confidence)
- [STM32 on Wokwi](https://wokwi.com/stm32) - Reference implementation of web-based MCU simulator (HIGH confidence)
