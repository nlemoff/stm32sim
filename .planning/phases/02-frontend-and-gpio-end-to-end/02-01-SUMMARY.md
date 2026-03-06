---
phase: 02-frontend-and-gpio-end-to-end
plan: 01
subsystem: gpio, server
tags: [stdin, pipe, poll, gpio-input, websocket, ipc]

# Dependency graph
requires:
  - phase: 01-compilation-and-simulation-engine
    provides: HAL GPIO stubs (ReadPin/WritePin/IDR), process-manager subprocess spawn, WebSocket handler
provides:
  - sim_check_stdin() non-blocking stdin reader in C runtime
  - sim_process_input() JSON parser for gpio_input commands
  - sendGpioInput() server function for stdin pipe writes
  - WebSocket gpio_input message forwarding to subprocess
  - Integration tests proving full GPIO input round-trip
affects: [02-frontend-and-gpio-end-to-end, gpio-visualization, button-panel]

# Tech tracking
tech-stack:
  added: [poll.h (POSIX non-blocking I/O)]
  patterns: [stdin-pipe IPC for subprocess communication, FileSink API for Bun subprocess stdin]

key-files:
  created:
    - tests/gpio-input.test.ts
  modified:
    - hal/src/sim_runtime.h
    - hal/src/sim_runtime.c
    - hal/src/hal_gpio.c
    - hal/src/hal_system.c
    - src/server/runner/process-manager.ts
    - src/server/ws/handler.ts

key-decisions:
  - "Use Bun FileSink API (write+flush) not WritableStream getWriter for subprocess stdin"
  - "Minimum 1ms delay floor in HAL_Delay prevents CPU spinning at very high speed multipliers"
  - "strstr-based JSON parsing in C for gpio_input commands (no JSON library dependency)"
  - "sim_check_stdin called in both HAL_GPIO_ReadPin and HAL_Delay for comprehensive input coverage"

patterns-established:
  - "stdin-pipe IPC: server writes JSON to subprocess stdin, C runtime reads via poll()+read()"
  - "Input validation in WS handler before forwarding (port A-E, pin 0-15, state 0/1)"
  - "Speed 10 in integration tests to avoid zero-delay CPU spinning with button-led sample"

requirements-completed: [GPIO-01, GPIO-04]

# Metrics
duration: 14min
completed: 2026-03-06
---

# Phase 2 Plan 1: GPIO Input Injection Summary

**Non-blocking stdin reader in C runtime + server stdin pipe + WebSocket forwarding for GPIO input injection end-to-end**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-06T05:42:18Z
- **Completed:** 2026-03-06T05:56:27Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- C simulation runtime reads GPIO input commands from stdin via non-blocking poll()
- Server spawns processes with stdin pipe and writes JSON commands via Bun FileSink API
- WebSocket handler validates and forwards gpio_input messages to subprocess stdin
- Full round-trip proven: WS message -> server -> stdin -> IDR update -> gpio_write event -> WS broadcast
- 41 tests pass (38 existing + 3 new) with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add non-blocking stdin reader to C simulation runtime** - `589cbf9` (feat)
2. **Task 2: Add stdin pipe support to server and forward WebSocket gpio_input messages** - `4b5f77e` (feat)

_Note: Task 1 was TDD -- implementation verified by piping JSON to compiled binary and checking gpio_write events._

## Files Created/Modified
- `hal/src/sim_runtime.h` - Added sim_check_stdin() prototype
- `hal/src/sim_runtime.c` - Added sim_check_stdin() and sim_process_input() functions
- `hal/src/hal_gpio.c` - Call sim_check_stdin() in HAL_GPIO_ReadPin before reading IDR
- `hal/src/hal_system.c` - Call sim_check_stdin() in HAL_Delay loop, add minimum 1ms delay floor
- `src/server/runner/process-manager.ts` - stdin: "pipe" in spawn, sendGpioInput(), stdin.end() on stop
- `src/server/ws/handler.ts` - Validate and forward gpio_input messages via sendGpioInput
- `tests/gpio-input.test.ts` - 3 integration tests for GPIO input injection

## Decisions Made
- **Bun FileSink API:** Bun 1.3.10 subprocess stdin is a FileSink, not WritableStream. Uses `stdin.write(str)` + `stdin.flush()` directly, not `getWriter()`.
- **Minimum 1ms delay:** At very high speed multipliers (e.g., 100x), HAL_Delay(50) would round to 0ms, causing infinite CPU spinning. Added floor of 1ms when Delay > 0.
- **strstr-based parsing:** Used simple string search for JSON field extraction in C (no library dependency). Sufficient for the structured gpio_input command format.
- **Dual stdin check points:** sim_check_stdin() called from both HAL_GPIO_ReadPin (catches input right before reading) and HAL_Delay (catches input during idle waits). This ensures input is never missed regardless of firmware patterns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed async fetch function in server index.ts**
- **Found during:** Task 2 (server wouldn't start for tests)
- **Issue:** Server index.ts had `await file.exists()` inside a non-async fetch function (from concurrent plan changes)
- **Fix:** Added `async` keyword to fetch function
- **Files modified:** src/server/index.ts (already committed in another plan)
- **Verification:** Server starts successfully on test ports

**2. [Rule 1 - Bug] Fixed Bun subprocess stdin API usage**
- **Found during:** Task 2 (sendGpioInput failing silently)
- **Issue:** Used WritableStream getWriter() API, but Bun's subprocess stdin is a FileSink with direct write/flush methods
- **Fix:** Changed to `stdin.write(json)` + `stdin.flush()` using FileSink API
- **Files modified:** src/server/runner/process-manager.ts
- **Verification:** Debug script confirmed pin state transitions, all 3 integration tests pass

**3. [Rule 1 - Bug] Added minimum 1ms delay floor in HAL_Delay**
- **Found during:** Task 2 (tests hanging at speed=100)
- **Issue:** At speed multiplier 100, HAL_Delay(50) rounds to 0ms, causing infinite CPU spin with no delay between loop iterations
- **Fix:** Added `if (actual_ms == 0 && Delay > 0) actual_ms = 1;` before sleep loop
- **Files modified:** hal/src/hal_system.c
- **Verification:** Tests run successfully at speed=10, no CPU spinning

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All fixes required for correct operation. No scope creep.

## Issues Encountered
- Test speed=100 causes button-led sample to run with 0ms delay, flooding stdout and hanging tests. Reduced test speed to 10 and added 1ms floor in C code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GPIO input injection backend is complete and tested
- Frontend button-panel can now send gpio_input WebSocket messages to control GPIO pins
- All 41 tests pass, proving no regressions in existing Phase 1 functionality

## Self-Check: PASSED

- All 7 created/modified files exist on disk
- Both task commits (589cbf9, 4b5f77e) exist in git history
- Key functions (sim_check_stdin, sendGpioInput) present in expected files
- 41 tests pass with 0 failures

---
*Phase: 02-frontend-and-gpio-end-to-end*
*Completed: 2026-03-06*
