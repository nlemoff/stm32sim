---
phase: 2
slug: frontend-and-gpio-end-to-end
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test runner (built-in, `bun test`) |
| **Config file** | `bunfig.toml` (existing, `root = "./tests"`) |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | GPIO-01, GPIO-04 | integration | `bun test tests/gpio-input.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | EDIT-01 | manual | Browser visual check | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | EDIT-02 | manual | Browser visual check | N/A | ⬜ pending |
| 02-01-04 | 01 | 1 | EDIT-03 | integration | `bun test tests/simulation-run.test.ts` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 1 | GPIO-02 | integration | `bun test tests/ws-stream.test.ts` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 1 | GPIO-03 | manual | Browser visual check | N/A | ⬜ pending |
| 02-02-03 | 02 | 1 | GPIO-04 | integration | `bun test tests/gpio-input.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | CTRL-01 | integration | `bun test tests/simulation-run.test.ts` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 1 | CTRL-02 | manual | Browser visual check | N/A | ⬜ pending |
| 02-03-03 | 03 | 1 | CTRL-03 | integration | `bun test tests/simulation-run.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/gpio-input.test.ts` — stubs for GPIO-01, GPIO-04: test stdin-based input injection and ReadPin response
- [ ] Frontend build script: `"build:client": "bun build src/client/index.html --outdir=dist"`
- [ ] Manual test checklist for browser-based requirements (EDIT-01, EDIT-02, GPIO-02, GPIO-03, CTRL-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Editor loads with C syntax highlighting | EDIT-01 | Visual UI rendering | Open browser, verify CodeMirror shows colored C syntax |
| File upload loads content into editor | EDIT-02 | File input requires browser interaction | Click upload, select .c file, verify content appears in editor |
| Pin state table renders correctly | GPIO-03 | Visual table rendering | Run sample, verify table shows pin directions and values |
| Status indicator reflects simulation state | CTRL-02 | Visual UI state | Start/stop simulation, verify status badge updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
