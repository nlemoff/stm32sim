/**
 * @file sim_main.c
 * @brief Simulation startup and shutdown glue
 *
 * Uses GCC constructor/destructor attributes to automatically
 * initialize the simulation runtime before main() runs and
 * clean up after main() returns. This way, user firmware code
 * can have a normal main() function just like on real hardware.
 *
 * Constructor runs before main() -> calls sim_init()
 * Destructor runs after main() returns -> calls sim_cleanup()
 */
#include "sim_runtime.h"

/**
 * @brief Automatic initialization before main().
 *
 * GCC's __attribute__((constructor)) causes this function to run
 * before main() is called. This sets up unbuffered stdout, reads
 * SIM_SPEED, and emits the sim_start event.
 */
__attribute__((constructor))
static void sim_startup(void) {
    sim_init();
}

/**
 * @brief Automatic cleanup after main() returns.
 *
 * GCC's __attribute__((destructor)) causes this function to run
 * after main() returns (or exit() is called). This emits the
 * sim_exit event.
 */
__attribute__((destructor))
static void sim_shutdown(void) {
    sim_cleanup();
}
