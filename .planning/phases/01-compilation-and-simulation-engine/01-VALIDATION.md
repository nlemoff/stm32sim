---
phase: 1
slug: compilation-and-simulation-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test runner (built-in, `bun test`) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `bun test --filter "phase1"` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test --filter "phase1"`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | COMP-01 | integration | `bun test tests/compile.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | COMP-01 | unit | `bun test tests/error-parser.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | COMP-01 | integration | `bun test tests/hal-compile.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | COMP-02 | integration | `bun test tests/simulation-run.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | COMP-02 | integration | `bun test tests/ws-stream.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | COMP-02 | unit | `bun test tests/process-manager.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | COMP-03 | unit | `bun test tests/error-parser.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | COMP-03 | unit | `bun test tests/error-parser.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 1 | COMP-03 | unit | `bun test tests/error-parser.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/compile.test.ts` — covers COMP-01 compilation flow
- [ ] `tests/error-parser.test.ts` — covers COMP-01, COMP-03 error parsing
- [ ] `tests/hal-compile.test.ts` — covers COMP-01 HAL stub compilation
- [ ] `tests/simulation-run.test.ts` — covers COMP-02 execution and stdout streaming
- [ ] `tests/ws-stream.test.ts` — covers COMP-02 WebSocket broadcasting
- [ ] `tests/process-manager.test.ts` — covers COMP-02 timeout and cleanup
- [ ] Bun test runner setup: `bunfig.toml` with test configuration

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WebSocket real-time latency | COMP-02 | Timing-sensitive, hard to assert precisely | Connect wscat, run blink sample, verify events arrive within ~100ms |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
