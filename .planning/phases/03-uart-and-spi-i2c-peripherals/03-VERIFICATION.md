---
phase: 03-uart-and-spi-i2c-peripherals
verified: 2026-03-06T08:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "UART terminal visual rendering"
    expected: "Dark background, blinking cursor, monospace font in xterm.js terminal"
    why_human: "Visual rendering quality cannot be verified programmatically"
  - test: "UART bidirectional input in browser"
    expected: "Type characters in the terminal; firmware echoes them back and they appear on screen"
    why_human: "Requires real browser interaction with xterm.js keyboard events"
  - test: "SPI bus log visual layout"
    expected: "Timestamped rows with Time, Bus, Dir, Size, Data columns; auto-scroll; sticky headers"
    why_human: "Table rendering and scroll behavior need visual inspection"
  - test: "Clear-on-run behavior"
    expected: "Clicking Run clears terminal and bus log from previous session"
    why_human: "UI state reset requires interactive testing"
  - test: "Responsive terminal resizing"
    expected: "Resizing the browser window causes the xterm.js terminal to refit its container"
    why_human: "ResizeObserver + FitAddon interaction requires live browser testing"
---

# Phase 3: UART and SPI/I2C Peripherals Verification Report

**Phase Goal:** Users can observe UART serial output in a terminal console, send input to the firmware via the console, and see SPI/I2C loopback transactions logged -- completing the v1 peripheral suite
**Verified:** 2026-03-06T08:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | HAL_UART_Transmit emits uart_tx JSON events with properly escaped data | VERIFIED | hal/src/hal_uart.c lines 27-49: builds escaped string, calls sim_emit_event("uart_tx", ...). Confirmed by running uart-hello sample which outputs `{"type":"uart_tx","data":{"data":"Hello from STM32!\r\n","size":19}}` |
| 2 | HAL_UART_Receive reads from ring buffer with timeout support | VERIFIED | hal/src/hal_uart.c lines 52-80: polls sim_uart_rx_pop() in a loop, calls sim_check_stdin() each iteration, returns HAL_TIMEOUT when elapsed >= Timeout |
| 3 | HAL_SPI_TransmitReceive copies TX to RX and emits spi_transfer event | VERIFIED | hal/src/hal_spi.c lines 67-92: copies pTxData to pRxData (loopback), builds hex string, emits spi_transfer with direction "txrx". Confirmed by running spi-loopback sample which outputs `{"type":"spi_transfer","data":{"direction":"txrx","size":4,"data":"DE AD BE EF"}}` |
| 4 | HAL_I2C_Master_Transmit emits i2c_transfer event with address and data | VERIFIED | hal/src/hal_i2c.c lines 23-42: builds hex string, emits i2c_transfer with direction "tx", address "0xNN", size, and data fields |
| 5 | WebSocket uart_rx messages are forwarded to subprocess stdin | VERIFIED | src/server/ws/handler.ts lines 92-98: validates msg.data is non-empty string, calls sendUartInput(). src/server/runner/process-manager.ts lines 169-184: sendUartInput() writes JSON to stdin pipe with flush |
| 6 | UART output appears in xterm.js terminal console | VERIFIED | src/client/index.ts lines 91-94: conn.on("uart_tx") calls writeToTerminal(data.data). src/client/uart/uart-terminal.ts line 60: writeToTerminal() calls terminal.write(data) |
| 7 | User keystrokes are sent to firmware via WebSocket | VERIFIED | src/client/uart/uart-terminal.ts line 45-47: terminal.onData() calls onInput callback. src/client/index.ts lines 43-44: onInput calls conn.sendUartInput(data). src/client/sim/websocket.ts lines 82-86: sendUartInput() sends JSON {type:"uart_rx",data} over WS |
| 8 | SPI/I2C transfer events appear in bus log panel | VERIFIED | src/client/index.ts lines 97-104: conn.on("spi_transfer") and conn.on("i2c_transfer") call appendBusEntry(). src/client/bus/bus-log.ts lines 38-58: appendBusEntry() creates table row with timestamp, bus, direction, size, data |
| 9 | Terminal and bus log clear on new simulation run | VERIFIED | src/client/controls/toolbar.ts lines 14-15: imports clearTerminal, clearBusLog. Lines 86-87: calls both in run handler alongside clearErrors/clearLeds/clearPinTable/clearButtons |
| 10 | Terminal fits container and resizes responsively | VERIFIED | src/client/uart/uart-terminal.ts lines 37-38: FitAddon loaded, line 41: fitAddon.fit() called after open. Lines 50-53: ResizeObserver on container calls fitAddon.fit() on resize |
| 11 | uart-hello sample compiles and emits uart_tx events | VERIFIED | Compiled with gcc and ran: outputs `{"type":"uart_tx","data":{"data":"Hello from STM32!\r\n","size":19}}` |
| 12 | spi-loopback sample compiles and emits spi_transfer events | VERIFIED | Compiled with gcc and ran: outputs `{"type":"spi_transfer","data":{"direction":"txrx","size":4,"data":"DE AD BE EF"}}` |
| 13 | Integration tests pass for UART TX/RX and SPI loopback | VERIFIED | 42 tests pass across 9 files (1 pre-existing failure in ws-stream.test.ts unrelated to Phase 3). tests/uart-transmit.test.ts (3 tests) and tests/spi-i2c-loopback.test.ts (2 tests) all pass |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hal/src/hal_uart.c` | UART TX event emission and RX ring buffer read | VERIFIED | 81 lines, calls sim_emit_event("uart_tx",...), reads from sim_uart_rx_pop() with timeout |
| `hal/src/hal_spi.c` | SPI loopback and spi_transfer event emission | VERIFIED | 93 lines, loopback copy, hex encoding, sim_emit_event("spi_transfer",...) |
| `hal/src/hal_i2c.c` | I2C i2c_transfer event emission | VERIFIED | 69 lines, hex encoding, sim_emit_event("i2c_transfer",...) with address |
| `hal/src/sim_runtime.c` | uart_rx handling and ring buffer | VERIFIED | 240 lines, ring buffer push/pop/available at lines 78-104, uart_rx parsing in sim_process_input at lines 158-185 |
| `hal/src/sim_runtime.h` | UART RX ring buffer declarations | VERIFIED | 93 lines, declares sim_uart_rx_push/pop/available with proper stdint.h include |
| `src/server/ws/handler.ts` | uart_rx WebSocket message forwarding | VERIFIED | 133 lines, imports sendUartInput, validates and forwards uart_rx messages at lines 92-98 |
| `src/server/runner/process-manager.ts` | sendUartInput function | VERIFIED | 219 lines, sendUartInput at lines 169-184 writes JSON to stdin pipe |
| `samples/uart-hello/main.c` | UART hello world sample | VERIFIED | 44 lines, uses HAL_UART_Transmit for greeting, HAL_UART_Receive for echo loop |
| `samples/spi-loopback/main.c` | SPI loopback sample | VERIFIED | 41 lines, uses HAL_SPI_TransmitReceive with {0xDE,0xAD,0xBE,0xEF} in a loop |
| `src/client/uart/uart-terminal.ts` | xterm.js terminal with init/write/clear | VERIFIED | 69 lines (>= 30 min), exports initUartTerminal, writeToTerminal, clearTerminal |
| `src/client/bus/bus-log.ts` | Bus log panel with init/append/clear | VERIFIED | 67 lines (>= 20 min), exports initBusLog, appendBusEntry, clearBusLog |
| `src/client/sim/websocket.ts` | sendUartInput method on SimConnection | VERIFIED | 103 lines, sendUartInput at lines 82-86 sends JSON over WS |
| `src/client/index.html` | Container divs for uart-terminal and bus-log | VERIFIED | 64 lines, bottom-panels section with #uart-terminal and #bus-log divs |
| `src/client/index.ts` | Event wiring for uart_tx, spi_transfer, i2c_transfer | VERIFIED | 145 lines, handlers at lines 91-104 dispatch to writeToTerminal and appendBusEntry |
| `src/client/controls/toolbar.ts` | clearTerminal and clearBusLog in run handler | VERIFIED | 195 lines, imports at lines 14-15, calls at lines 86-87 |
| `src/client/style.css` | Grid layout with bottom panels | VERIFIED | 370 lines, bottom-panels at lines 296-304 with grid layout, uart-panel and bus-log-panel styles |
| `tests/uart-transmit.test.ts` | UART TX/RX integration tests | VERIFIED | 247 lines (>= 40 min), 3 tests covering TX emission, RX echo round-trip, invalid input robustness |
| `tests/spi-i2c-loopback.test.ts` | SPI loopback integration tests | VERIFIED | 193 lines (>= 30 min), 2 tests covering spi_transfer events and timestamp ordering |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| hal/src/hal_uart.c | hal/src/sim_runtime.h | sim_emit_event("uart_tx",...) | WIRED | Line 47: `sim_emit_event("uart_tx", ...)` present |
| hal/src/sim_runtime.c | hal/src/hal_uart.c | uart_rx ring buffer consumed by HAL_UART_Receive | WIRED | sim_runtime.c:82 pushes to uart_rx_buf; hal_uart.c:64 calls sim_uart_rx_pop() |
| src/server/ws/handler.ts | src/server/runner/process-manager.ts | sendUartInput call on uart_rx message | WIRED | handler.ts:15 imports sendUartInput, line 97 calls sendUartInput() |
| src/client/index.ts | src/client/uart/uart-terminal.ts | writeToTerminal in uart_tx handler | WIRED | index.ts:18 imports writeToTerminal, line 93 calls writeToTerminal(data.data) |
| src/client/index.ts | src/client/bus/bus-log.ts | appendBusEntry in spi_transfer/i2c_transfer handlers | WIRED | index.ts:19 imports appendBusEntry, lines 98+103 call appendBusEntry() |
| src/client/uart/uart-terminal.ts | src/client/sim/websocket.ts | onInput callback calls conn.sendUartInput | WIRED | uart-terminal.ts:45-47 calls onInput(data); index.ts:44 passes `(data) => conn.sendUartInput(data)` as callback |
| src/client/controls/toolbar.ts | src/client/uart/uart-terminal.ts | clearTerminal in run handler | WIRED | toolbar.ts:14 imports clearTerminal, line 86 calls clearTerminal() |
| tests/uart-transmit.test.ts | samples/uart-hello/main.c | Compiles and runs via API | WIRED | test line 53: readFileSync("samples/uart-hello/main.c"), line 57: POST to /api/compile |
| tests/spi-i2c-loopback.test.ts | samples/spi-loopback/main.c | Compiles and runs via API | WIRED | test line 53: readFileSync("samples/spi-loopback/main.c"), line 57: POST to /api/compile |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UART-01 | 03-01, 03-03 | Simulator supports UART transmit -- firmware serial output captured | SATISFIED | HAL_UART_Transmit emits uart_tx events; uart-hello sample confirmed to produce them; integration test verifies events arrive over WebSocket |
| UART-02 | 03-02, 03-03 | UART output displayed in an xterm.js terminal console in the UI | SATISFIED | xterm.js terminal initialized in uart-terminal.ts; uart_tx events wired to writeToTerminal() in index.ts; @xterm/xterm dependency installed; frontend builds; human verified |
| UART-03 | 03-01, 03-02, 03-03 | User can type into the UART console and firmware receives the input (bidirectional) | SATISFIED | terminal.onData -> conn.sendUartInput -> WS -> handler.ts -> sendUartInput -> stdin -> sim_process_input -> ring buffer -> HAL_UART_Receive. Full pipeline verified: integration test sends uart_rx "A" and receives echoed uart_tx "A" |
| SPII-01 | 03-01, 03-03 | Simulator supports SPI/I2C loopback -- data sent is echoed back and displayed | SATISFIED | HAL_SPI_TransmitReceive copies TX to RX (loopback) and emits spi_transfer; spi-loopback sample produces "DE AD BE EF"; integration test verifies; bus log displays in UI |
| SPII-02 | 03-02, 03-03 | Timestamped bus log shows all SPI/I2C transactions | SATISFIED | bus-log.ts creates table with Time/Bus/Dir/Size/Data columns; appendBusEntry formats timestamp as "Nms"; integration test verifies timestamp_ms is present and monotonically increasing |

No orphaned requirements found. All 5 requirement IDs declared across plans (03-01: UART-01, UART-03, SPII-01; 03-02: UART-02, UART-03, SPII-02; 03-03: all 5) are accounted for in REQUIREMENTS.md and mapped to Phase 3.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns found in any of the 18 phase artifacts |

All files scanned for: TODO/FIXME/HACK/PLACEHOLDER comments, placeholder text, empty return values, console.log-only implementations. Zero matches across all artifacts.

### Human Verification Required

These items were reportedly human-verified during Plan 03-03 execution (per SUMMARY), but are listed here as they cannot be confirmed programmatically:

### 1. UART Terminal Rendering

**Test:** Open browser, select "UART Hello World" sample, click Run
**Expected:** xterm.js terminal displays "Hello from STM32!" with dark background, blinking cursor, monospace font
**Why human:** Visual rendering quality of xterm.js cannot be verified via grep

### 2. Bidirectional UART Input

**Test:** With uart-hello running, click inside terminal and type characters
**Expected:** Typed characters appear in terminal (firmware echoes them back via HAL_UART_Transmit)
**Why human:** Requires real browser interaction with keyboard events and xterm.js focus

### 3. SPI Bus Log Display

**Test:** Select "SPI Loopback Test" sample, click Run
**Expected:** Bus Log panel shows rows with timestamps, "SPI" bus label, "DE AD BE EF" data; new rows appear periodically
**Why human:** Table rendering, auto-scroll behavior, and periodic updates need visual inspection

### 4. Clear-on-Run

**Test:** Run SPI sample, then switch to UART sample and click Run again
**Expected:** Bus log clears, terminal clears, fresh output appears
**Why human:** UI state reset across panels requires interactive testing

### 5. Responsive Layout

**Test:** Resize browser window
**Expected:** Terminal refits its container; layout maintains editor (top-left), GPIO viz (top-right), UART terminal (bottom-left), bus log (bottom-right)
**Why human:** ResizeObserver + FitAddon + CSS grid interaction requires live browser testing

### Test Suite Status

- **Total tests:** 43 across 9 files
- **Passing:** 42
- **Failing:** 1 (pre-existing `tests/ws-stream.test.ts` -- "beforeEach/afterEach hook timed out", unrelated to Phase 3, documented in deferred-items.md)
- **Phase 3 tests:** 5 tests in 2 files (uart-transmit.test.ts: 3, spi-i2c-loopback.test.ts: 2) -- all pass

### Compilation Verification

- `samples/uart-hello/main.c`: Compiles cleanly, emits uart_tx events
- `samples/spi-loopback/main.c`: Compiles cleanly, emits spi_transfer events
- `samples/blink/main.c`: Still compiles and runs correctly (no regression)
- Frontend bundle builds successfully (0.87 MB JS + 8.11 KB CSS)

### Gaps Summary

No gaps found. All 13 observable truths verified. All 18 artifacts exist, are substantive, and are properly wired. All 9 key links confirmed. All 5 requirements satisfied. Zero anti-patterns detected. Human verification was reportedly completed during Plan 03-03 execution.

---

_Verified: 2026-03-06T08:30:00Z_
_Verifier: Claude (gsd-verifier)_
