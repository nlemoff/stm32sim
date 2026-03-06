# Requirements: STM32 Virtual Test Bench

**Defined:** 2026-03-05
**Core Value:** Developers can write STM32 C code in a browser, hit run, and immediately see their firmware's behavior visualized

## v1 Requirements

### Compilation

- [x] **COMP-01**: User can compile STM32 C code server-side using native gcc with mock HAL stubs
- [ ] **COMP-02**: User can run compiled firmware and see execution results streamed to the browser in real-time
- [ ] **COMP-03**: User sees clear, readable compilation errors when code fails to compile

### Editor

- [ ] **EDIT-01**: User can write C code in a browser-based editor with syntax highlighting
- [ ] **EDIT-02**: User can upload .c/.h files from their local machine
- [ ] **EDIT-03**: User can load built-in sample projects (LED blink, UART hello world) as starting points

### GPIO

- [ ] **GPIO-01**: Simulator supports GPIO peripheral — set pins high/low, read input state
- [ ] **GPIO-02**: Virtual LEDs light up in the UI when corresponding GPIO pins are set high
- [ ] **GPIO-03**: Pin state table shows all GPIO pins with current direction and state (high/low)
- [ ] **GPIO-04**: User can click virtual buttons in the UI to send input signals to the running firmware

### UART

- [ ] **UART-01**: Simulator supports UART transmit — firmware serial output captured
- [ ] **UART-02**: UART output displayed in an xterm.js terminal console in the UI
- [ ] **UART-03**: User can type into the UART console and firmware receives the input (bidirectional)

### SPI/I2C

- [ ] **SPII-01**: Simulator supports SPI/I2C loopback — data sent is echoed back and displayed
- [ ] **SPII-02**: Timestamped bus log shows all SPI/I2C transactions

### Controls

- [ ] **CTRL-01**: User can start and stop firmware execution with run/stop controls
- [ ] **CTRL-02**: Simulation status indicator shows current state (running/stopped/error)
- [ ] **CTRL-03**: User can adjust simulation speed (slow-mo / normal / fast-forward)

## v2 Requirements

### Editor Enhancements

- **EDIT-04**: Auto-complete suggestions for STM32 HAL functions
- **EDIT-05**: Multi-file project support with file tree

### Compilation Enhancements

- **COMP-04**: Cached/incremental compilation for faster rebuilds

### Advanced Controls

- **CTRL-04**: Step-through execution mode

### UART Enhancements

- **UART-04**: ANSI color code support in UART console

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full ARM Cortex-M CPU emulation | Project-killing complexity — mock HAL is sufficient |
| Timer/PWM simulation | Not selected for v1 demo |
| DMA, ADC, DAC peripherals | Beyond minimal demo scope |
| Virtual I2C/SPI devices (sensors, displays) | Loopback is sufficient for demo |
| Debugging (breakpoints, stepping) | Entire product by itself |
| Schematic editor | Massive scope — not needed for code testing |
| Mobile app | Web only |
| Multi-user / collaboration | Single-user demo |
| OAuth / user accounts | No authentication needed for demo |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMP-01 | Phase 1 | Complete (01-01) |
| COMP-02 | Phase 1 | Pending |
| COMP-03 | Phase 1 | Pending |
| EDIT-01 | Phase 2 | Pending |
| EDIT-02 | Phase 2 | Pending |
| EDIT-03 | Phase 2 | Pending |
| GPIO-01 | Phase 2 | Pending |
| GPIO-02 | Phase 2 | Pending |
| GPIO-03 | Phase 2 | Pending |
| GPIO-04 | Phase 2 | Pending |
| UART-01 | Phase 3 | Pending |
| UART-02 | Phase 3 | Pending |
| UART-03 | Phase 3 | Pending |
| SPII-01 | Phase 3 | Pending |
| SPII-02 | Phase 3 | Pending |
| CTRL-01 | Phase 2 | Pending |
| CTRL-02 | Phase 2 | Pending |
| CTRL-03 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
