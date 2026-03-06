/**
 * @file sim_runtime.h
 * @brief Simulation runtime -- JSON event emission and timing
 *
 * Provides the core infrastructure that HAL stubs use to emit
 * simulation events as line-delimited JSON to stdout. The parent
 * process (Bun server) reads these lines and broadcasts them
 * over WebSocket.
 */
#ifndef __SIM_RUNTIME_H
#define __SIM_RUNTIME_H

/**
 * Simulation speed multiplier.
 * 1.0 = real time, 2.0 = 2x faster, 0.5 = half speed.
 * Read from SIM_SPEED environment variable at init.
 * HAL_Delay divides the requested delay by this value.
 */
extern double sim_speed_multiplier;

/**
 * @brief Initialize the simulation runtime.
 * - Disables stdout buffering (critical for real-time event streaming)
 * - Reads SIM_SPEED environment variable
 * - Records the start time for relative timestamps
 * - Emits the sim_start event
 */
void sim_init(void);

/**
 * @brief Emit a JSON event to stdout.
 *
 * Outputs a single line of JSON:
 * {"type":"<type>","timestamp_ms":<ms>,"data":{<data_fmt>}}
 *
 * @param type   Event type string (e.g., "gpio_write", "delay")
 * @param data_fmt  printf-style format string for the data JSON object
 * @param ...    Arguments for data_fmt
 */
void sim_emit_event(const char *type, const char *data_fmt, ...);

/**
 * @brief Check stdin for GPIO input commands (non-blocking).
 *
 * Uses poll() with 0ms timeout to check if stdin has data.
 * Reads and processes complete newline-delimited JSON lines.
 * Each line should be: {"type":"gpio_input","port":"A","pin":0,"state":1}
 *
 * Updates the appropriate GPIOx->IDR register so that
 * HAL_GPIO_ReadPin() returns the new value immediately.
 *
 * Called from HAL_GPIO_ReadPin() and HAL_Delay() to ensure
 * input is never missed.
 */
void sim_check_stdin(void);

/**
 * @brief Clean up the simulation runtime.
 * Emits a sim_exit event.
 */
void sim_cleanup(void);

#endif /* __SIM_RUNTIME_H */
