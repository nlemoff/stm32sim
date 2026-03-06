/**
 * @file hal_i2c.c
 * @brief I2C HAL stub implementations
 *
 * // I2C behavior wired in Phase 3. These stubs allow I2C code to compile.
 *
 * All functions are no-op stubs returning HAL_OK. I2C peripheral
 * instance is allocated as a global struct so code using the I2C1
 * macro can compile and link.
 */
#include "stm32f4xx_hal_i2c.h"

/* I2C peripheral instance */
I2C_TypeDef _I2C1_Instance;

HAL_StatusTypeDef HAL_I2C_Init(I2C_HandleTypeDef *hi2c) {
    (void)hi2c;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_I2C_Master_Transmit(I2C_HandleTypeDef *hi2c, uint16_t DevAddress,
                                          const uint8_t *pData, uint16_t Size,
                                          uint32_t Timeout) {
    (void)hi2c;
    (void)DevAddress;
    (void)pData;
    (void)Size;
    (void)Timeout;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_I2C_Master_Receive(I2C_HandleTypeDef *hi2c, uint16_t DevAddress,
                                         uint8_t *pData, uint16_t Size,
                                         uint32_t Timeout) {
    (void)hi2c;
    (void)DevAddress;
    (void)pData;
    (void)Size;
    (void)Timeout;
    return HAL_OK;
}
