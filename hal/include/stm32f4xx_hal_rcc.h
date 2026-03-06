/**
 * @file stm32f4xx_hal_rcc.h
 * @brief RCC (Reset and Clock Control) HAL module
 *
 * On real STM32, the RCC module controls which peripheral clocks
 * are enabled. You must enable a GPIO port's clock before using it.
 *
 * In our simulator, these are no-op macros -- the simulated GPIO
 * ports are always available. But user code must still call them
 * to look like authentic STM32CubeIDE output.
 */
#ifndef __STM32F4xx_HAL_RCC_H
#define __STM32F4xx_HAL_RCC_H

#include "stm32f4xx_hal_def.h"

/* ---- GPIO Port Clock Enable Macros ---- */
/* On real hardware: enables the AHB1 clock for the GPIO port.
   In simulator: no-op (ports are always accessible). */
#define __HAL_RCC_GPIOA_CLK_ENABLE()   ((void)0)
#define __HAL_RCC_GPIOB_CLK_ENABLE()   ((void)0)
#define __HAL_RCC_GPIOC_CLK_ENABLE()   ((void)0)
#define __HAL_RCC_GPIOD_CLK_ENABLE()   ((void)0)
#define __HAL_RCC_GPIOE_CLK_ENABLE()   ((void)0)

/* ---- Peripheral Clock Enable Macros ---- */
/* Same pattern: no-ops in the simulator. */
#define __HAL_RCC_USART1_CLK_ENABLE()  ((void)0)
#define __HAL_RCC_USART2_CLK_ENABLE()  ((void)0)
#define __HAL_RCC_SPI1_CLK_ENABLE()    ((void)0)
#define __HAL_RCC_I2C1_CLK_ENABLE()    ((void)0)

#endif /* __STM32F4xx_HAL_RCC_H */
