/**
 * @file stm32f4xx_hal.h
 * @brief STM32F4xx HAL umbrella header
 *
 * This is the main header that user code includes. It brings in
 * all HAL module headers. In STM32CubeIDE projects, user code
 * typically includes only this file:
 *
 *   #include "stm32f4xx_hal.h"
 *
 * This is the simulator equivalent of the real STM32F4 HAL umbrella.
 */
#ifndef __STM32F4xx_HAL_H
#define __STM32F4xx_HAL_H

#include <stdint.h>

/* HAL configuration and common definitions */
#include "stm32f4xx_hal_conf.h"
#include "stm32f4xx_hal_def.h"

/* Peripheral HAL modules */
#include "stm32f4xx_hal_gpio.h"
#include "stm32f4xx_hal_rcc.h"
#include "stm32f4xx_hal_cortex.h"
#include "stm32f4xx_hal_uart.h"
#include "stm32f4xx_hal_spi.h"
#include "stm32f4xx_hal_i2c.h"

/* ---- Core HAL Functions ---- */

/**
 * @brief Initialize the HAL library.
 * On real STM32: configures Flash prefetch, SysTick, NVIC priority grouping.
 * In simulator: initializes the event emission runtime.
 * @return HAL_OK on success
 */
HAL_StatusTypeDef HAL_Init(void);

/**
 * @brief De-initialize the HAL library.
 * @return HAL_OK on success
 */
HAL_StatusTypeDef HAL_DeInit(void);

/**
 * @brief Get the current tick value in milliseconds.
 * On real STM32: reads the SysTick counter.
 * In simulator: uses clock_gettime(CLOCK_MONOTONIC).
 * @return Milliseconds since HAL_Init() was called
 */
uint32_t HAL_GetTick(void);

/**
 * @brief Delay execution for a specified number of milliseconds.
 * On real STM32: busy-waits using SysTick.
 * In simulator: uses usleep with the simulation speed multiplier.
 * @param Delay Number of milliseconds to delay
 */
void HAL_Delay(uint32_t Delay);

/**
 * @brief Configure the system clock.
 * On real STM32: configures PLL, AHB/APB prescalers, Flash latency.
 * In simulator: no-op (no real clock tree to configure).
 */
void SystemClock_Config(void);

#endif /* __STM32F4xx_HAL_H */
