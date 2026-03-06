# Phase 1: Compilation and Simulation Engine - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend pipeline that compiles STM32 C code against mock HAL stubs, runs it as a native process, and produces a real-time stream of peripheral state changes accessible via API and WebSocket. No browser UI -- this phase is verified entirely from the command line and API clients.

</domain>

<decisions>
## Implementation Decisions

### Firmware realism
- Full STM32 HAL boilerplate: user code includes HAL_Init(), SystemClock_Config(), full GPIO_InitTypeDef structs -- looks like real STM32CubeIDE code
- System/clock config stubs silently succeed (no-ops) but must compile
- GPIO ports GPIOA through GPIOE supported (5 ports, 80 pins)
- All peripheral stubs exist in Phase 1: GPIO fully functional, UART/SPI/I2C stubs compile as no-ops (behavior wired up in Phase 3)
- HAL_Delay() uses real sleep with simulation speed multiplier (1x = real time, configurable for fast-forward)

### Error reporting
- Compilation errors parsed from gcc output into structured JSON: file, line, column, severity, message
- Raw gcc output also available as fallback
- Distinct error categories: compilation errors, linker errors, and runtime errors (segfault, timeout)
- All errors returned (no cap) -- Phase 2 UI can paginate/truncate as needed
- Warnings included but clearly separated from errors (Phase 2 renders as yellow vs red)

### Sample firmware
- Three sample programs ship with Phase 1:
  1. **Blink LED** (default): Toggle PA5 every 500ms -- classic STM32 hello world
  2. **Knight Rider**: 4 LEDs (PA5-PA8) chase pattern -- demonstrates multiple GPIO pins
  3. **Button LED**: PA0 input (button) toggles PA5 output (LED) -- proves GPIO input works
- Samples live in top-level `samples/` directory with subdirectories per sample (samples/blink/, samples/knight-rider/, samples/button-led/)
- All samples include educational comments explaining HAL calls -- makes the simulator useful for learning

### Claude's Discretion
- State event JSON format (structure of GPIO state-change events over WebSocket)
- API endpoint design (REST routes for compile/run/stop)
- Subprocess isolation implementation details
- Exact HAL function list beyond what samples require
- WebSocket protocol details (connection, heartbeat, reconnection)

</decisions>

<specifics>
## Specific Ideas

- Code should look like it came from STM32CubeIDE -- authentic experience, not a toy API
- Button sample important for proving GPIO input path end-to-end before Phase 2 adds virtual buttons (GPIO-04)
- Educational comments in samples make the simulator useful beyond just a tech demo

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None -- greenfield project, no existing code

### Established Patterns
- Bun runtime selected for backend/tooling
- Host-native gcc (not ARM cross-compiler) with mock HAL stubs

### Integration Points
- Compilation API will be consumed by Phase 2's browser UI
- State event WebSocket stream will drive Phase 2's GPIO visualization (LEDs, pin table)
- Error JSON format will be rendered by Phase 2's editor error markers
- Sample firmware files will be loaded by Phase 2's "load sample" feature (EDIT-03)

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-compilation-and-simulation-engine*
*Context gathered: 2026-03-05*
