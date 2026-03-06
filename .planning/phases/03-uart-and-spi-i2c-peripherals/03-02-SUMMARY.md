---
phase: 03-uart-and-spi-i2c-peripherals
plan: 02
subsystem: ui
tags: [xterm.js, uart-terminal, bus-log, spi, i2c, websocket, frontend]

# Dependency graph
requires:
  - phase: 03-uart-and-spi-i2c-peripherals
    plan: 01
    provides: "UART/SPI/I2C HAL stubs emitting uart_tx, spi_transfer, i2c_transfer events; server-side sendUartInput"
  - phase: 02-frontend-and-gpio-e2e
    provides: "SimConnection WebSocket class, event dispatch pattern, toolbar clear-on-run pattern, CSS grid layout"
provides:
  - "xterm.js UART terminal console with bidirectional serial I/O"
  - "SPI/I2C bus log panel with timestamped transaction rows"
  - "sendUartInput method on SimConnection for keyboard-to-firmware input"
  - "Event handler wiring for uart_tx, spi_transfer, i2c_transfer events"
  - "Clear-on-run integration for terminal and bus log"
affects: [03-uart-and-spi-i2c-peripherals]

# Tech tracking
tech-stack:
  added: ["@xterm/xterm 6.0.0", "@xterm/addon-fit 0.11.0"]
  patterns:
    - "xterm.js terminal module pattern: module-level Terminal/FitAddon state, init/write/clear exports"
    - "Bus log pattern: scrollable table with timestamped rows, auto-scroll to bottom"
    - "Bottom panels CSS grid: full-width row below editor/viz, split 50/50 for terminal and log"

key-files:
  created:
    - "src/client/uart/uart-terminal.ts"
    - "src/client/bus/bus-log.ts"
  modified:
    - "src/client/sim/websocket.ts"
    - "src/client/index.html"
    - "src/client/style.css"
    - "src/client/index.ts"
    - "src/client/controls/toolbar.ts"
    - "package.json"

key-decisions:
  - "No local echo in terminal -- let firmware echo via HAL_UART_Transmit (matches real serial behavior)"
  - "convertEol: true in xterm.js to auto-convert \\n to \\r\\n for proper newlines"
  - "ResizeObserver on terminal container for responsive fitting rather than window resize event"
  - "Bus log uses scrollable wrapper div with sticky table headers for usability"

patterns-established:
  - "UART terminal init pattern: xterm.js Terminal + FitAddon + ResizeObserver in module-level state"
  - "Bus log append pattern: create tr, append to tbody, auto-scroll scroll parent"
  - "Bottom panels layout: grid-column 1/-1, grid-row 2, split into equal columns"

requirements-completed: [UART-02, UART-03, SPII-02]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 3 Plan 02: UART Terminal and Bus Log UI Summary

**xterm.js UART terminal console with bidirectional serial I/O and SPI/I2C bus transaction log panel, wired to backend event pipeline**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T07:04:18Z
- **Completed:** 2026-03-06T07:06:55Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- xterm.js terminal with dark theme, cursor blink, convertEol, and FitAddon for responsive sizing
- Bidirectional UART: firmware output displayed via uart_tx events; user keystrokes sent as uart_rx via WebSocket
- SPI/I2C bus log panel with timestamped, auto-scrolling table rows for transfer events
- Clear-on-run pattern extended to terminal and bus log alongside existing GPIO clear calls
- UI layout updated to 2-row grid: editor+GPIO top, UART terminal+bus log bottom
- All 41 existing tests pass, frontend builds cleanly (36 modules bundled)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install xterm.js and create UART terminal and bus log modules** - `2e90973` (feat)
2. **Task 2: Wire UART terminal and bus log into UI layout and event pipeline** - `b5c98d0` (feat)

## Files Created/Modified
- `src/client/uart/uart-terminal.ts` - xterm.js terminal init, write, clear with ResizeObserver
- `src/client/bus/bus-log.ts` - SPI/I2C transaction log table with auto-scroll
- `src/client/sim/websocket.ts` - Added sendUartInput method for UART RX over WebSocket
- `src/client/index.html` - Added uart-terminal and bus-log container divs in bottom-panels section
- `src/client/style.css` - Updated grid layout with bottom panels row, UART and bus log styles
- `src/client/index.ts` - Wired uart_tx, spi_transfer, i2c_transfer event handlers
- `src/client/controls/toolbar.ts` - Added clearTerminal and clearBusLog to run handler
- `package.json` - Added @xterm/xterm and @xterm/addon-fit dependencies

## Decisions Made
- No local echo in xterm.js terminal -- firmware echoes via HAL_UART_Transmit, matching real serial terminal behavior
- convertEol: true handles \n to \r\n conversion automatically, avoiding staircase text rendering
- ResizeObserver on container (not window resize event) for more robust terminal fitting
- Bus log wrapped in scrollable div with sticky headers for better UX with many entries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UART terminal and bus log are fully wired to backend event pipeline
- Users can see firmware UART output and type input back via the terminal
- SPI/I2C transfer events display as timestamped rows in the bus log
- All clear-on-run patterns are in place for fresh simulation starts
- Ready for Plan 03 (final verification and integration testing)

## Self-Check: PASSED

All 8 files verified present. Both commit hashes (2e90973, b5c98d0) found in git log.
All 9 must-have artifact patterns verified in their respective files.
Line counts: uart-terminal.ts (69 lines >= 30 min), bus-log.ts (67 lines >= 20 min).

---
*Phase: 03-uart-and-spi-i2c-peripherals*
*Completed: 2026-03-06*
