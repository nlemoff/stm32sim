# Feature Research

**Domain:** MCU Simulator / Virtual Test Bench (Web-based, STM32-focused)
**Researched:** 2026-03-05
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Code editor with syntax highlighting | Every web-based simulator (Wokwi, Tinkercad, TINACloud) has one. Users type code and expect it to look like code. | LOW | Monaco or CodeMirror. Must support C syntax. Wokwi uses a full editor with multi-file support. |
| Compile button with clear error output | Compilation is the first action users take after writing code. Errors must be readable and point to line numbers. | MEDIUM | arm-none-eabi-gcc output needs parsing into user-friendly messages. Raw compiler output is table stakes; parsed/linked errors are a differentiator. |
| GPIO digital I/O simulation | GPIO is the most fundamental peripheral. Every simulator from Tinkercad to Proteus supports it. Without it, nothing visible happens. | MEDIUM | Must support read/write, pin direction (input/output). Pin state changes must be visible in the UI. |
| Virtual LED visualization | LEDs are the "hello world" of embedded. Wokwi, Tinkercad, Proteus, SimulIDE all show LEDs lighting up. Users expect to see physical feedback. | LOW | Map GPIO output pins to colored circles that light up. This is the single most satisfying first-run experience. |
| UART / Serial console output | Second most fundamental peripheral after GPIO. Every simulator has a serial monitor. Users expect to see `printf` output somewhere. | MEDIUM | Bidirectional text stream. Output display is table stakes; input (typing into the console to send data to the MCU) is expected but can be v1.1. |
| Run/Stop simulation controls | Users need to start and stop execution. Every simulator has play/pause/stop. | LOW | Minimum: Run and Stop. Pause is nice-to-have for v1. |
| Sample projects / starter templates | Wokwi has thousands of community projects. Tinkercad has starter circuits. Users need something to run immediately without writing code first. | LOW | Ship 3-5 examples: blink LED, UART hello world, GPIO read/write, SPI loopback. Critical for first-run experience -- users who see something work in 10 seconds stay. |
| Pin state table / peripheral status view | Users need to see what every pin is doing at a glance. Proteus shows this. Wokwi shows it through the component wiring. | MEDIUM | Table showing pin name, direction (in/out), current value (high/low/analog). Updates in real-time during simulation. |
| File upload (.c/.h) | Users with existing code need to load it. Not everyone starts from scratch. Wokwi supports multi-file projects. | LOW | Standard file picker + drag-and-drop. Must handle at least .c and .h files. |
| Responsive feedback on simulation state | User must know: is it compiling? Running? Stopped? Errored? Dead silence after clicking "Run" kills trust. | LOW | Status indicator (compiling... running... stopped... error). Progress feedback during compilation. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but create value vs competitors.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero-install web experience for STM32 C code | Wokwi supports STM32 but primarily targets Arduino/ESP32 idioms. No existing tool lets you write raw STM32 C code (HAL or bare-metal register access) and instantly see results in a browser. Proteus is desktop-only and expensive. | HIGH | This is the project's core value proposition. The combination of "STM32 + C + web + instant feedback" does not exist in a clean, focused form today. |
| Compilation error UX (inline errors, suggestions) | Most simulators dump raw compiler output. Parsing gcc errors into clickable, inline annotations in the editor would be a significant UX improvement over competitors. | MEDIUM | Parse arm-none-eabi-gcc stderr, extract file/line/message, highlight in editor. Even Wokwi doesn't do this particularly well for STM32 C. |
| SPI/I2C loopback visualization | Showing data sent/received on SPI and I2C buses in a readable format. Proteus has protocol analyzers but they're complex. A simple "here's what was transmitted" view is more accessible. | MEDIUM | Display frames/packets in a table or timeline. Don't need a full protocol analyzer -- just show the data flowing. |
| Peripheral register inspector | Showing the actual register values (e.g., GPIOx_ODR, USART_DR) that the firmware is reading/writing. Proteus and Renode support this but are heavyweight tools. | HIGH | Requires mapping memory addresses to named registers. Very useful for learning but significant implementation effort. |
| Real-time waveform / timing view | Simple oscilloscope-like view of GPIO pin state changes over time. Proteus has full DSO; Wokwi has a logic analyzer that exports VCD files. An inline, real-time view would be more accessible. | HIGH | Record pin state transitions with timestamps, render as a simple waveform. Not a full logic analyzer -- just enough to see timing. |
| Shareable simulation links | Wokwi excels here -- every project is a URL. Being able to share a simulation state (code + configuration) via link is powerful for education and collaboration. | MEDIUM | Encode project state in URL or generate a shareable ID. Great for teachers sending assignments, students sharing work. |
| Interactive input simulation | Virtual buttons, switches, potentiometers that users can click/drag during simulation to inject GPIO input changes. Tinkercad and Wokwi both support this. | MEDIUM | Start with a simple toggle button for GPIO input pins. Expand to sliders/pots later. |
| Execution speed control | Slow down simulation to observe fast state changes. Speed up to skip boring waiting loops. Proteus and Renode support this. | MEDIUM | Playback speed slider: 0.1x to 10x. Useful for debugging timing-sensitive code. |
| Dark mode / theme support | Expected in modern web dev tools. Not a differentiator per se but its absence is noticed. | LOW | Monaco/CodeMirror both support themes natively. Apply consistent theming to the whole UI. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this project scope.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full ARM Cortex-M CPU emulation (QEMU-style) | "Real" simulation with cycle-accurate timing | Massively complex. QEMU STM32 support is incomplete and buggy. Renode is better but still a multi-year effort to build. This alone could consume the entire project budget. | Simulate at the peripheral/register level, not the CPU instruction level. Compile to native or WASM and intercept HAL/register calls. |
| Schematic / circuit editor | Proteus and SimulIDE have full schematic capture. Users may ask "where do I wire things?" | Schematic editors are entire products by themselves (see: KiCad, EasyEDA). Building one is a massive scope trap. | Pre-configured board layout with fixed peripheral mapping. Show a pin diagram, not a schematic. |
| Multi-MCU support (Arduino, ESP32, PIC, AVR) | "Can I also simulate my Arduino?" | Each MCU family has different peripherals, memory maps, toolchains, and HAL libraries. Supporting one well is hard; supporting many is a product line. | Focus on STM32F4xx only. Do one chip family well. Mention "STM32F4" prominently so expectations are set. |
| Debugging with breakpoints and stepping | Professional developers expect GDB-style debugging. Proteus and Renode offer this. | Requires a debug server, source mapping, and deep integration between the execution engine and the UI. This is a separate product feature that doubles complexity. | Provide good logging (UART console), pin state history, and peripheral state inspection instead. These cover 80% of debugging needs for the demo scope. |
| Timer/PWM simulation | Timers are fundamental STM32 peripherals. Users will ask for them. | Timer simulation requires modeling prescalers, auto-reload, capture/compare, interrupt generation, and PWM output with duty cycle visualization. It's a rabbit hole. | Defer to v2. Document as "planned" so users know it's coming, not forgotten. |
| DMA, ADC, DAC, advanced peripherals | "Real projects use these" | Each advanced peripheral is its own mini-project. ADC alone needs channel multiplexing, conversion timing, interrupt/DMA triggers. | Out of scope for demo. The value prop is "see your GPIO/UART/SPI code work instantly," not "replace your dev board." |
| Real-time collaboration / multi-user | Google Docs for hardware. Sounds cool. | Requires operational transformation or CRDT for the code editor, shared simulation state, conflict resolution. This is a distributed systems problem, not an embedded systems problem. | Single-user with shareable links. If someone wants to show their work, they share a URL, not a live session. |
| Mobile / responsive layout | "I want to code on my phone" | Code editing on mobile is terrible UX. Embedded C development on a phone is not a real use case. | Desktop/laptop only. Don't waste time on responsive breakpoints for the code editor. |
| Custom component / chip creation | Wokwi has a Chips API for creating custom parts | Requires designing a component model, API surface, documentation, and testing framework. Huge scope for marginal demo value. | Ship fixed components (LEDs, buttons). Users don't need custom chips for a proof-of-concept. |

## Feature Dependencies

```
[Code Editor]
    |
    v
[Server-side Compilation] ----requires----> [arm-none-eabi-gcc toolchain]
    |
    v
[Simulation Execution Engine]
    |
    +----requires----> [GPIO Peripheral Model]
    |                      |
    |                      +---enables---> [Virtual LED Visualization]
    |                      +---enables---> [Pin State Table]
    |                      +---enables---> [Interactive Input (buttons)]
    |
    +----requires----> [UART Peripheral Model]
    |                      |
    |                      +---enables---> [Serial Console Output]
    |
    +----requires----> [SPI/I2C Peripheral Model]
                           |
                           +---enables---> [SPI/I2C Loopback Visualization]

[File Upload] ----feeds----> [Code Editor]
[Sample Projects] ----feeds----> [Code Editor]

[Compilation Error UX] ----enhances----> [Server-side Compilation]
[Execution Speed Control] ----enhances----> [Simulation Execution Engine]
[Peripheral Register Inspector] ----enhances----> [Simulation Execution Engine]
[Real-time Waveform View] ----requires----> [GPIO Peripheral Model]
[Shareable Links] ----requires----> [Code Editor] + [Sample Projects]
```

### Dependency Notes

- **Simulation Engine requires Peripheral Models:** The engine is useless without at least GPIO. GPIO is the minimum viable peripheral.
- **Virtual LEDs require GPIO:** LEDs are a visualization layer on top of GPIO output. GPIO must work first.
- **Serial Console requires UART model:** Console is a UI component; UART model is the simulation backend.
- **Compilation must precede simulation:** The engine needs compiled firmware to execute. The compile step is the critical path.
- **SPI/I2C Loopback requires SPI/I2C model:** This is a later-phase feature that builds on the peripheral framework established by GPIO and UART.
- **Sample Projects feed the editor:** They don't require special infrastructure -- just pre-loaded code strings. But they must be tested against the compiler and simulation engine.
- **Shareable Links require a persistence layer:** Even if it's just URL-encoded state or a simple key-value store for project snapshots.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate "write STM32 C, see it run in a browser."

- [x] Code editor with C syntax highlighting -- the input surface
- [x] File upload (.c/.h) -- for users with existing code
- [x] 3-5 sample projects -- for users without existing code (blink LED, UART hello, GPIO read)
- [x] Server-side compilation with error display -- the pipeline
- [x] GPIO peripheral simulation (digital I/O) -- the minimum peripheral
- [x] Virtual LED visualization -- the "aha moment"
- [x] Pin state table -- see all GPIO states at a glance
- [x] UART peripheral simulation with serial console -- the second peripheral
- [x] Run/Stop controls with status feedback -- basic simulation control
- [x] Simulation execution engine -- the runtime

### Add After Validation (v1.x)

Features to add once core loop (write -> compile -> simulate -> see) works.

- [ ] SPI/I2C loopback simulation -- third peripheral tier, validates the peripheral model is extensible
- [ ] Compilation error UX (inline editor annotations) -- polish the developer experience
- [ ] Interactive input simulation (virtual buttons/switches) -- enables input-driven demos
- [ ] Execution speed control -- helps users observe fast-changing state
- [ ] Dark mode / theming -- polish
- [ ] Shareable simulation links -- enables sharing and education use cases

### Future Consideration (v2+)

Features to defer until the proof-of-concept is validated.

- [ ] Peripheral register inspector -- powerful for learning but high implementation cost
- [ ] Real-time waveform / timing view -- oscilloscope-lite, significant UI work
- [ ] Timer/PWM simulation -- next major peripheral class
- [ ] Bidirectional UART input (user types into console, MCU receives) -- requires interrupt simulation
- [ ] Multiple board configurations -- beyond STM32F4xx

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Code editor (syntax highlighting, C) | HIGH | LOW | P1 |
| Server-side compilation + error display | HIGH | MEDIUM | P1 |
| GPIO peripheral simulation | HIGH | MEDIUM | P1 |
| Virtual LED visualization | HIGH | LOW | P1 |
| UART simulation + serial console | HIGH | MEDIUM | P1 |
| Pin state table | HIGH | LOW | P1 |
| Sample projects (3-5) | HIGH | LOW | P1 |
| File upload (.c/.h) | MEDIUM | LOW | P1 |
| Run/Stop controls + status feedback | HIGH | LOW | P1 |
| Simulation execution engine | HIGH | HIGH | P1 |
| SPI/I2C loopback simulation | MEDIUM | MEDIUM | P2 |
| Compilation error UX (inline) | MEDIUM | MEDIUM | P2 |
| Interactive input (buttons/switches) | MEDIUM | MEDIUM | P2 |
| Execution speed control | LOW | MEDIUM | P2 |
| Shareable links | MEDIUM | MEDIUM | P2 |
| Dark mode / theming | LOW | LOW | P2 |
| Peripheral register inspector | MEDIUM | HIGH | P3 |
| Real-time waveform view | LOW | HIGH | P3 |
| Timer/PWM simulation | MEDIUM | HIGH | P3 |
| Debugging (breakpoints/stepping) | HIGH | HIGH | P3 (anti-feature for demo scope) |

**Priority key:**
- P1: Must have for launch -- the write/compile/simulate/visualize loop
- P2: Should have, add after core works -- polish and expansion
- P3: Nice to have, future consideration -- significant effort, defer until validated

## Competitor Feature Analysis

| Feature | Wokwi | Proteus VSM | Tinkercad | SimulIDE | Our Approach |
|---------|-------|-------------|-----------|----------|--------------|
| Web-based | Yes | No (desktop) | Yes | No (desktop) | Yes -- web-first, zero install |
| STM32 support | Limited (2 Nucleo boards) | Yes (extensive) | No | No | Yes -- STM32F4xx focused |
| Code editor | Built-in, multi-file | External IDE | Built-in, simple | Built-in with debugger | Built-in, Monaco-based |
| Compilation | In-browser (Arduino/PlatformIO) | External toolchain | In-browser (Arduino) | Built-in for supported MCUs | Server-side (arm-none-eabi-gcc) |
| GPIO visualization | Via wired components | Full schematic + indicators | Via wired components | Via circuit view | Pin state table + virtual LEDs |
| UART / Serial | Serial monitor | Full UART modeling | Serial monitor | Serial monitor | Serial console panel |
| SPI/I2C | Via wired devices | Protocol analyzers | Limited | Limited | Loopback with data display |
| Debugging | GDB via VS Code extension | Full source-level debug | None | Register/RAM viewer | Not in v1 (UART logging instead) |
| Schematic editor | Wiring diagram | Full schematic capture | Wiring diagram | Full schematic | None -- fixed board layout |
| Component library | Extensive (sensors, displays, motors) | Massive (10k+ components) | Moderate | Moderate | Minimal (LEDs, buttons) |
| Sample projects | Thousands (community) | Template projects | Starter circuits | Example circuits | 3-5 curated demos |
| Pricing | Free (personal) / Paid (commercial) | Paid ($$$) | Free | Free (open source) | Free (demo/POC) |
| Logic analyzer | VCD file export | Built-in DSO + analyzers | None | Oscilloscope, plotter | Not in v1 |
| Shareable links | Yes (every project is a URL) | No | Yes (Autodesk account) | No | Planned for v1.x |
| IoT / WiFi | Yes (MQTT, HTTP, NTP) | No | No | No | Out of scope |
| Raw C / bare-metal STM32 | Partial (primarily Arduino/HAL) | Yes | No (Arduino only) | No (Arduino/PIC) | Yes -- this is the differentiator |

## Key Insights from Competitor Analysis

1. **The gap we fill:** No web-based tool focuses on raw STM32 C development with instant visual feedback. Wokwi is closest but optimizes for Arduino/ESP32 workflows. Proteus handles STM32 well but is desktop-only and expensive.

2. **Don't compete on breadth:** Wokwi has thousands of components and community projects. Proteus has 10k+ components and full SPICE. We compete on *focus*: STM32F4 + C + instant browser feedback.

3. **Serial monitor is non-negotiable:** Every single competitor has one. It's the universal debugging tool for embedded.

4. **Sample projects drive adoption:** Wokwi's community projects are its moat. We need a few excellent curated examples, not thousands.

5. **Schematic editors are scope traps:** Both Tinkercad and Proteus have them, but they're entire products. A fixed board layout with a pin diagram is sufficient for our demo scope.

## Sources

- [Wokwi Documentation](https://docs.wokwi.com/) - Feature reference, component library, serial monitor, logic analyzer
- [Wokwi STM32 Page](https://wokwi.com/stm32) - STM32 support details, supported boards
- [Proteus VSM - Labcenter](https://www.labcenter.com/whyvsm/) - VSM features, MCU co-simulation, debugging
- [Proteus Circuit Simulation](https://www.labcenter.com/simulation/) - SPICE simulation, peripheral monitoring
- [SimulIDE](https://simulide.com/p/) - Feature overview, MCU support
- [Tinkercad Circuits comparison](https://www.hackster.io/Hack-star-Arduino/tinkercad-versus-wokwi-arduino-simulator-2022-5ab08d) - Feature comparison
- [Renode Framework](https://renode.io/) - STM32 emulation, peripheral models, GDB debugging
- [QEMU STM32](https://github.com/beckus/qemu_stm32) - QEMU-based STM32 emulation approach
- [Top MCU Simulators 2025](https://embeddelectronics.blog/2025/10/27/top-3-free-online-microcontroller-simulators-for-arduino-esp32-2025/) - Market overview
- [Arduino Simulators Comparison 2026](https://www.etechnophiles.com/best-arduino-simulators/) - Simulator comparison
- [STMViewer - Memfault](https://interrupt.memfault.com/blog/stm-viewer-debug) - Real-time variable visualization patterns
- [Embedded Simulation Best Practices](https://www.embeddedrelated.com/showarticle/1695.php) - Simulation architecture patterns

---
*Feature research for: MCU Simulator / Virtual Test Bench*
*Researched: 2026-03-05*
