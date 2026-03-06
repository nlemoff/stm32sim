# Deferred Items - Phase 02

## Pre-existing Test Failures

### hal-compile.test.ts JSON parse error
- **Source:** Plan 02-01 commit 589cbf9 (stdin reader changes to sim_runtime.c)
- **Issue:** Binary stdout may contain non-JSON data after sim_runtime.c was modified to include stdin polling. The hal-compile test expects all stdout lines to be valid JSON but the stdin reader may output partial/malformed data when process is killed mid-stream.
- **Impact:** 1 test failure in "blink binary stdout contains gpio_write events"
- **Fix needed:** Either filter out non-JSON lines in the test, or ensure sim_runtime.c's stdin reader does not output anything to stdout.
