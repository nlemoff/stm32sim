# STM32 Virtual Test Bench

## What This Is

A web-based simulator for STM32F4 firmware that lets developers write, compile, and test microcontroller code without physical hardware. It simulates core peripherals (GPIO, UART, SPI/I2C) and provides visual feedback through a browser UI with virtual LEDs, a UART console, and a pin state table.

## Core Value

Developers can write STM32 C code in a browser editor, hit run, and immediately see their firmware's behavior visualized — no dev board required.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Web-based code editor for writing STM32 C code
- [ ] Upload .c/.h files from local machine
- [ ] Built-in sample projects as proof-of-concept demos
- [ ] Server-side compilation of STM32 C code
- [ ] GPIO peripheral simulation (digital I/O — set pins high/low, read inputs)
- [ ] UART peripheral simulation (serial output)
- [ ] SPI/I2C peripheral simulation (loopback — show data sent/received)
- [ ] Virtual LED visualization (light up when GPIO pins go high)
- [ ] UART console output in the UI
- [ ] Pin state table showing all GPIO pins with current state
- [ ] Simulation execution engine that runs compiled firmware logic

### Out of Scope

- Full ARM Cortex-M CPU emulation (QEMU-style) — too complex for a demo
- Timer/PWM simulation — not selected for v1
- Virtual sensors or simulated I2C/SPI devices — loopback is sufficient
- Mobile app — web only
- Multi-user / collaboration features — single-user demo
- Debugging (breakpoints, stepping) — beyond demo scope
- DMA, ADC, DAC, or advanced peripherals — minimal demo

## Context

- Target chip: STM32F4xx (Cortex-M4)
- This is a demo/proof-of-concept, not a production tool
- Code editor in browser for quick experiments + file upload for existing projects
- Sample code ships with the app to demonstrate capabilities out of the box
- SPI/I2C simulation is loopback only (no virtual devices on the bus)

## Constraints

- **Runtime**: Bun — user preference for backend/tooling
- **Frontend**: No strong preference — research will inform the choice
- **Compilation**: Server-side (exact toolchain TBD — likely arm-none-eabi-gcc or similar approach)
- **Scope**: Minimal demo — keep everything as simple as possible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bun for backend/tooling | User preference ("it is lit") | — Pending |
| STM32F4xx target | Common in real projects, Cortex-M4 | — Pending |
| Server-side compilation | Simpler than WASM-based in-browser compiler | — Pending |
| Loopback for SPI/I2C | Simpler than simulating virtual devices | — Pending |
| Web UI with visual feedback | LEDs + UART console + pin table for immediate feedback | — Pending |

---
*Last updated: 2026-03-05 after initialization*
