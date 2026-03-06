/**
 * @file stm32f4xx_hal_def.h
 * @brief HAL common definitions
 *
 * Defines the fundamental types used throughout the STM32 HAL:
 * - HAL_StatusTypeDef: Return status for HAL functions
 * - Volatile qualifiers (__IO, __I) for register access
 * - FlagStatus, FunctionalState enumerations
 * - UNUSED macro to suppress compiler warnings
 */
#ifndef __STM32F4xx_HAL_DEF_H
#define __STM32F4xx_HAL_DEF_H

#include <stdint.h>

/**
 * HAL Status return type.
 * Every HAL function that can fail returns this type.
 */
typedef enum {
  HAL_OK       = 0x00U,
  HAL_ERROR    = 0x01U,
  HAL_BUSY     = 0x02U,
  HAL_TIMEOUT  = 0x03U
} HAL_StatusTypeDef;

/**
 * Volatile qualifiers for hardware register access.
 * __IO = read/write volatile register
 * __I  = read-only volatile register
 */
#define __IO volatile
#define __I  volatile const

/**
 * Flag and functional state enumerations.
 * Used throughout the HAL for boolean-like returns and parameters.
 */
typedef enum { RESET = 0, SET = !RESET } FlagStatus, ITStatus;
typedef enum { DISABLE = 0, ENABLE = !DISABLE } FunctionalState;

/**
 * UNUSED macro to suppress "unused parameter" warnings.
 * STM32CubeIDE-generated code uses this in stub functions.
 */
#define UNUSED(X) (void)X

#endif /* __STM32F4xx_HAL_DEF_H */
