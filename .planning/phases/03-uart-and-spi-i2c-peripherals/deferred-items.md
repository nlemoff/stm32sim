# Deferred Items - Phase 03

## Pre-existing Test Failure

**File:** `tests/ws-stream.test.ts`
**Issue:** Test suite fails with "beforeEach/afterEach hook timed out" and "SyntaxError: Failed to parse JSON" errors. This failure occurs even in isolation (not caused by parallel test runs).
**Impact:** 4 tests in ws-stream.test.ts are failing. All other 42 tests across 8 files pass.
**Root cause:** Likely a server startup issue on PORT 3002 or a timing problem in the test infrastructure. Not related to Phase 03 changes.
**Discovered during:** Plan 03-03 execution
