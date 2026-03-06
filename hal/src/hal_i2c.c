/**
 * @file hal_i2c.c
 * @brief I2C HAL stub implementations
 *
 * I2C functions emit i2c_transfer JSON events with device address and
 * hex-encoded data. Master Receive zero-fills the buffer (no device
 * to receive from). I2C peripheral instance is allocated as a global
 * struct so code using the I2C1 macro can compile and link.
 */
#include "stm32f4xx_hal_i2c.h"
#include "sim_runtime.h"
#include <stdio.h>
#include <string.h>

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
    (void)Timeout;

    /* Build hex string of TX data */
    char hex_buf[512];
    int pos = 0;
    for (uint16_t i = 0; i < Size && pos < (int)sizeof(hex_buf) - 3; i++) {
        pos += snprintf(hex_buf + pos, 4, "%02X ", pData[i]);
    }
    if (pos > 0) hex_buf[pos - 1] = '\0'; /* trim trailing space */
    else hex_buf[0] = '\0';

    sim_emit_event("i2c_transfer",
        "{\"direction\":\"tx\",\"address\":\"0x%02X\",\"size\":%u,\"data\":\"%s\"}",
        (unsigned)DevAddress, (unsigned)Size, hex_buf);

    return HAL_OK;
}

HAL_StatusTypeDef HAL_I2C_Master_Receive(I2C_HandleTypeDef *hi2c, uint16_t DevAddress,
                                         uint8_t *pData, uint16_t Size,
                                         uint32_t Timeout) {
    (void)hi2c;
    (void)Timeout;

    /* Zero-fill RX data (no device to receive from) */
    memset(pData, 0, Size);

    /* Build hex string (all zeros) */
    char hex_buf[512];
    int pos = 0;
    for (uint16_t i = 0; i < Size && pos < (int)sizeof(hex_buf) - 3; i++) {
        pos += snprintf(hex_buf + pos, 4, "%02X ", pData[i]);
    }
    if (pos > 0) hex_buf[pos - 1] = '\0';
    else hex_buf[0] = '\0';

    sim_emit_event("i2c_transfer",
        "{\"direction\":\"rx\",\"address\":\"0x%02X\",\"size\":%u,\"data\":\"%s\"}",
        (unsigned)DevAddress, (unsigned)Size, hex_buf);

    return HAL_OK;
}
