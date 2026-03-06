/**
 * @file hal_system.c
 * @brief Core HAL system functions
 *
 * Implements HAL_Init, HAL_DeInit, HAL_GetTick, HAL_Delay,
 * SystemClock_Config, and NVIC stub functions.
 *
 * HAL_Delay uses usleep with the simulation speed multiplier,
 * so delays run faster when SIM_SPEED > 1.0.
 */
#include "stm32f4xx_hal.h"
#include "sim_runtime.h"
#include <time.h>
#include <unistd.h>

/* Tick start time -- recorded when HAL_Init is called */
static struct timespec tick_start;
static int hal_initialized = 0;

HAL_StatusTypeDef HAL_Init(void) {
    /* Record start time for HAL_GetTick */
    clock_gettime(CLOCK_MONOTONIC, &tick_start);
    hal_initialized = 1;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_DeInit(void) {
    hal_initialized = 0;
    return HAL_OK;
}

uint32_t HAL_GetTick(void) {
    if (!hal_initialized) return 0;

    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    long sec_diff = now.tv_sec - tick_start.tv_sec;
    long nsec_diff = now.tv_nsec - tick_start.tv_nsec;
    return (uint32_t)(sec_diff * 1000 + nsec_diff / 1000000);
}

void HAL_Delay(uint32_t Delay) {
    /* Apply speed multiplier: SIM_SPEED=2.0 makes delays 2x shorter */
    uint32_t actual_ms = (uint32_t)(Delay / sim_speed_multiplier);

    sim_emit_event("delay",
        "{\"requested_ms\":%u,\"actual_ms\":%u}",
        Delay, actual_ms);

    /* usleep takes microseconds */
    usleep(actual_ms * 1000);
}

void SystemClock_Config(void) {
    /* No-op in simulator.
       On real STM32, this configures the PLL, AHB/APB prescalers,
       and Flash latency. Our simulator doesn't model the clock tree. */
}

/* ---- NVIC Stubs (from hal_cortex.h) ---- */
/* Interrupts are not modeled in the simulator. */

void HAL_NVIC_SetPriority(int IRQn, uint32_t PreemptPriority, uint32_t SubPriority) {
    (void)IRQn;
    (void)PreemptPriority;
    (void)SubPriority;
}

void HAL_NVIC_EnableIRQ(int IRQn) {
    (void)IRQn;
}

void HAL_NVIC_DisableIRQ(int IRQn) {
    (void)IRQn;
}
