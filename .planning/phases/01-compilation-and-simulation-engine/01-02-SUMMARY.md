---
phase: 01-compilation-and-simulation-engine
plan: 02
subsystem: compiler
tags: [gcc, json-diagnostics, subprocess, bun-spawn, tdd, process-manager]

# Dependency graph
requires:
  - phase: 01-01
    provides: Mock HAL stub library, sample firmware, JSON event protocol
provides:
  - Compiler module (GCC invocation + structured error/warning parsing)
  - Execution runner (subprocess spawn, event streaming, timeout, cleanup)
  - Simulation state registry (Map-based active simulation tracking)
  - Stdout line-delimited JSON stream parser
affects: [01-03, 02-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [gcc-json-diagnostics, bun-spawnsync, async-generator-streaming, tdd-red-green]

key-files:
  created:
    - src/server/compiler/errors.ts
    - src/server/compiler/compile.ts
    - src/server/runner/stdout-parser.ts
    - src/server/runner/process-manager.ts
    - src/server/state/simulation.ts
    - tests/error-parser.test.ts
    - tests/compile.test.ts
    - tests/process-manager.test.ts
  modified: []

key-decisions:
  - "Used process.cwd() for HAL path resolution instead of import.meta.dir -- more reliable across test and production contexts"
  - "globSync for HAL source discovery rather than hardcoded file list -- automatically picks up new HAL .c files"
  - "Async generator pattern for stdout streaming -- composable, backpressure-aware, clean error handling"
  - "Simulation store cleanup in both stopSimulation and exit handler -- prevents stale entries on race conditions"

patterns-established:
  - "Compiler pattern: mkdtemp -> write main.c -> Bun.spawnSync gcc -> parseGccDiagnostics -> CompileResult"
  - "Runner pattern: Bun.spawn -> streamEvents async generator -> onEvent callback -> proc.exited cleanup"
  - "Error fallback pattern: try JSON.parse -> try extract JSON substring -> fallback to raw text as linker error"
  - "TDD cycle: RED (failing tests committed) -> GREEN (implementation committed) per task"

requirements-completed: [COMP-01, COMP-02, COMP-03]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 1 Plan 02: Compiler and Execution Runner Summary

**GCC compiler module with JSON diagnostic parsing (errors/warnings/linker fallback) and subprocess runner with event streaming, timeout enforcement, and concurrent simulation tracking -- 20 TDD tests across 3 files**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T01:06:47Z
- **Completed:** 2026-03-06T01:10:54Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Compiler module that invokes GCC with -fdiagnostics-format=json, manages temp directories, and returns structured CompileResult with separated errors/warnings
- Error parser that handles three input forms: pure GCC JSON, mixed JSON+linker text, and pure linker text fallback
- Execution runner that spawns compiled binaries as subprocesses, streams JSON events via async generator, and enforces configurable timeout
- Simulation state registry supporting concurrent independent simulations with proper cleanup on stop/exit/timeout

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Build compiler module with error parsing**
   - RED: `9c06775` (test) - 12 failing tests for error parser + compiler
   - GREEN: `6015c5d` (feat) - errors.ts + compile.ts implementation
2. **Task 2: Build execution runner with subprocess management**
   - RED: `f2dc35f` (test) - 8 failing tests for process manager
   - GREEN: `f89769e` (feat) - stdout-parser.ts + process-manager.ts + simulation.ts

## Files Created/Modified
- `src/server/compiler/errors.ts` - GCC JSON diagnostic parser with linker error fallback
- `src/server/compiler/compile.ts` - GCC invocation, temp dir management, compilation orchestration
- `src/server/runner/stdout-parser.ts` - Line-delimited JSON stream parser (async generator)
- `src/server/runner/process-manager.ts` - Subprocess spawn/stop/timeout/cleanup with event streaming
- `src/server/state/simulation.ts` - Active simulation registry (Map by ID)
- `tests/error-parser.test.ts` - 6 tests for GCC diagnostic parsing
- `tests/compile.test.ts` - 6 tests for compilation flow
- `tests/process-manager.test.ts` - 8 tests for subprocess management

## Decisions Made
- Used `process.cwd()` for HAL path resolution instead of `import.meta.dir` -- more reliable when tests run from different contexts
- Used `globSync` to discover HAL source files rather than hardcoding a list -- automatically adapts when new HAL stubs are added
- Used async generator pattern (`streamEvents`) for stdout parsing -- composable, handles backpressure naturally, and cleans up on process kill
- Simulation store entries are removed in both `stopSimulation()` and the `proc.exited` handler to handle race conditions between manual stop and natural exit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Compiler module ready to wire into HTTP routes (Plan 03 POST /api/compile)
- Runner module ready to wire into HTTP routes + WebSocket broadcasting (Plan 03)
- All 20 tests green, providing regression safety for Plan 03 integration
- Full test suite (27 tests including Plan 01) passes with no regressions

## Self-Check: PASSED

All 8 created files verified on disk. All 4 commit hashes verified in git log.

---
*Phase: 01-compilation-and-simulation-engine*
*Completed: 2026-03-06*
