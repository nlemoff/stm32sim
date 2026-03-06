# Phase 3: UART and SPI/I2C Peripherals - Research

**Researched:** 2026-03-05
**Domain:** Embedded peripheral simulation (UART serial I/O, SPI/I2C loopback), browser terminal emulation
**Confidence:** HIGH

## Summary

Phase 3 completes the v1 peripheral suite by wiring the existing UART/SPI/I2C HAL stubs (currently no-ops returning HAL_OK) into the simulator's event pipeline and adding a browser-based UART terminal console. The architecture is already well-established from Phases 1-2: C HAL stubs emit line-delimited JSON events to stdout, the Bun process-manager streams them over WebSocket, and the frontend dispatches them to visualization modules. Phase 3 follows this exact pattern for three new event types (`uart_tx`, `spi_transfer`, `i2c_transfer`) and adds one new input channel (`uart_rx` via stdin, alongside the existing `gpio_input`).

The most significant new dependency is **xterm.js** (`@xterm/xterm` v6.0.0) for the UART terminal console. xterm.js is the de facto standard for browser terminal emulation -- it powers VS Code's integrated terminal, GitHub Codespaces, and Hyper. It provides a `Terminal` class with `write()` for output and `onData` for input, fitting perfectly into the existing `SimConnection.on()` event dispatch pattern. The `@xterm/addon-fit` addon handles responsive sizing within the containing element.

**Primary recommendation:** Follow the established event pipeline pattern (C stub emits JSON -> stdout-parser -> WebSocket -> frontend handler). Add xterm.js for the UART console. Use simple stdin-based UART RX input (same mechanism as GPIO input). SPI/I2C loopback is purely C-side: copy TX data to RX buffer and emit a transfer event. No new backend routes or WebSocket message types are needed beyond what exists.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UART-01 | Simulator supports UART transmit -- firmware serial output captured | Wire `HAL_UART_Transmit()` to emit `uart_tx` events via `sim_emit_event()`, following the `gpio_write` pattern in `hal_gpio.c` |
| UART-02 | UART output displayed in an xterm.js terminal console in the UI | Add `@xterm/xterm` + `@xterm/addon-fit` dependency; create terminal panel module; register `conn.on("uart_tx", ...)` handler that calls `terminal.write()` |
| UART-03 | User can type into the UART console and firmware receives the input (bidirectional) | Use `terminal.onData()` to capture keystrokes; send `uart_rx` messages over WebSocket; forward to subprocess stdin (same pattern as `sendGpioInput`); C runtime reads via `sim_check_stdin()` and buffers for `HAL_UART_Receive()` |
| SPII-01 | Simulator supports SPI/I2C loopback -- data sent is echoed back and displayed | In `HAL_SPI_TransmitReceive()` / `HAL_SPI_Transmit()` / `HAL_I2C_Master_Transmit()`, copy TX data to RX buffer (loopback) and emit `spi_transfer` / `i2c_transfer` events |
| SPII-02 | Timestamped bus log shows all SPI/I2C transactions | Create a bus-log panel in the frontend; register `conn.on("spi_transfer", ...)` and `conn.on("i2c_transfer", ...)` handlers that append timestamped rows to a scrollable log |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xterm/xterm | ^6.0.0 | Terminal emulator for UART console | De facto standard browser terminal (VS Code, Codespaces). Provides `write()` for output, `onData` for input capture |
| @xterm/addon-fit | ^0.11.0 | Auto-size terminal to container | Required for responsive layout; handles cols/rows calculation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xterm/addon-web-links | ^0.12.0 | Clickable URLs in terminal output | Optional nice-to-have; skip for v1 to keep scope minimal |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| xterm.js | Custom `<pre>` element | Would miss cursor handling, ANSI codes, scroll behavior, input handling. Not worth building. |
| xterm.js attach addon | Manual WebSocket wiring | Attach addon assumes a raw PTY stream. Our protocol is JSON events, so manual wiring via `onData`/`write()` is the correct approach. Do NOT use `@xterm/addon-attach`. |

**Installation:**
```bash
bun add @xterm/xterm @xterm/addon-fit
```

## Architecture Patterns

### Recommended Project Structure
```
hal/src/
  hal_uart.c          # MODIFIED: Wire UART TX/RX to event pipeline
  hal_spi.c           # MODIFIED: Wire SPI loopback to event pipeline
  hal_i2c.c           # MODIFIED: Wire I2C loopback to event pipeline
  sim_runtime.c       # MODIFIED: Add uart_rx handling in sim_process_input / sim_check_stdin

src/server/ws/
  handler.ts          # MODIFIED: Handle "uart_rx" messages (like gpio_input)

src/client/
  uart/
    uart-terminal.ts  # NEW: xterm.js terminal init, write, input capture
  bus/
    bus-log.ts         # NEW: SPI/I2C timestamped transaction log panel
  index.ts            # MODIFIED: Add uart/bus event handlers, init panels
  index.html          # MODIFIED: Add terminal and bus-log container divs
  style.css           # MODIFIED: Add terminal and bus-log styles

src/client/sim/
  websocket.ts        # MODIFIED: Add sendUartInput() method

samples/
  uart-hello/main.c   # NEW: UART hello world sample
  spi-loopback/main.c # NEW: SPI loopback sample
```

### Pattern 1: Event Emission from C Stubs (Established Pattern)
**What:** Each HAL function that produces observable output calls `sim_emit_event()` with a JSON data payload.
**When to use:** Every UART transmit, SPI transfer, I2C transfer.
**Example:**
```c
// In hal_uart.c - following exact pattern from hal_gpio.c
HAL_StatusTypeDef HAL_UART_Transmit(UART_HandleTypeDef *huart,
    const uint8_t *pData, uint16_t Size, uint32_t Timeout) {
    (void)huart; (void)Timeout;

    // Emit each byte as a character (or the whole buffer as hex)
    // For UART console display, emit the raw string
    // Need to escape JSON special chars
    char escaped[512];
    int pos = 0;
    for (uint16_t i = 0; i < Size && pos < (int)sizeof(escaped) - 6; i++) {
        uint8_t ch = pData[i];
        if (ch == '"') { escaped[pos++] = '\\'; escaped[pos++] = '"'; }
        else if (ch == '\\') { escaped[pos++] = '\\'; escaped[pos++] = '\\'; }
        else if (ch == '\n') { escaped[pos++] = '\\'; escaped[pos++] = 'n'; }
        else if (ch == '\r') { escaped[pos++] = '\\'; escaped[pos++] = 'r'; }
        else if (ch == '\t') { escaped[pos++] = '\\'; escaped[pos++] = 't'; }
        else if (ch >= 0x20 && ch < 0x7F) { escaped[pos++] = (char)ch; }
        else { pos += snprintf(escaped + pos, 6, "\\u%04x", ch); }
    }
    escaped[pos] = '\0';

    sim_emit_event("uart_tx",
        "{\"data\":\"%s\",\"size\":%u}", escaped, (unsigned)Size);
    return HAL_OK;
}
```

### Pattern 2: UART RX via stdin (Extending Existing Input Channel)
**What:** UART receive data flows from browser -> WebSocket -> server -> subprocess stdin -> C runtime buffer -> HAL_UART_Receive reads from buffer.
**When to use:** Bidirectional UART communication (UART-03).
**Example:**
```c
// In sim_runtime.c - extend sim_process_input to handle uart_rx
// Add a ring buffer for UART RX data
static uint8_t uart_rx_buf[256];
static volatile int uart_rx_head = 0;
static volatile int uart_rx_tail = 0;

static void sim_process_input(const char *json) {
    if (strstr(json, "gpio_input")) {
        // ... existing GPIO input handling ...
    }
    else if (strstr(json, "uart_rx")) {
        // Parse the data field and push bytes into ring buffer
        const char *data_key = strstr(json, "\"data\"");
        if (!data_key) return;
        const char *data_quote = strchr(data_key + 6, '"');
        if (!data_quote) return;
        data_quote++; // skip opening quote
        while (*data_quote && *data_quote != '"') {
            int next = (uart_rx_head + 1) % sizeof(uart_rx_buf);
            if (next == uart_rx_tail) break; // buffer full
            uart_rx_buf[uart_rx_head] = (uint8_t)*data_quote;
            uart_rx_head = next;
            data_quote++;
        }
    }
}
```

### Pattern 3: SPI/I2C Loopback (Simplest Possible Simulation)
**What:** Copy transmitted data directly into the receive buffer and emit a transfer event.
**When to use:** SPI/I2C simulation where no actual device is modeled.
**Example:**
```c
// In hal_spi.c
HAL_StatusTypeDef HAL_SPI_TransmitReceive(SPI_HandleTypeDef *hspi,
    const uint8_t *pTxData, uint8_t *pRxData,
    uint16_t Size, uint32_t Timeout) {
    (void)hspi; (void)Timeout;

    // Loopback: copy TX to RX
    for (uint16_t i = 0; i < Size; i++) {
        pRxData[i] = pTxData[i];
    }

    // Build hex string for the event
    char hex_buf[512];
    int pos = 0;
    for (uint16_t i = 0; i < Size && pos < (int)sizeof(hex_buf) - 3; i++) {
        pos += snprintf(hex_buf + pos, 4, "%02X ", pTxData[i]);
    }
    if (pos > 0) hex_buf[pos - 1] = '\0'; // trim trailing space

    sim_emit_event("spi_transfer",
        "{\"direction\":\"txrx\",\"size\":%u,\"data\":\"%s\"}",
        (unsigned)Size, hex_buf);

    return HAL_OK;
}
```

### Pattern 4: Frontend Event Dispatch (Established Pattern)
**What:** Register `conn.on("event_type", handler)` in index.ts, handler updates the appropriate UI module.
**When to use:** Every new event type.
**Example:**
```typescript
// In index.ts - following established pattern from GPIO handlers
import { initUartTerminal, writeToTerminal, clearTerminal } from "./uart/uart-terminal";
import { initBusLog, appendBusEntry, clearBusLog } from "./bus/bus-log";

// Initialize panels
initUartTerminal(
  document.getElementById("uart-terminal")!,
  (data: string) => conn.sendUartInput(data) // keyboard input callback
);
initBusLog(document.getElementById("bus-log")!);

// UART TX event -> write to terminal
conn.on("uart_tx", (event) => {
  const data = event.data as { data: string; size: number };
  writeToTerminal(data.data);
});

// SPI/I2C transfer events -> append to bus log
conn.on("spi_transfer", (event) => {
  appendBusEntry("SPI", event.timestamp_ms, event.data);
});
conn.on("i2c_transfer", (event) => {
  appendBusEntry("I2C", event.timestamp_ms, event.data);
});
```

### Anti-Patterns to Avoid
- **Using @xterm/addon-attach:** Our protocol is JSON events over WebSocket, not raw PTY data. The attach addon expects binary stream data and would not work with our JSON event protocol.
- **Separate WebSocket for UART:** Reuse the existing simulation WebSocket. Adding a second connection would complicate lifecycle management (connect/disconnect/cleanup).
- **Polling-based UART receive:** The existing `sim_check_stdin()` with `poll()` is already called from `HAL_Delay()` and `HAL_GPIO_ReadPin()`. Also call it from `HAL_UART_Receive()` so UART input is processed before attempting to read.
- **Binary data in JSON events:** Keep all event data as text/hex strings in JSON. Binary data in JSON is fragile and requires base64 encoding overhead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal emulation | Custom `<pre>` + keyboard handler | @xterm/xterm | Cursor positioning, scrollback, ANSI sequences, copy/paste, accessibility, screen reader support -- all solved |
| Terminal sizing | Manual cols/rows calculation | @xterm/addon-fit | Measures container, accounts for font metrics, handles resize events |
| JSON escaping in C | Manual character-by-character | Minimal escape function | Only need to handle `"`, `\`, `\n`, `\r`, `\t` and non-printable chars. A small helper function is sufficient -- no JSON library needed in C |
| Ring buffer in C | Complex circular buffer library | Simple array with head/tail indices | UART RX buffer is tiny (256 bytes), single-producer single-consumer. A 15-line ring buffer is appropriate. |

**Key insight:** The hard UI work (terminal emulation) is solved by xterm.js. The hard backend work (event pipeline, stdin/stdout protocol, WebSocket) is already built. Phase 3 is mostly wiring -- connecting stubs to the existing infrastructure.

## Common Pitfalls

### Pitfall 1: JSON String Escaping in C
**What goes wrong:** UART data containing `"`, `\`, newlines, or non-ASCII bytes breaks JSON parsing when emitted via `printf` in `sim_emit_event()`.
**Why it happens:** `sim_emit_event()` uses `vprintf` to format the data payload. If UART data contains raw `"` characters, the JSON becomes invalid.
**How to avoid:** Escape all special JSON characters before embedding in the event string. Build a small `json_escape()` helper that handles `"`, `\`, `\n`, `\r`, `\t`, and non-printable bytes (as `\uXXXX`).
**Warning signs:** WebSocket messages fail to parse on the frontend, "SyntaxError: Unexpected token" in console.

### Pitfall 2: xterm.js CSS Not Loaded
**What goes wrong:** Terminal renders but looks broken -- no background, wrong font, missing cursor.
**Why it happens:** xterm.js requires its CSS file (`@xterm/xterm/css/xterm.css`) to be loaded. With Bun's HTML bundler, CSS imports may need explicit handling.
**How to avoid:** Import the CSS explicitly: `import '@xterm/xterm/css/xterm.css'` in the terminal module. Verify Bun's bundler handles CSS imports from node_modules (it does since Bun 1.1+). Alternatively, copy the CSS to src/client/ if bundler issues arise.
**Warning signs:** Terminal element exists but has no visible background or cursor.

### Pitfall 3: Terminal Not Fitting Container
**What goes wrong:** Terminal has a fixed default size (80x24) and doesn't fill its container or overflows.
**Why it happens:** FitAddon needs to be called after the terminal is opened and the container has dimensions.
**How to avoid:** Call `fitAddon.fit()` after `terminal.open(container)` and on window resize. Use `ResizeObserver` on the container for robust sizing.
**Warning signs:** Terminal appears tiny or has horizontal scrollbar.

### Pitfall 4: UART Receive Blocking
**What goes wrong:** `HAL_UART_Receive()` in real STM32 is blocking -- it waits until `Size` bytes are received or `Timeout` expires. In the simulator, if we make it truly blocking, the firmware loop stalls.
**Why it happens:** Real UART has hardware FIFO and DMA. Our simulator runs in a single thread with `poll()`.
**How to avoid:** Implement `HAL_UART_Receive()` to poll stdin in a loop (like `HAL_Delay` does) with timeout support. Check the ring buffer each iteration. Return `HAL_TIMEOUT` if not enough bytes arrive within the timeout period. Call `sim_check_stdin()` in the polling loop.
**Warning signs:** Firmware hangs when calling `HAL_UART_Receive()`, no events emitted during receive.

### Pitfall 5: Clear-on-Run for New Panels
**What goes wrong:** UART terminal and bus log retain content from the previous simulation run, confusing the user.
**Why it happens:** Phase 2 established a "clear-on-run" pattern for GPIO panels but new panels might be forgotten.
**How to avoid:** Follow the established pattern in `toolbar.ts` run handler: call `clearTerminal()` and `clearBusLog()` alongside existing `clearLeds()`, `clearPinTable()`, `clearButtons()`.
**Warning signs:** Old UART output mixed with new simulation output after clicking Run.

### Pitfall 6: convertEol Option in xterm.js
**What goes wrong:** Firmware sends `\n` line endings but terminal doesn't advance to the start of the next line.
**Why it happens:** xterm.js by default treats `\n` as "move down one line" (LF) without carriage return (CR). Real terminals expect `\r\n` for a proper newline.
**How to avoid:** Set `convertEol: true` in the Terminal constructor options. This converts `\n` to `\r\n` automatically.
**Warning signs:** Text appears as a staircase pattern in the terminal.

## Code Examples

### xterm.js Terminal Module
```typescript
// src/client/uart/uart-terminal.ts
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;

export function initUartTerminal(
  container: HTMLElement,
  onInput: (data: string) => void
): void {
  terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,       // CRITICAL: convert \n to \r\n
    fontSize: 14,
    fontFamily: '"Cascadia Code", "Fira Code", monospace',
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      cursor: "#d4d4d4",
    },
    disableStdin: false,     // Allow user input
    scrollback: 1000,
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  terminal.open(container);
  fitAddon.fit();

  // Capture user input and forward to simulation
  terminal.onData((data) => {
    onInput(data);
    // Echo input locally (firmware may or may not echo)
    // Don't echo here -- let firmware echo via HAL_UART_Transmit if it wants
  });

  // Re-fit on window resize
  const resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit();
  });
  resizeObserver.observe(container);
}

export function writeToTerminal(data: string): void {
  terminal?.write(data);
}

export function clearTerminal(): void {
  terminal?.clear();
  terminal?.reset();
}
```

### WebSocket Handler Extension for UART RX
```typescript
// In ws/handler.ts - extend message handler
message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
  try {
    const msg = typeof message === "string"
      ? JSON.parse(message)
      : JSON.parse(message.toString());

    if (msg.type === "gpio_input") {
      // ... existing GPIO input handling ...
    }
    else if (msg.type === "uart_rx") {
      // Forward UART input to subprocess stdin
      sendUartInput(ws.data.simulationId, msg.data);
    }
  } catch {
    // Ignore invalid messages
  }
}
```

### SimConnection Extension
```typescript
// Add to SimConnection class in websocket.ts
sendUartInput(data: string): void {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({ type: "uart_rx", data }));
  }
}
```

### Bus Log Panel
```typescript
// src/client/bus/bus-log.ts
let logContainer: HTMLElement | null = null;

export function initBusLog(container: HTMLElement): void {
  logContainer = container;
  // Add table header
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Time</th><th>Bus</th><th>Dir</th><th>Size</th><th>Data</th></tr>
    </thead>
    <tbody id="bus-log-body"></tbody>
  `;
  container.appendChild(table);
}

export function appendBusEntry(
  bus: "SPI" | "I2C",
  timestamp_ms: number,
  data: Record<string, unknown>
): void {
  const tbody = document.getElementById("bus-log-body");
  if (!tbody) return;

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${timestamp_ms}ms</td>
    <td>${bus}</td>
    <td>${data.direction || "tx"}</td>
    <td>${data.size || "?"}</td>
    <td class="bus-data">${data.data || ""}</td>
  `;
  tbody.appendChild(row);

  // Auto-scroll to bottom
  const scrollParent = tbody.closest(".bus-log-scroll");
  if (scrollParent) scrollParent.scrollTop = scrollParent.scrollHeight;
}

export function clearBusLog(): void {
  const tbody = document.getElementById("bus-log-body");
  if (tbody) tbody.innerHTML = "";
}
```

### UART Hello World Sample
```c
// samples/uart-hello/main.c
/**
 * UART Hello World
 *
 * Sends "Hello from STM32!" over UART1, then echoes back any
 * characters received. This demonstrates basic serial communication.
 */
#include "stm32f4xx_hal.h"

void SystemClock_Config(void);
static void MX_USART1_UART_Init(void);

UART_HandleTypeDef huart1;

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_USART1_UART_Init();

    const char *msg = "Hello from STM32!\r\n";
    HAL_UART_Transmit(&huart1, (uint8_t *)msg, strlen(msg), 1000);

    uint8_t rx_byte;
    while (1) {
        if (HAL_UART_Receive(&huart1, &rx_byte, 1, 100) == HAL_OK) {
            // Echo received byte back
            HAL_UART_Transmit(&huart1, &rx_byte, 1, 100);
        }
        HAL_Delay(10);
    }
}

static void MX_USART1_UART_Init(void) {
    huart1.Instance = USART1;
    huart1.Init.BaudRate = 115200;
    huart1.Init.WordLength = UART_WORDLENGTH_8B;
    huart1.Init.StopBits = UART_STOPBITS_1;
    huart1.Init.Parity = UART_PARITY_NONE;
    huart1.Init.Mode = UART_MODE_TX_RX;
    huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    huart1.Init.OverSampling = UART_OVERSAMPLING_16;
    HAL_UART_Init(&huart1);
}
```

### SPI Loopback Sample
```c
// samples/spi-loopback/main.c
/**
 * SPI Loopback Test
 *
 * Sends data over SPI1 and receives it back (loopback mode).
 * Demonstrates SPI initialization and data transfer.
 */
#include "stm32f4xx_hal.h"
#include <string.h>

void SystemClock_Config(void);
static void MX_SPI1_Init(void);

SPI_HandleTypeDef hspi1;

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_SPI1_Init();

    uint8_t tx_data[] = {0xDE, 0xAD, 0xBE, 0xEF};
    uint8_t rx_data[4] = {0};

    while (1) {
        HAL_SPI_TransmitReceive(&hspi1, tx_data, rx_data, 4, 1000);
        HAL_Delay(1000);
    }
}

static void MX_SPI1_Init(void) {
    hspi1.Instance = SPI1;
    hspi1.Init.Mode = 0;           // SPI_MODE_MASTER
    hspi1.Init.Direction = 0;      // SPI_DIRECTION_2LINES
    hspi1.Init.DataSize = 0;       // SPI_DATASIZE_8BIT
    hspi1.Init.CLKPolarity = 0;    // SPI_POLARITY_LOW
    hspi1.Init.CLKPhase = 0;       // SPI_CPOL_1EDGE
    hspi1.Init.NSS = 0;            // SPI_NSS_SOFT
    hspi1.Init.BaudRatePrescaler = 0;
    hspi1.Init.FirstBit = 0;       // SPI_FIRSTBIT_MSB
    HAL_SPI_Init(&hspi1);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `xterm` (npm) v5.x | `@xterm/xterm` v6.x (scoped packages) | 2024 | Must use `@xterm/` scoped packages; old `xterm` package is deprecated |
| xterm addons as separate unscoped packages | `@xterm/addon-fit`, `@xterm/addon-web-links`, etc. | 2024 | All addons moved to `@xterm/` scope |

**Deprecated/outdated:**
- `xterm` npm package (v5.3.0): Use `@xterm/xterm` instead
- `xterm-addon-fit`: Use `@xterm/addon-fit` instead
- `@xterm/addon-attach` for this use case: Our JSON event protocol is not compatible with the raw PTY stream that attach expects

## Open Questions

1. **UART echo behavior**
   - What we know: Real STM32 UART does not auto-echo. If the firmware wants to echo, it calls `HAL_UART_Transmit()` with the received byte.
   - What's unclear: Should we echo keystrokes immediately in the terminal for responsiveness, or wait for firmware echo?
   - Recommendation: Do NOT echo locally. Let firmware echo via `HAL_UART_Transmit()`. This is how real serial terminals work. The slight latency from round-trip through subprocess is negligible at 100x speed.

2. **`string.h` include for UART sample**
   - What we know: The UART hello world sample uses `strlen()` which needs `<string.h>`.
   - What's unclear: Is `string.h` already available in the compilation environment?
   - Recommendation: Include `<string.h>` in the sample. Standard C library headers work fine with host gcc. Already used in `sim_runtime.c`.

3. **Bun bundler CSS handling for node_modules**
   - What we know: Bun HTML bundler handles CSS imports. xterm.js requires its CSS.
   - What's unclear: Whether `import '@xterm/xterm/css/xterm.css'` works seamlessly with Bun's bundler when the CSS is in node_modules.
   - Recommendation: Test during implementation. Fallback: copy xterm.css to src/client/ and import locally.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun:test (built-in) |
| Config file | none -- Bun auto-discovers tests/*.test.ts |
| Quick run command | `bun test tests/uart-transmit.test.ts` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UART-01 | HAL_UART_Transmit emits uart_tx event | integration | `bun test tests/uart-transmit.test.ts -x` | Wave 0 |
| UART-02 | uart_tx event received over WebSocket | integration | `bun test tests/uart-ws.test.ts -x` | Wave 0 |
| UART-03 | UART RX round-trip (send via WS, firmware receives, echoes back) | integration | `bun test tests/uart-rx.test.ts -x` | Wave 0 |
| SPII-01 | SPI/I2C loopback emits transfer events | integration | `bun test tests/spi-i2c-loopback.test.ts -x` | Wave 0 |
| SPII-02 | Transfer events contain timestamp and data | integration | `bun test tests/spi-i2c-loopback.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test tests/uart-transmit.test.ts tests/spi-i2c-loopback.test.ts -x`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/uart-transmit.test.ts` -- covers UART-01 (compile uart-hello sample, verify uart_tx events in stdout)
- [ ] `tests/uart-ws.test.ts` -- covers UART-02 (end-to-end WS streaming of uart_tx events)
- [ ] `tests/uart-rx.test.ts` -- covers UART-03 (send uart_rx via WS, verify echo comes back as uart_tx)
- [ ] `tests/spi-i2c-loopback.test.ts` -- covers SPII-01, SPII-02 (compile spi-loopback sample, verify spi_transfer events)
- [ ] `samples/uart-hello/main.c` -- UART hello world sample needed for tests
- [ ] `samples/spi-loopback/main.c` -- SPI loopback sample needed for tests

## Sources

### Primary (HIGH confidence)
- Project codebase: hal_gpio.c, sim_runtime.c, stdout-parser.ts, ws/handler.ts, process-manager.ts -- established event pipeline pattern
- [xtermjs.org Terminal API docs](https://xtermjs.org/docs/api/terminal/classes/terminal/) -- Terminal class methods and options
- [xterm.js GitHub repository](https://github.com/xtermjs/xterm.js/) -- source code and typings (xterm.d.ts)

### Secondary (MEDIUM confidence)
- [@xterm/xterm npm](https://www.npmjs.com/@xterm/xterm) -- confirmed v6.0.0 as latest, scoped package naming
- [xterm.js official site](https://xtermjs.org/) -- addon documentation and usage guides

### Tertiary (LOW confidence)
- None -- all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- xterm.js is the clear and only reasonable choice; version verified on npm
- Architecture: HIGH -- following established patterns from Phase 1-2, all infrastructure already built
- Pitfalls: HIGH -- based on direct code analysis and common xterm.js usage issues documented in official resources

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- xterm.js is mature, project patterns are locked)
