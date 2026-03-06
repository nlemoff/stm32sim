---
phase: 02-frontend-and-gpio-end-to-end
plan: 05
subsystem: ui
tags: [websocket, gpio, event-dispatch, connection-lifecycle]

# Dependency graph
requires:
  - phase: 02-frontend-and-gpio-end-to-end
    provides: "SimConnection class with event dispatch (plan 02-02, 02-03)"
provides:
  - "SimConnection.disconnect() that preserves handlers across connect/disconnect cycles"
  - "Reliable multi-run GPIO event delivery (gpio_init, gpio_write, sim_exit)"
affects: [03-uart-and-spi-i2c-peripherals]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Application-lifetime handler registration preserved across connection cycles"]

key-files:
  created: []
  modified: [src/client/sim/websocket.ts]

key-decisions:
  - "Minimal fix: remove handler clearing rather than re-registering handlers on each connect"

patterns-established:
  - "Connection lifecycle: disconnect() only tears down transport, not application-level dispatch"

requirements-completed: [CTRL-01, GPIO-02, GPIO-03, GPIO-04]

# Metrics
duration: 1min
completed: 2026-03-06
---

# Phase 2 Plan 5: Fix SimConnection Handler Persistence Summary

**Fix disconnect() to preserve GPIO event handlers across simulation Run/Stop/Run cycles**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T06:29:10Z
- **Completed:** 2026-03-06T06:30:02Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed `handlers.clear()` from disconnect() that was destroying gpio_init, gpio_write, and sim_exit handlers registered once at startup
- Removed `closeHandlers = []` reset that was destroying the onClose handler from toolbar.ts
- Second simulation run after Stop now correctly receives GPIO events and updates LEDs/pin table

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove handler clearing from SimConnection.disconnect()** - `9b49e34` (fix)

## Files Created/Modified
- `src/client/sim/websocket.ts` - Removed handler/closeHandler clearing from disconnect(), updated JSDoc

## Decisions Made
- Minimal fix approach: removed handler clearing from disconnect() rather than restructuring callers to re-register handlers before each connect(). This is the correct design since handlers are application-lifetime registrations, not per-connection state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 gap closure complete -- all verification issues resolved
- SimConnection now properly supports multi-run simulation cycles
- Ready for Phase 3 peripheral development (UART, SPI, I2C)

## Self-Check: PASSED

- FOUND: src/client/sim/websocket.ts
- FOUND: 02-05-SUMMARY.md
- FOUND: commit 9b49e34

---
*Phase: 02-frontend-and-gpio-end-to-end*
*Completed: 2026-03-06*
