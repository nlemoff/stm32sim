---
phase: 02-frontend-and-gpio-end-to-end
plan: 02
subsystem: ui
tags: [codemirror, typescript, css-grid, dark-theme, websocket-client, rest-client, static-serving, bun-bundler]

# Dependency graph
requires:
  - phase: 01-03
    provides: HTTP server with REST API (compile, run, stop, samples), WebSocket event streaming
provides:
  - CodeMirror 6 code editor with C syntax highlighting and One Dark theme
  - File upload support (.c/.h files) via HTML file input
  - Sample project loading from API via dropdown selector
  - REST API client module (compile, run, stop, listSamples, getSample)
  - WebSocket connection manager with typed event dispatch and GPIO input sending
  - Simulation state machine (idle/compiling/running/stopped/error)
  - CSS Grid layout with editor panel, visualization panel, toolbar
  - Static file serving from dist/ directory on same Bun server
affects: [02-03-gpio-viz, 02-04-verification]

# Tech tracking
tech-stack:
  added: [codemirror@6.0.2, "@codemirror/lang-cpp@6.0.3", "@codemirror/theme-one-dark@6.1.3"]
  patterns: [vanilla-ts-modules, css-custom-properties, bun-html-bundler, same-origin-static-serving]

key-files:
  created:
    - src/client/index.html
    - src/client/style.css
    - src/client/index.ts
    - src/client/editor/editor.ts
    - src/client/sim/api.ts
    - src/client/sim/websocket.ts
    - src/client/sim/state.ts
  modified:
    - package.json
    - src/server/index.ts

key-decisions:
  - "Vanilla TypeScript with no UI framework -- DOM manipulation sufficient for ~5 interactive elements"
  - "basicSetup from codemirror meta-package provides complete editor experience (undo, search, etc.) in ~200KB"
  - "Static files served from dist/ after API routes, same port as backend (no CORS needed)"
  - "Bun HTML bundler for zero-config frontend build (bun build index.html --outdir=dist --minify)"

patterns-established:
  - "Module init pattern: each frontend module exports init/get/set functions, called from index.ts bootstrap"
  - "API client pattern: async functions with same-origin fetch, throw on non-ok responses"
  - "WebSocket dispatch pattern: SimConnection class with on(type, handler) and wildcard '*' support"
  - "State machine pattern: module-level state with getStatus/setStatus/onStatusChange listener pattern"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03]

# Metrics
duration: 11min
completed: 2026-03-06
---

# Phase 2 Plan 02: Frontend Scaffold Summary

**CodeMirror 6 editor with C syntax highlighting, file upload, sample loading dropdown, REST/WebSocket client modules, and Bun-served static frontend on same port as API**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-06T05:42:07Z
- **Completed:** 2026-03-06T05:53:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- CodeMirror 6 editor with C/C++ syntax highlighting (via @codemirror/lang-cpp) and One Dark theme renders in browser
- File upload reads .c/.h files into the editor via HTML file input with reset for re-upload
- Sample project dropdown auto-populates from GET /api/samples and loads code via GET /api/samples/:name
- REST API client covers all 5 endpoints with error handling (throw on non-ok responses)
- WebSocket SimConnection class dispatches typed events with wildcard support and GPIO input sending
- Simulation state machine tracks idle/compiling/running/stopped/error with listener notification
- Frontend built with Bun HTML bundler (25 modules, 0.52MB minified JS + 3.4KB CSS)
- Server serves static files from dist/ directory on same port as API (no CORS complications)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install CodeMirror, create HTML/CSS scaffold, and set up build script** - `8eea86a` (feat)
2. **Task 2: Create CodeMirror editor, API/WebSocket clients, state machine, and serve static files** - `c45c029` (feat)

## Files Created/Modified
- `src/client/index.html` - HTML entry point with CSS Grid layout (toolbar, editor panel, viz panel)
- `src/client/style.css` - Dark theme CSS with LED, button, pin-table, status badge styles
- `src/client/index.ts` - Application bootstrap: init editor, populate samples, wire file upload
- `src/client/editor/editor.ts` - CodeMirror 6 setup with initEditor, getCode, setCode, setupFileUpload
- `src/client/sim/api.ts` - REST API client: compile, run, stop, listSamples, getSample
- `src/client/sim/websocket.ts` - SimConnection class: connect, on, sendGpioInput, disconnect, onClose
- `src/client/sim/state.ts` - State machine: getStatus, setStatus, onStatusChange
- `package.json` - Added codemirror dependencies and build:client/dev scripts
- `src/server/index.ts` - Added static file serving from dist/ after API routes

## Decisions Made
- Used vanilla TypeScript with no UI framework -- the app has ~5 interactive elements, DOM manipulation via querySelector/createElement is sufficient
- Used `basicSetup` from codemirror meta-package instead of `minimalSetup` for complete editor experience (undo, search, bracket matching, line numbers)
- Serve static files from dist/ on the same port as the API backend to avoid CORS complications and simplify deployment
- Used Bun's built-in HTML bundler (`bun build index.html`) for zero-config frontend builds -- no Vite or Webpack needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in hal-compile.test.ts (1 test) caused by Plan 02-01 commit 589cbf9 that modified sim_runtime.c stdout output format. Not caused by this plan's changes. Logged to deferred-items.md.
- Integration test timeouts when running all tests together due to port conflicts (multiple test files start server on port 3001). Tests pass individually. Pre-existing infrastructure issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend scaffold complete with all UI containers ready for Plan 03 GPIO visualization
- Editor, API client, WebSocket manager, and state machine modules are exported and importable from Plan 03
- Plan 03 will wire up Run/Stop buttons, create GPIO LED panel, pin state table, and virtual button panel
- All containers have semantic IDs (#led-panel, #pin-table, #button-panel, #error-panel) ready for Plan 03 to populate

## Self-Check: PASSED

All 7 created files verified on disk. Both commit hashes (8eea86a, c45c029) verified in git log. All required exports present.

---
*Phase: 02-frontend-and-gpio-end-to-end*
*Completed: 2026-03-06*
