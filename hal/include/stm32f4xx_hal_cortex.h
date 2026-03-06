/**
 * @file stm32f4xx_hal_cortex.h
 * @brief Cortex-M4 HAL module (NVIC, SysTick)
 *
 * On real STM32, these functions configure the ARM Cortex-M4
 * Nested Vectored Interrupt Controller (NVIC) and SysTick timer.
 *
 * In our simulator, interrupts are not modeled, so these are
 * stub prototypes with no-op implementations in hal_system.c.
 */
#ifndef __STM32F4xx_HAL_CORTEX_H
#define __STM32F4xx_HAL_CORTEX_H

#include "stm32f4xx_hal_def.h"

/**
 * @brief Set the priority of an interrupt.
 * @param IRQn Interrupt number
 * @param PreemptPriority Preemption priority (0-15)
 * @param SubPriority Sub-priority (0-15)
 */
void HAL_NVIC_SetPriority(int IRQn, uint32_t PreemptPriority, uint32_t SubPriority);

/**
 * @brief Enable an interrupt in the NVIC.
 * @param IRQn Interrupt number to enable
 */
void HAL_NVIC_EnableIRQ(int IRQn);

/**
 * @brief Disable an interrupt in the NVIC.
 * @param IRQn Interrupt number to disable
 */
void HAL_NVIC_DisableIRQ(int IRQn);

#endif /* __STM32F4xx_HAL_CORTEX_H */
