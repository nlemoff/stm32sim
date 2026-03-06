/**
 * @file stm32f4xx_hal_i2c.h
 * @brief I2C HAL module driver
 *
 * Defines I2C types and function prototypes matching the real
 * STM32F4 HAL I2C interface. In Phase 1, these compile but are
 * no-op stubs. Full I2C behavior is wired in Phase 3.
 */
#ifndef __STM32F4xx_HAL_I2C_H
#define __STM32F4xx_HAL_I2C_H

#include "stm32f4xx_hal_def.h"

/**
 * I2C register structure.
 */
typedef struct {
  __IO uint32_t CR1;    /**< Control register 1 */
  __IO uint32_t CR2;    /**< Control register 2 */
  __IO uint32_t OAR1;   /**< Own address register 1 */
  __IO uint32_t OAR2;   /**< Own address register 2 */
  __IO uint32_t DR;     /**< Data register */
  __IO uint32_t SR1;    /**< Status register 1 */
  __IO uint32_t SR2;    /**< Status register 2 */
  __IO uint32_t CCR;    /**< Clock control register */
  __IO uint32_t TRISE;  /**< TRISE register */
} I2C_TypeDef;

/**
 * I2C initialization structure.
 */
typedef struct {
  uint32_t ClockSpeed;      /**< I2C clock speed (e.g. 100000 for 100kHz) */
  uint32_t DutyCycle;       /**< Fast mode duty cycle */
  uint32_t OwnAddress1;    /**< Own address (7-bit or 10-bit) */
  uint32_t AddressingMode;  /**< 7-bit or 10-bit addressing */
  uint32_t DualAddressMode; /**< Dual addressing mode */
  uint32_t OwnAddress2;    /**< Second own address */
  uint32_t GeneralCallMode; /**< General call mode */
  uint32_t NoStretchMode;  /**< Clock stretching disable */
} I2C_InitTypeDef;

/**
 * I2C handle structure.
 */
typedef struct {
  I2C_TypeDef       *Instance;  /**< I2C peripheral base address */
  I2C_InitTypeDef    Init;      /**< I2C configuration parameters */
} I2C_HandleTypeDef;

/* I2C instance (allocated in hal_i2c.c) */
extern I2C_TypeDef _I2C1_Instance;
#define I2C1 (&_I2C1_Instance)

/* ---- Function Prototypes ---- */
HAL_StatusTypeDef HAL_I2C_Init(I2C_HandleTypeDef *hi2c);
HAL_StatusTypeDef HAL_I2C_Master_Transmit(I2C_HandleTypeDef *hi2c, uint16_t DevAddress,
                                          const uint8_t *pData, uint16_t Size,
                                          uint32_t Timeout);
HAL_StatusTypeDef HAL_I2C_Master_Receive(I2C_HandleTypeDef *hi2c, uint16_t DevAddress,
                                         uint8_t *pData, uint16_t Size,
                                         uint32_t Timeout);

#endif /* __STM32F4xx_HAL_I2C_H */
