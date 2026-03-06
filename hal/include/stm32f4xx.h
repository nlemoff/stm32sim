/**
 * @file stm32f4xx.h
 * @brief Top-level device header for STM32F4xx simulation
 *
 * This header mirrors the real STM32F4xx CMSIS device header.
 * In the real HAL, it provides register definitions and memory-mapped
 * peripheral base addresses. In our simulator, it simply includes
 * the HAL umbrella header.
 */
#ifndef __STM32F4xx_H
#define __STM32F4xx_H

#include <stdint.h>

/* Include the HAL umbrella header which brings in everything */
#include "stm32f4xx_hal.h"

#endif /* __STM32F4xx_H */
