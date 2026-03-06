# Roadmap: STM32 Virtual Test Bench

## Overview

Three phases that build bottom-up: a backend pipeline that compiles and executes STM32 C code against mock HAL stubs, a browser frontend that lets users write code and see GPIO behavior visualized in real time, and a peripheral expansion phase that adds UART console and SPI/I2C loopback. Each phase delivers a verifiable capability -- Phase 1 works from the command line, Phase 2 delivers the full browser "aha moment" for GPIO, and Phase 3 completes the peripheral suite.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Compilation and Simulation Engine** - Backend pipeline: Mock HAL stubs, server-side compilation, execution runner, state manager, and WebSocket broadcasting
- [ ] **Phase 2: Frontend and GPIO End-to-End** - Browser UI with code editor, GPIO visualization (LEDs, pin table, virtual buttons), simulation controls, and sample projects
- [ ] **Phase 3: UART and SPI/I2C Peripherals** - UART serial console with bidirectional I/O and SPI/I2C loopback with transaction logging

## Phase Details

### Phase 1: Compilation and Simulation Engine
**Goal**: STM32 C code compiles against mock HAL stubs, runs as a native process, and produces a real-time stream of peripheral state changes accessible via API and WebSocket
**Depends on**: Nothing (first phase)
**Requirements**: COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. User can POST C source code to the compilation API and receive either a success response or structured compilation errors with file, line number, and message
  2. A compiled "blink LED" sample runs as a subprocess and emits a stream of GPIO state-change JSON events to stdout, captured by the execution runner
  3. A WebSocket client can connect and receive real-time peripheral state deltas as the simulation runs (verified with a CLI WebSocket tool, no browser needed)
  4. Simulation subprocesses are terminated after a configurable timeout and when the client disconnects (no orphaned processes)
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Bootstrap project, mock HAL stub library, and sample firmware programs
- [x] 01-02-PLAN.md — Compiler module with error parsing and execution runner with subprocess management
- [x] 01-03-PLAN.md — HTTP server with REST API endpoints and WebSocket event streaming

### Phase 2: Frontend and GPIO End-to-End
**Goal**: Users can write STM32 C code in a browser editor, compile it, run it, and see GPIO behavior visualized through LEDs, a pin state table, and virtual input buttons -- the complete write-compile-run-see loop
**Depends on**: Phase 1
**Requirements**: EDIT-01, EDIT-02, EDIT-03, GPIO-01, GPIO-02, GPIO-03, GPIO-04, CTRL-01, CTRL-02, CTRL-03
**Success Criteria** (what must be TRUE):
  1. User can write C code in a browser editor with syntax highlighting, or upload .c/.h files from their local machine, or load a built-in sample project -- all three entry paths work
  2. User clicks "Run" and sees virtual LEDs light up in real time as the firmware sets GPIO pins high, with a pin state table showing all GPIO directions and values updating live
  3. User can click virtual buttons in the UI to send input signals to running firmware, and the firmware's response (e.g., toggling an output pin) is reflected in the visualization
  4. User can start and stop firmware execution with run/stop controls, and a status indicator shows whether the simulation is running, stopped, or in an error state
  5. User sees clear, readable compilation errors in the UI when code fails to compile
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: UART and SPI/I2C Peripherals
**Goal**: Users can observe UART serial output in a terminal console, send input to the firmware via the console, and see SPI/I2C loopback transactions logged -- completing the v1 peripheral suite
**Depends on**: Phase 2
**Requirements**: UART-01, UART-02, UART-03, SPII-01, SPII-02
**Success Criteria** (what must be TRUE):
  1. User runs a "UART hello world" sample and sees serial output appear in an xterm.js terminal console embedded in the UI
  2. User types into the UART console and the running firmware receives the input (bidirectional serial communication works end-to-end)
  3. User runs an SPI or I2C loopback sample and sees transmitted data echoed back, with a timestamped bus transaction log showing all SPI/I2C activity
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Compilation and Simulation Engine | 3/3 | Complete | 2026-03-06 |
| 2. Frontend and GPIO End-to-End | 0/0 | Not started | - |
| 3. UART and SPI/I2C Peripherals | 0/0 | Not started | - |
