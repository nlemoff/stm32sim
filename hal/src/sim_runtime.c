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
#include "stm32f4xx_hal_gpio.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#include <time.h>
#include <poll.h>
#include <unistd.h>

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

/**
 * Process a single JSON input command.
 * Expected format: {"type":"gpio_input","port":"A","pin":0,"state":1}
 * Uses simple strstr-based parsing (no JSON library needed).
 */
static void sim_process_input(const char *json) {
    /* Only handle gpio_input messages */
    if (!strstr(json, "gpio_input")) return;

    /* Parse port: look for "port":"X" */
    const char *port_key = strstr(json, "\"port\"");
    if (!port_key) return;
    const char *port_quote = strchr(port_key + 6, '"');
    if (!port_quote) return;
    char port_char = port_quote[1];
    if (port_char < 'A' || port_char > 'E') return;

    /* Parse pin: look for "pin": followed by a number */
    const char *pin_key = strstr(json, "\"pin\"");
    if (!pin_key) return;
    const char *pin_colon = strchr(pin_key + 4, ':');
    if (!pin_colon) return;
    int pin = atoi(pin_colon + 1);
    if (pin < 0 || pin > 15) return;

    /* Parse state: look for "state": followed by 0 or 1 */
    const char *state_key = strstr(json, "\"state\"");
    if (!state_key) return;
    const char *state_colon = strchr(state_key + 7, ':');
    if (!state_colon) return;
    int state = atoi(state_colon + 1);
    if (state != 0 && state != 1) return;

    /* Map port letter to GPIO instance */
    GPIO_TypeDef *gpio = NULL;
    switch (port_char) {
        case 'A': gpio = GPIOA; break;
        case 'B': gpio = GPIOB; break;
        case 'C': gpio = GPIOC; break;
        case 'D': gpio = GPIOD; break;
        case 'E': gpio = GPIOE; break;
        default: return;
    }

    /* Update the Input Data Register */
    if (state) {
        gpio->IDR |= (1 << pin);
    } else {
        gpio->IDR &= ~(1 << pin);
    }
}

/* Static buffer for accumulating stdin data */
static char stdin_buf[1024];
static int stdin_buf_len = 0;

void sim_check_stdin(void) {
    struct pollfd pfd;
    pfd.fd = STDIN_FILENO;
    pfd.events = POLLIN;

    /* Non-blocking poll: 0ms timeout */
    while (poll(&pfd, 1, 0) > 0 && (pfd.revents & POLLIN)) {
        /* Read available data */
        int space = (int)sizeof(stdin_buf) - stdin_buf_len - 1;
        if (space <= 0) {
            /* Buffer full with no newline -- discard and reset */
            stdin_buf_len = 0;
            continue;
        }

        ssize_t n = read(STDIN_FILENO, stdin_buf + stdin_buf_len, space);
        if (n <= 0) {
            /* EOF or error -- stdin closed */
            break;
        }
        stdin_buf_len += (int)n;
        stdin_buf[stdin_buf_len] = '\0';

        /* Process complete newline-delimited lines */
        char *line_start = stdin_buf;
        char *newline;
        while ((newline = strchr(line_start, '\n')) != NULL) {
            *newline = '\0';
            if (line_start[0] != '\0') {
                sim_process_input(line_start);
            }
            line_start = newline + 1;
        }

        /* Move any remaining partial line to the start of the buffer */
        int remaining = stdin_buf_len - (int)(line_start - stdin_buf);
        if (remaining > 0 && line_start != stdin_buf) {
            memmove(stdin_buf, line_start, remaining);
        }
        stdin_buf_len = remaining;
    }
}

void sim_cleanup(void) {
    long elapsed = get_elapsed_ms();
    printf("{\"type\":\"sim_exit\",\"timestamp_ms\":%ld,\"data\":{\"reason\":\"normal\"}}\n",
           elapsed);
}
