/**
 * @file sim_runtime.c
 * @brief Simulation runtime -- JSON event emission and timing
 *
 * This is the heart of the simulator's output system. Every HAL stub
 * calls sim_emit_event() to produce line-delimited JSON on stdout.
 * The parent Bun process reads these lines and broadcasts them
 * to connected WebSocket clients.
 *
 * CRITICAL: stdout buffering is disabled at init. Without this,
 * events would be block-buffered (4KB) when piped, causing them
 * to arrive in delayed batches instead of real-time.
 */
#include "sim_runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <time.h>

/* Speed multiplier: 1.0 = real time */
double sim_speed_multiplier = 1.0;

/* Start time for relative timestamps */
static struct timespec start_time;

/**
 * Get milliseconds elapsed since sim_init() was called.
 */
static long get_elapsed_ms(void) {
    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    long sec_diff = now.tv_sec - start_time.tv_sec;
    long nsec_diff = now.tv_nsec - start_time.tv_nsec;
    return sec_diff * 1000 + nsec_diff / 1000000;
}

void sim_init(void) {
    /* CRITICAL: Disable stdout buffering so events reach the parent
       process immediately. Without this, events are block-buffered
       (4096 bytes) when stdout is piped, causing delayed delivery. */
    setvbuf(stdout, NULL, _IONBF, 0);

    /* Read simulation speed from environment variable */
    const char *speed_env = getenv("SIM_SPEED");
    if (speed_env) {
        double speed = atof(speed_env);
        if (speed > 0.0) {
            sim_speed_multiplier = speed;
        }
    }

    /* Record start time for relative timestamps */
    clock_gettime(CLOCK_MONOTONIC, &start_time);

    /* Emit the first event -- sim_start */
    printf("{\"type\":\"sim_start\",\"timestamp_ms\":0,\"data\":{\"speed\":%.1f}}\n",
           sim_speed_multiplier);
}

void sim_emit_event(const char *type, const char *data_fmt, ...) {
    long elapsed = get_elapsed_ms();

    printf("{\"type\":\"%s\",\"timestamp_ms\":%ld,\"data\":", type, elapsed);

    va_list args;
    va_start(args, data_fmt);
    vprintf(data_fmt, args);
    va_end(args);

    printf("}\n");
}

void sim_cleanup(void) {
    long elapsed = get_elapsed_ms();
    printf("{\"type\":\"sim_exit\",\"timestamp_ms\":%ld,\"data\":{\"reason\":\"normal\"}}\n",
           elapsed);
}
