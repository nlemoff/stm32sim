# Phase 2: Frontend and GPIO End-to-End - Research

**Researched:** 2026-03-05
**Domain:** Browser-based code editor, GPIO visualization, real-time WebSocket UI, subprocess stdin IPC
**Confidence:** HIGH

## Summary

Phase 2 builds the complete user-facing frontend for the STM32 Virtual Test Bench. Users will write C code in a browser editor (CodeMirror 6 with C/C++ syntax highlighting), compile it via the existing REST API, run the simulation, and see GPIO behavior visualized through virtual LEDs, a pin state table, and interactive virtual buttons. The frontend consumes the Phase 1 backend entirely: POST /api/compile, POST /api/run, POST /api/stop, GET /api/samples, and the WebSocket event stream at /ws?simulationId=X.

The major architectural decision is to use **vanilla TypeScript with no UI framework** (no React, Vue, etc.). The app is a single-page tool with a fixed layout -- not a content app with routing and state management complexity. CodeMirror 6 handles the only complex UI component (the editor). The remaining UI (buttons, LEDs, pin table, error panel) is straightforward DOM manipulation. Bun 1.3.10 can serve the frontend via its built-in HTML bundler (`bun ./index.html`) during development and `bun build ./index.html --outdir=dist` for production, eliminating the need for Vite or Webpack.

The hardest new engineering challenge is **GPIO input injection** (GPIO-04). When a user clicks a virtual button, the frontend sends a WebSocket message to the server, which must relay that input to the running C subprocess so `HAL_GPIO_ReadPin()` returns the correct value. The solution is stdin-based IPC: the simulation process is spawned with `stdin: "pipe"`, and a background thread in the C runtime reads JSON commands from stdin to update the GPIO IDR (Input Data Register). The `HAL_GPIO_ReadPin()` function already reads from `GPIOx->IDR`, so updating IDR from stdin input makes the entire flow work transparently.

**Primary recommendation:** Vanilla TypeScript frontend bundled by Bun, CodeMirror 6 for the editor, stdin-pipe IPC for GPIO input injection, CSS Grid layout for the tool's panel structure.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDIT-01 | User can write C code in a browser-based editor with syntax highlighting | CodeMirror 6 with @codemirror/lang-cpp provides C/C++ syntax highlighting, line numbers, bracket matching |
| EDIT-02 | User can upload .c/.h files from their local machine | HTML file input + FileReader API reads file content into CodeMirror editor state |
| EDIT-03 | User can load built-in sample projects as starting points | GET /api/samples list + GET /api/samples/:name already implemented in Phase 1; frontend fetches and loads into editor |
| GPIO-01 | Simulator supports GPIO peripheral -- set pins high/low, read input state | Already implemented in Phase 1 hal_gpio.c (WritePin, ReadPin, TogglePin); Phase 2 adds stdin-based IDR updates for input |
| GPIO-02 | Virtual LEDs light up in the UI when corresponding GPIO pins are set high | Frontend listens for `gpio_write` WebSocket events and updates LED SVG/CSS based on pin state |
| GPIO-03 | Pin state table shows all GPIO pins with current direction and state | Frontend maintains GPIO state map from `gpio_init` (direction) and `gpio_write` (state) events, renders as HTML table |
| GPIO-04 | User can click virtual buttons in the UI to send input signals to running firmware | WebSocket client sends `gpio_input` message -> server writes to subprocess stdin -> C runtime updates IDR -> HAL_GPIO_ReadPin returns new value |
| CTRL-01 | User can start and stop firmware execution with run/stop controls | Frontend buttons call POST /api/compile + POST /api/run (start) and POST /api/stop (stop) |
| CTRL-02 | Simulation status indicator shows current state (running/stopped/error) | Frontend state machine tracks status from API responses and WebSocket events (sim_start, sim_exit, errors) |
| CTRL-03 | User can adjust simulation speed (slow-mo / normal / fast-forward) | Speed parameter passed to POST /api/run request body; already supported by backend SIM_SPEED env var |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CodeMirror 6 | 6.0.2 (`codemirror` meta-package) | Browser code editor with syntax highlighting | The de facto code editor for web apps; modular, performant, MIT licensed |
| @codemirror/lang-cpp | 6.0.3 | C/C++ syntax highlighting and indentation | Official CodeMirror language package based on Lezer C++ parser; covers C syntax |
| @codemirror/theme-one-dark | 6.1.3 | Dark theme for editor | Professional dark theme matching IDE aesthetics; official CodeMirror package |
| Bun bundler | 1.3.10 (installed) | Bundle frontend TypeScript/CSS/HTML | Zero-config, built-in to Bun -- `bun build ./index.html` handles everything |
| Vanilla TypeScript | n/a | Frontend application logic | No framework overhead for a single-page tool; DOM manipulation is straightforward |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @codemirror/view | (transitive via `codemirror`) | EditorView API | Creating and managing the editor instance |
| @codemirror/state | (transitive via `codemirror`) | EditorState API | Managing document content, dispatching transactions |
| @codemirror/commands | (transitive via `codemirror`) | Editor keyboard shortcuts | Undo/redo, indentation, selection commands |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla TypeScript | React/Vue/Svelte | Adds 30-100KB bundle, build complexity, and component lifecycle overhead for an app with only ~5 interactive elements. Not justified for a single-page tool. |
| CodeMirror 6 | Monaco Editor | Monaco is 2-5MB (VS Code engine) vs ~200KB for CodeMirror. Monaco is overkill for syntax highlighting + basic editing. |
| Bun bundler | Vite/Webpack | Extra dev dependency; Bun 1.3.10 handles HTML entry, TS transpilation, CSS, and hot reload natively |
| @codemirror/theme-one-dark | Custom theme | One Dark is recognizable, professional, and works out of the box |

**Installation:**
```bash
cd /home/nlemo/stm32sim
bun add codemirror @codemirror/lang-cpp @codemirror/theme-one-dark
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  client/                    # Frontend source (bundled by Bun)
    index.html               # Entry point -- Bun bundles scripts/styles from here
    index.ts                 # Application bootstrap, wires up modules
    style.css                # Global styles, layout grid, LED/button styles
    editor/
      editor.ts              # CodeMirror setup, file upload, sample loading
    sim/
      api.ts                 # REST API client (compile, run, stop, samples)
      websocket.ts           # WebSocket connection manager, event dispatcher
      state.ts               # Simulation state machine (idle/compiling/running/stopped/error)
    gpio/
      gpio-state.ts          # GPIO state tracker (direction, pin values per port)
      led-panel.ts           # Virtual LED rendering (SVG circles or CSS)
      pin-table.ts           # Pin state table rendering (HTML table)
      button-panel.ts        # Virtual button rendering + click handlers
    controls/
      toolbar.ts             # Run/Stop buttons, speed selector, status indicator
      error-panel.ts         # Compilation error display
  server/                    # Existing Phase 1 backend (modified)
    index.ts                 # Add static file serving for frontend
    ws/
      handler.ts             # Add GPIO input message forwarding to subprocess stdin
    runner/
      process-manager.ts     # Spawn with stdin: "pipe", expose stdin writer
```

### Pattern 1: Vanilla TypeScript Module Architecture
**What:** Each UI concern is a TypeScript module exporting an `init()` function and event handlers. No framework -- just modules that create DOM elements and listen for events.
**When to use:** Every frontend component.
**Example:**
```typescript
// src/client/gpio/led-panel.ts
export interface LedState {
  port: string;
  pin: number;
  active: boolean;
}

const leds = new Map<string, HTMLElement>();

export function init(container: HTMLElement, ledConfigs: Array<{port: string, pin: number}>) {
  for (const {port, pin} of ledConfigs) {
    const el = document.createElement('div');
    el.className = 'led led-off';
    el.dataset.port = port;
    el.dataset.pin = String(pin);
    el.title = `P${port}${pin}`;
    container.appendChild(el);
    leds.set(`${port}:${pin}`, el);
  }
}

export function updateLed(port: string, pin: number, state: number) {
  const el = leds.get(`${port}:${pin}`);
  if (el) {
    el.className = state ? 'led led-on' : 'led led-off';
  }
}
```

### Pattern 2: WebSocket Event Dispatcher
**What:** A thin wrapper around WebSocket that dispatches typed events to registered handlers. Handles connection lifecycle, reconnection, and JSON parsing.
**When to use:** All real-time communication with the simulation backend.
**Example:**
```typescript
// src/client/sim/websocket.ts
type EventHandler = (event: SimulationEvent) => void;

interface SimulationEvent {
  type: string;
  timestamp_ms: number;
  data: Record<string, unknown>;
}

export class SimConnection {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, EventHandler[]>();

  connect(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (msg) => {
      const event: SimulationEvent = JSON.parse(msg.data);
      const handlers = this.handlers.get(event.type) || [];
      for (const h of handlers) h(event);
      // Also dispatch to wildcard handlers
      for (const h of this.handlers.get('*') || []) h(event);
    };
  }

  on(type: string, handler: EventHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  sendGpioInput(port: string, pin: number, state: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'gpio_input',
        port,
        pin,
        state
      }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
```

### Pattern 3: Simulation State Machine
**What:** Finite state machine that tracks the simulation lifecycle (idle -> compiling -> running -> stopped/error). UI components subscribe to state changes.
**When to use:** Managing the run/stop/compile workflow and status indicator.
**Example:**
```typescript
// src/client/sim/state.ts
export type SimStatus = 'idle' | 'compiling' | 'running' | 'stopped' | 'error';

type StatusListener = (status: SimStatus, detail?: string) => void;

let currentStatus: SimStatus = 'idle';
const listeners: StatusListener[] = [];

export function getStatus(): SimStatus { return currentStatus; }

export function setStatus(status: SimStatus, detail?: string) {
  currentStatus = status;
  for (const fn of listeners) fn(status, detail);
}

export function onStatusChange(fn: StatusListener) {
  listeners.push(fn);
}
```

### Pattern 4: stdin-based GPIO Input IPC
**What:** Server writes JSON commands to the simulation subprocess's stdin when it receives `gpio_input` WebSocket messages from the frontend. The C runtime has a non-blocking stdin reader that updates the GPIO IDR register.
**When to use:** Virtual button presses (GPIO-04).

**Server side (TypeScript):**
```typescript
// Modified process-manager.ts -- spawn with stdin: "pipe"
const proc = Bun.spawn([binaryPath], {
  stdout: "pipe",
  stderr: "pipe",
  stdin: "pipe",  // NEW: enable stdin writing
  env: { ...process.env, SIM_SPEED: String(speed) },
});

// To send GPIO input:
export function sendGpioInput(simId: string, port: string, pin: number, state: number) {
  const sim = simulationStore.get(simId);
  if (!sim) return;
  const cmd = JSON.stringify({ type: "gpio_input", port, pin, state }) + "\n";
  sim.process.stdin.write(cmd);
  sim.process.stdin.flush();
}
```

**C side (sim_runtime.c addition):**
```c
#include <poll.h>
#include <unistd.h>
#include <string.h>

// Called periodically (e.g., before each HAL_GPIO_ReadPin or during HAL_Delay)
void sim_check_stdin(void) {
    struct pollfd pfd = { .fd = STDIN_FILENO, .events = POLLIN };
    while (poll(&pfd, 1, 0) > 0) {  // 0ms timeout = non-blocking
        char buf[256];
        ssize_t n = read(STDIN_FILENO, buf, sizeof(buf) - 1);
        if (n <= 0) break;
        buf[n] = '\0';
        // Parse JSON: {"type":"gpio_input","port":"A","pin":0,"state":1}
        // Update the appropriate GPIOx->IDR register
        sim_process_input(buf);
    }
}
```

### Pattern 5: File Upload via HTML Input
**What:** Standard HTML file input element with FileReader API to read .c/.h files into the editor.
**When to use:** EDIT-02 file upload feature.
**Example:**
```typescript
// src/client/editor/editor.ts
function setupFileUpload(view: EditorView) {
  const input = document.getElementById('file-upload') as HTMLInputElement;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text }
    });
    input.value = ''; // Reset for re-upload of same file
  });
}
```

### Anti-Patterns to Avoid
- **Using a UI framework for this scope:** React/Vue adds build complexity, bundle size, and conceptual overhead (components, hooks, state management) for an app with ~5 interactive elements. Vanilla TS is faster to build and easier to debug.
- **Polling the backend for state:** Use WebSocket events, not repeated GET requests. The backend already pushes events in real-time.
- **Putting GPIO state in the DOM:** Maintain a TypeScript state object for GPIO (port/pin -> direction/value). The DOM is the view, not the model. Update DOM from state changes, not vice versa.
- **Trying to make CodeMirror reactive:** CodeMirror 6 manages its own state. Don't try to synchronize it with a framework's reactivity system. Use `view.state.doc.toString()` to read content, `view.dispatch()` to write.
- **Rebuilding the subprocess IPC for each button press:** Keep the stdin pipe open for the lifetime of the simulation. Write individual JSON lines to it, don't restart anything.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code editor with syntax highlighting | Textarea with regex-based highlighting | CodeMirror 6 + @codemirror/lang-cpp | Handles cursor, selection, undo/redo, accessibility, performance on large files |
| C/C++ parser for syntax highlighting | Custom tokenizer | @codemirror/lang-cpp (Lezer parser) | Complete C++ grammar including preprocessor directives, handles edge cases |
| Frontend bundling | Manual script concatenation or Webpack config | `bun build ./index.html` | Zero-config, handles TS, CSS, tree-shaking, minification |
| WebSocket reconnection logic | Custom exponential backoff | Simple reconnect-on-close with 1s delay | For a demo, simple reconnect is sufficient; production would use a library |
| LED visualization | Canvas-based graphics | CSS with border-radius: 50% and background-color/box-shadow | Pure CSS LEDs are simpler, performant, and easy to style |
| Pin state table | Custom grid layout | HTML `<table>` element | Tables are semantically correct for tabular data, accessible by default |

**Key insight:** This phase's frontend is a tool, not a content app. The complexity is in wiring up the editor, API, WebSocket, and GPIO visualization -- not in UI component management. A framework would add overhead without simplifying the actual work.

## Common Pitfalls

### Pitfall 1: WebSocket Connects Before Simulation Starts Broadcasting
**What goes wrong:** The frontend connects to the WebSocket immediately after POST /api/run returns, but the C subprocess's `sim_start` event was emitted before the WebSocket subscription happened (due to the constructor attribute running before any client connects).
**Why it happens:** The `__attribute__((constructor))` in sim_main.c fires before the Bun server can set up the stdout reader and publisher. By the time the WebSocket client subscribes, `sim_start` has already been published to zero subscribers.
**How to avoid:** This is already documented from Phase 1 testing. The frontend should not rely on receiving `sim_start`. Instead, set the UI to "running" state immediately when the `/api/run` response arrives. Use `gpio_init` and `gpio_write` events as the first meaningful data events.
**Warning signs:** Status indicator stays on "waiting" forever even though the simulation is running.

### Pitfall 2: GPIO State Not Reset Between Simulation Runs
**What goes wrong:** LEDs from a previous simulation run stay lit when starting a new simulation.
**Why it happens:** The frontend GPIO state map was not cleared when starting a new run.
**How to avoid:** Reset all GPIO state (LED panel, pin table, state map) when the user clicks "Run" or when a new simulation starts. The WebSocket `gpio_init` events from the new simulation will re-establish the correct state.
**Warning signs:** LEDs from blink sample stay on after switching to knight-rider sample.

### Pitfall 3: stdin Pipe Closes Unexpectedly
**What goes wrong:** Writing to subprocess stdin throws an error because the process has already exited.
**Why it happens:** The simulation process exits (timeout, normal exit, crash) but the server tries to write GPIO input afterward.
**How to avoid:** Check if the simulation is still in the store before writing to stdin. Wrap stdin writes in try/catch. The `stopSimulation` function should call `proc.stdin.end()` before killing the process.
**Warning signs:** Unhandled promise rejection errors in server logs when clicking buttons after simulation ends.

### Pitfall 4: CodeMirror Bundle Size Bloat
**What goes wrong:** The frontend bundle is 500KB+ because all of CodeMirror's features are included.
**Why it happens:** Importing from `codemirror` (the meta-package) pulls in `basicSetup` which includes many extensions (search, autocomplete, lint, etc.).
**How to avoid:** Use `minimalSetup` from `codemirror` instead of `basicSetup` if bundle size is a concern. Or import specific extensions from individual packages. For a demo, `basicSetup` is fine -- it provides a complete editor experience in ~200KB gzipped.
**Warning signs:** Page load takes noticeably long on slow connections.

### Pitfall 5: File Upload Replaces Editor Without Confirmation
**What goes wrong:** User accidentally uploads a file, losing their current work with no way to undo.
**Why it happens:** The file upload handler replaces editor content immediately.
**How to avoid:** Either: (a) confirm before replacing if editor has been modified, or (b) support undo so the user can Ctrl+Z to recover. CodeMirror 6's history extension (included in basicSetup) handles undo, so replacing content via `dispatch()` is undoable by default.
**Warning signs:** User frustration reports.

### Pitfall 6: Non-Blocking stdin Read in C Misses Data
**What goes wrong:** GPIO input events are lost because the stdin check happens at the wrong time.
**Why it happens:** `sim_check_stdin()` is only called during `HAL_Delay()`, but if the firmware's main loop doesn't call `HAL_Delay()`, stdin is never checked.
**How to avoid:** Call `sim_check_stdin()` from both `HAL_Delay()` and `HAL_GPIO_ReadPin()`. This ensures stdin is polled whenever the firmware tries to read a pin (which is the exact moment it needs the latest input state). Also call it periodically in `HAL_Delay()` during the sleep loop rather than only once at the start.
**Warning signs:** Button presses in the UI have no effect on the simulation.

## Code Examples

### CodeMirror 6 Setup for C Editing
```typescript
// Source: CodeMirror official docs + @codemirror/lang-cpp npm page
import { EditorView, basicSetup } from 'codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';

const defaultCode = `#include "stm32f4xx_hal.h"

int main(void) {
  HAL_Init();
  // Your code here
  while (1) {
    HAL_Delay(1000);
  }
}
`;

const state = EditorState.create({
  doc: defaultCode,
  extensions: [
    basicSetup,
    cpp(),
    oneDark,
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
    }),
  ],
});

const view = new EditorView({
  state,
  parent: document.getElementById('editor-container')!,
});

// Read current editor content
function getCode(): string {
  return view.state.doc.toString();
}

// Replace editor content (e.g., loading a sample)
function setCode(code: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: code },
  });
}
```

### REST API Client
```typescript
// Source: Phase 1 API documented in 01-03-SUMMARY.md
const API_BASE = ''; // Same origin -- no CORS needed when served from same Bun server

export async function compile(code: string) {
  const res = await fetch(`${API_BASE}/api/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export async function run(compilationId: string, speed = 1.0) {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ compilationId, speed }),
  });
  return res.json();
}

export async function stop(simulationId: string) {
  const res = await fetch(`${API_BASE}/api/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulationId }),
  });
  return res.json();
}

export async function listSamples() {
  const res = await fetch(`${API_BASE}/api/samples`);
  return res.json();
}

export async function getSample(name: string) {
  const res = await fetch(`${API_BASE}/api/samples/${name}`);
  return res.json();
}
```

### Virtual LED CSS
```css
/* Pure CSS virtual LEDs -- no images or canvas needed */
.led {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-block;
  margin: 4px;
  transition: background-color 0.1s, box-shadow 0.1s;
}

.led-off {
  background-color: #333;
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.5);
}

.led-on {
  background-color: #00ff00;
  box-shadow: 0 0 8px #00ff00, 0 0 16px rgba(0, 255, 0, 0.3);
}

/* Different colors for different ports */
.led[data-port="B"].led-on { background-color: #ff4444; box-shadow: 0 0 8px #ff4444; }
.led[data-port="C"].led-on { background-color: #4488ff; box-shadow: 0 0 8px #4488ff; }
```

### GPIO State Tracking
```typescript
// Source: Event format from Phase 1 hal_gpio.c and stdout-parser.ts
interface PinState {
  port: string;
  pin: number;
  direction: 'input' | 'output' | 'unknown';
  mode: string;
  value: number; // 0 or 1
}

export class GpioState {
  private pins = new Map<string, PinState>();

  private key(port: string, pin: number): string {
    return `${port}:${pin}`;
  }

  handleGpioInit(data: { port: string; pins: number[]; mode: string }) {
    const direction = data.mode === 'input' ? 'input' : 'output';
    for (const pin of data.pins) {
      this.pins.set(this.key(data.port, pin), {
        port: data.port,
        pin,
        direction,
        mode: data.mode,
        value: 0,
      });
    }
  }

  handleGpioWrite(data: { port: string; pin: number; state: number }) {
    const existing = this.pins.get(this.key(data.port, data.pin));
    if (existing) {
      existing.value = data.state;
    } else {
      this.pins.set(this.key(data.port, data.pin), {
        port: data.port,
        pin: data.pin,
        direction: 'output',
        mode: 'unknown',
        value: data.state,
      });
    }
  }

  getAllPins(): PinState[] {
    return Array.from(this.pins.values()).sort(
      (a, b) => a.port.localeCompare(b.port) || a.pin - b.pin
    );
  }

  getPin(port: string, pin: number): PinState | undefined {
    return this.pins.get(this.key(port, pin));
  }

  reset() {
    this.pins.clear();
  }
}
```

### Non-Blocking stdin Reader (C side)
```c
// Source: POSIX poll() API for non-blocking stdin
#include <poll.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>

// Buffer for accumulating stdin data across calls
static char stdin_buf[1024];
static int stdin_buf_pos = 0;

void sim_check_stdin(void) {
    struct pollfd pfd = { .fd = STDIN_FILENO, .events = POLLIN };

    // Check stdin without blocking (timeout = 0)
    while (poll(&pfd, 1, 0) > 0 && (pfd.revents & POLLIN)) {
        ssize_t n = read(STDIN_FILENO, stdin_buf + stdin_buf_pos,
                         sizeof(stdin_buf) - stdin_buf_pos - 1);
        if (n <= 0) break;
        stdin_buf_pos += n;
        stdin_buf[stdin_buf_pos] = '\0';

        // Process complete lines (newline-delimited JSON)
        char *line_start = stdin_buf;
        char *newline;
        while ((newline = strchr(line_start, '\n')) != NULL) {
            *newline = '\0';
            if (strlen(line_start) > 0) {
                sim_process_input(line_start);
            }
            line_start = newline + 1;
        }

        // Move remaining partial data to start of buffer
        int remaining = stdin_buf_pos - (line_start - stdin_buf);
        if (remaining > 0) {
            memmove(stdin_buf, line_start, remaining);
        }
        stdin_buf_pos = remaining;
    }
}

// Parse input JSON and update GPIO IDR
static void sim_process_input(const char *json) {
    // Simple parsing for: {"type":"gpio_input","port":"A","pin":0,"state":1}
    // Extract port letter, pin number, and state
    char port = '?';
    int pin = -1, state = -1;

    const char *p = strstr(json, "\"port\":\"");
    if (p) port = p[8];

    p = strstr(json, "\"pin\":");
    if (p) pin = atoi(p + 6);

    p = strstr(json, "\"state\":");
    if (p) state = atoi(p + 8);

    if (port >= 'A' && port <= 'E' && pin >= 0 && pin < 16 && state >= 0) {
        GPIO_TypeDef *gpio = NULL;
        switch (port) {
            case 'A': gpio = GPIOA; break;
            case 'B': gpio = GPIOB; break;
            case 'C': gpio = GPIOC; break;
            case 'D': gpio = GPIOD; break;
            case 'E': gpio = GPIOE; break;
        }
        if (gpio) {
            if (state) {
                gpio->IDR |= (1 << pin);
            } else {
                gpio->IDR &= ~(1 << pin);
            }
        }
    }
}
```

### Bun Static File Serving (Server Modification)
```typescript
// Added to src/server/index.ts -- serve frontend static files
// In the fetch handler, after API routes:

// Serve frontend static files
const STATIC_DIR = join(process.cwd(), 'dist');  // or 'src/client' in dev
const filePath = join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
const file = Bun.file(filePath);
if (await file.exists()) {
  return new Response(file);
}

// Fallback to index.html for SPA (though not needed -- this is a single page)
return new Response(Bun.file(join(STATIC_DIR, 'index.html')));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CodeMirror 5 (monolithic) | CodeMirror 6 (modular, extensible) | 2022 | Tree-shakeable, better performance, TypeScript-native |
| Webpack/Vite for frontend builds | Bun built-in bundler (`bun build ./index.html`) | Bun 1.2+ (2025) | Zero-config, no devDependencies for bundling |
| React/Vue for every web app | Vanilla TS for tool UIs | Ongoing trend | Reduced complexity, faster load, no framework lock-in |
| Custom WebSocket libraries | Native WebSocket API | Always available | Browser built-in, no library needed |
| jQuery DOM manipulation | Native DOM APIs | 2020+ | `querySelector`, `classList`, `dataset`, `createElement` cover everything |

**Deprecated/outdated:**
- CodeMirror 5 is legacy -- use CodeMirror 6 for all new projects
- `codemirror` npm meta-package v6.0.2 bundles stable versions of all core packages; use it for simplicity

## Open Questions

1. **Frontend Build Strategy: Bun HTML Bundler vs Pre-built**
   - What we know: Bun 1.3.10 supports `bun build ./index.html --outdir=dist` for production builds and `bun ./index.html` for dev server. The server can serve the built files from a `dist/` directory.
   - What's unclear: Whether to use Bun's dev server (`bun ./index.html`) running on a separate port during development, or to build the frontend into `dist/` and serve from the existing Bun.serve() server.
   - Recommendation: Build frontend into `dist/` directory and serve from the existing Bun.serve() server on the same port. This avoids CORS complications and matches how the app will work in production. Add a `bun run build:client` script. For development iteration, rebuild on change with `bun build --watch`.

2. **Virtual Button Configuration**
   - What we know: The button-led sample uses PA0 as input. The knight-rider sample has no inputs. The blink sample has no inputs.
   - What's unclear: Should the button panel be pre-configured with specific pins, or should it auto-detect input pins from `gpio_init` events?
   - Recommendation: Auto-detect from `gpio_init` events. When a `gpio_init` event arrives with `mode: "input"`, automatically create a virtual button for that pin in the button panel. This is more flexible and works with any user code, not just the samples.

3. **Layout Design**
   - What we know: The UI needs: editor (large), LED panel, pin table, button panel, error panel, toolbar.
   - What's unclear: Exact layout proportions and responsive behavior.
   - Recommendation: CSS Grid with a fixed layout: editor on the left (60-70% width), visualization panels stacked on the right (30-40%). Toolbar at top. Error panel below editor. Not responsive (desktop-only demo).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test runner (built-in, `bun test`) |
| Config file | `bunfig.toml` (existing, `root = "./tests"`) |
| Quick run command | `bun test` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | Editor loads with C syntax highlighting | manual | Browser visual check | N/A (manual) |
| EDIT-02 | File upload loads content into editor | manual | Browser visual check | N/A (manual) |
| EDIT-03 | Sample loading populates editor | integration | `bun test tests/simulation-run.test.ts` (API already tested) | Existing (API) |
| GPIO-01 | GPIO read returns updated IDR from stdin input | integration | `bun test tests/gpio-input.test.ts -x` | Wave 0 |
| GPIO-02 | gpio_write events arrive via WebSocket | integration | `bun test tests/ws-stream.test.ts` | Existing |
| GPIO-03 | Pin state table renders correctly | manual | Browser visual check | N/A (manual) |
| GPIO-04 | gpio_input WebSocket message updates subprocess IDR | integration | `bun test tests/gpio-input.test.ts -x` | Wave 0 |
| CTRL-01 | Run/stop controls work via API | integration | `bun test tests/simulation-run.test.ts` | Existing |
| CTRL-02 | Status indicator reflects simulation state | manual | Browser visual check | N/A (manual) |
| CTRL-03 | Speed parameter accepted by run API | integration | `bun test tests/simulation-run.test.ts` | Existing |

### Sampling Rate
- **Per task commit:** `bun test`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green + manual browser verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/gpio-input.test.ts` -- covers GPIO-01, GPIO-04: test stdin-based input injection and ReadPin response
- [ ] Frontend build script in package.json: `"build:client": "bun build src/client/index.html --outdir=dist"`
- [ ] Manual test checklist for browser-based requirements (EDIT-01, EDIT-02, GPIO-02, GPIO-03, CTRL-02)

*(Most existing Phase 1 tests already cover the API layer. New automated tests focus on the GPIO input injection mechanism. Frontend UI is verified manually.)*

## Sources

### Primary (HIGH confidence)
- [CodeMirror official site](https://codemirror.net/) -- Editor architecture, setup guide, extension system
- [@codemirror/lang-cpp npm](https://www.npmjs.com/package/@codemirror/lang-cpp) -- Version 6.0.3, C/C++ language support
- [@codemirror/theme-one-dark npm](https://www.npmjs.com/package/@codemirror/theme-one-dark) -- Version 6.1.3, One Dark theme
- [Bun child process docs](https://bun.com/docs/runtime/child-process) -- Bun.spawn() stdin: "pipe" API, FileSink write/flush/end
- [Bun HTML bundler docs](https://bun.com/docs/bundler/html-static) -- `bun build ./index.html`, zero-config frontend bundling
- Phase 1 codebase (src/server/) -- Existing API endpoints, WebSocket handler, event format, GPIO HAL stubs

### Secondary (MEDIUM confidence)
- [CodeMirror 6 setup guides](https://davidmyers.dev/blog/how-to-build-a-code-editor-with-codemirror-6-and-typescript/introduction) -- Step-by-step TypeScript integration
- POSIX `poll()` for non-blocking stdin -- standard C API, well-documented in man pages

### Tertiary (LOW confidence)
- stdin-based GPIO IPC design -- novel design combining Bun stdin pipe with C poll() for this specific use case; needs validation with a working prototype

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- CodeMirror 6 and Bun bundler are well-documented, versions verified on npm
- Architecture: HIGH -- Vanilla TS + CodeMirror is a proven pattern; WebSocket event dispatch is straightforward
- GPIO input IPC: MEDIUM -- stdin pipe + poll() is standard POSIX, but the specific integration (JSON over stdin to update IDR) is custom design needing validation
- Pitfalls: HIGH -- based on Phase 1 experience (WebSocket timing, process lifecycle) and standard frontend pitfalls

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain, 30-day validity)
