---
phase: 3
slug: uart-and-spi-i2c-peripherals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test (built-in) |
| **Config file** | none — Bun auto-discovers tests/*.test.ts |
| **Quick run command** | `bun test tests/uart-transmit.test.ts tests/spi-i2c-loopback.test.ts -x` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/uart-transmit.test.ts tests/spi-i2c-loopback.test.ts -x`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UART-01 | integration | `bun test tests/uart-transmit.test.ts -x` | W0 | pending |
| 03-01-02 | 01 | 1 | UART-02 | integration | `bun test tests/uart-ws.test.ts -x` | W0 | pending |
| 03-01-03 | 01 | 1 | UART-03 | integration | `bun test tests/uart-rx.test.ts -x` | W0 | pending |
| 03-02-01 | 02 | 1 | SPII-01 | integration | `bun test tests/spi-i2c-loopback.test.ts -x` | W0 | pending |
| 03-02-02 | 02 | 1 | SPII-02 | integration | `bun test tests/spi-i2c-loopback.test.ts -x` | W0 | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `tests/uart-transmit.test.ts` — covers UART-01 (compile uart-hello sample, verify uart_tx events in stdout)
- [ ] `tests/uart-ws.test.ts` — covers UART-02 (end-to-end WS streaming of uart_tx events)
- [ ] `tests/uart-rx.test.ts` — covers UART-03 (send uart_rx via WS, verify echo comes back as uart_tx)
- [ ] `tests/spi-i2c-loopback.test.ts` — covers SPII-01, SPII-02 (compile spi-loopback sample, verify spi_transfer events)
- [ ] `samples/uart-hello/main.c` — UART hello world sample needed for tests
- [ ] `samples/spi-loopback/main.c` — SPI loopback sample needed for tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| xterm.js terminal renders correctly with proper styling | UART-02 | Visual rendering verification | Open UI, run uart-hello sample, verify terminal has dark background, blinking cursor, proper font |
| Terminal auto-fits container on resize | UART-02 | Layout/resize behavior | Resize browser window, verify terminal adjusts columns/rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
