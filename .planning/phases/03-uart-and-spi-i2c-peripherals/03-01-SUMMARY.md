---
phase: 03-uart-and-spi-i2c-peripherals
plan: 01
subsystem: hal
tags: [uart, spi, i2c, hal-stubs, event-pipeline, ring-buffer, websocket]

# Dependency graph
requires:
  - phase: 01-backend-pipeline
    provides: "sim_emit_event infrastructure, HAL stub skeleton, process-manager stdin pipe"
  - phase: 02-frontend-and-gpio-e2e
    provides: "WebSocket handler pattern, sendGpioInput pattern, stdin input pipeline"
provides:
  - "Functional UART HAL stubs emitting uart_tx events with JSON-escaped data"
  - "UART RX ring buffer in sim_runtime.c for bidirectional serial communication"
  - "SPI HAL stubs with loopback and spi_transfer event emission"
  - "I2C HAL stubs with i2c_transfer event emission"
  - "Server-side sendUartInput function for WebSocket-to-stdin UART forwarding"
  - "uart-hello and spi-loopback sample firmware programs"
affects: [03-uart-and-spi-i2c-peripherals]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UART RX ring buffer pattern: sim_uart_rx_push/pop/available API in sim_runtime"
    - "JSON string escaping in C for UART data embedded in events"
    - "Hex-encoded SPI/I2C data in transfer events (space-separated bytes)"
    - "uart_rx input handling in sim_process_input alongside gpio_input"

key-files:
  created:
    - "samples/uart-hello/main.c"
    - "samples/spi-loopback/main.c"
  modified:
    - "hal/src/hal_uart.c"
    - "hal/src/hal_spi.c"
    - "hal/src/hal_i2c.c"
    - "hal/src/sim_runtime.c"
    - "hal/src/sim_runtime.h"
    - "src/server/runner/process-manager.ts"
    - "src/server/ws/handler.ts"
    - "tests/simulation-run.test.ts"

key-decisions:
  - "UART TX escapes JSON special chars in C before embedding in event payload"
  - "UART RX uses 256-byte ring buffer with drop-on-full semantics (no blocking)"
  - "HAL_UART_Receive polls ring buffer with 1ms sleep, uses HAL_GetTick for timeout"
  - "SPI/I2C data encoded as hex strings (space-separated) -- JSON-safe without extra escaping"

patterns-established:
  - "uart_rx input flow: WebSocket -> sendUartInput -> stdin JSON -> sim_process_input -> ring buffer -> HAL_UART_Receive"
  - "Peripheral event naming: uart_tx, spi_transfer, i2c_transfer"

requirements-completed: [UART-01, UART-03, SPII-01]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 3 Plan 01: UART/SPI/I2C HAL Stubs Summary

**Functional UART/SPI/I2C HAL stubs emitting JSON events with bidirectional UART RX via ring buffer, plus uart-hello and spi-loopback sample firmware**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T06:57:17Z
- **Completed:** 2026-03-06T07:01:22Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- All HAL UART/SPI/I2C stubs now emit JSON events through the established sim_emit_event pipeline
- Bidirectional UART: HAL_UART_Transmit emits uart_tx events; HAL_UART_Receive reads from ring buffer filled by stdin uart_rx messages
- SPI loopback: TransmitReceive copies TX to RX buffer and emits spi_transfer events with hex data
- I2C: Master_Transmit/Receive emit i2c_transfer events with device address and hex data
- Server-side uart_rx forwarding: WebSocket handler validates and pipes uart_rx messages to subprocess stdin
- Two new sample firmware programs (uart-hello, spi-loopback) compile and run correctly
- All 41 existing tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire UART/SPI/I2C HAL stubs to event pipeline and add UART RX ring buffer** - `3bded2c` (feat)
2. **Task 2: Add server-side UART input forwarding and sample firmware programs** - `38480f9` (feat)

## Files Created/Modified
- `hal/src/hal_uart.c` - UART TX event emission with JSON escaping, RX from ring buffer with timeout
- `hal/src/hal_spi.c` - SPI loopback + spi_transfer event emission with hex data
- `hal/src/hal_i2c.c` - I2C i2c_transfer event emission with device address and hex data
- `hal/src/sim_runtime.c` - UART RX ring buffer (push/pop/available) and uart_rx input parsing
- `hal/src/sim_runtime.h` - Added sim_uart_rx_push/pop/available declarations and stdint.h include
- `src/server/runner/process-manager.ts` - Added sendUartInput function for stdin pipe writes
- `src/server/ws/handler.ts` - Added uart_rx message handling with data validation
- `samples/uart-hello/main.c` - UART hello world: transmits greeting, echoes received chars
- `samples/spi-loopback/main.c` - SPI loopback: sends DE AD BE EF in a loop
- `tests/simulation-run.test.ts` - Updated sample count from 3 to 5

## Decisions Made
- UART TX data is JSON-escaped in C (handles `"`, `\`, `\n`, `\r`, `\t`, non-printable as `\uXXXX`) before embedding in event payload
- UART RX ring buffer is 256 bytes with drop-on-full semantics -- simple and sufficient for interactive serial use
- HAL_UART_Receive polls the ring buffer with sim_check_stdin() calls and 1ms usleep between iterations, tracking timeout via HAL_GetTick()
- SPI and I2C data encoded as space-separated hex bytes (e.g., "DE AD BE EF") -- inherently JSON-safe, no extra escaping needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing stdint.h include in sim_runtime.h**
- **Found during:** Task 1 (HAL stubs compilation)
- **Issue:** sim_runtime.h declared functions using uint8_t but did not include stdint.h, causing compilation errors
- **Fix:** Added `#include <stdint.h>` to sim_runtime.h
- **Files modified:** hal/src/sim_runtime.h
- **Verification:** Blink sample compiles cleanly
- **Committed in:** 3bded2c (Task 1 commit)

**2. [Rule 1 - Bug] Updated samples test count from 3 to 5**
- **Found during:** Task 2 (sample firmware creation)
- **Issue:** Existing test hardcoded `expect(data.length).toBe(3)` but we added 2 new samples
- **Fix:** Updated test to expect 5 samples and verify new sample names (uart-hello, spi-loopback)
- **Files modified:** tests/simulation-run.test.ts
- **Verification:** All 41 tests pass
- **Committed in:** 38480f9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All backend UART/SPI/I2C event emission is complete and verified
- Server-side uart_rx forwarding is ready for the frontend terminal to use
- Next plans can add the xterm.js UART terminal console and SPI/I2C bus log panel
- Both new samples are available via /api/samples for the sample picker

## Self-Check: PASSED

All 10 files verified present. Both commit hashes (3bded2c, 38480f9) found in git log.
All 8 must-have artifact patterns verified in their respective files.

---
*Phase: 03-uart-and-spi-i2c-peripherals*
*Completed: 2026-03-06*
