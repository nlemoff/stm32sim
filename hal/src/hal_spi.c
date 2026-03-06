/**
 * @file hal_spi.c
 * @brief SPI HAL stub implementations
 *
 * SPI functions perform loopback (copy TX to RX) and emit spi_transfer
 * JSON events with hex-encoded data. SPI peripheral instance is allocated
 * as a global struct so code using the SPI1 macro can compile and link.
 */
#include "stm32f4xx_hal_spi.h"
#include "sim_runtime.h"
#include <stdio.h>
#include <string.h>

/* SPI peripheral instance */
SPI_TypeDef _SPI1_Instance;

HAL_StatusTypeDef HAL_SPI_Init(SPI_HandleTypeDef *hspi) {
    (void)hspi;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_SPI_Transmit(SPI_HandleTypeDef *hspi, const uint8_t *pData,
                                   uint16_t Size, uint32_t Timeout) {
    (void)hspi;
    (void)Timeout;

    /* Build hex string of TX data */
    char hex_buf[512];
    int pos = 0;
    for (uint16_t i = 0; i < Size && pos < (int)sizeof(hex_buf) - 3; i++) {
        pos += snprintf(hex_buf + pos, 4, "%02X ", pData[i]);
    }
    if (pos > 0) hex_buf[pos - 1] = '\0'; /* trim trailing space */
    else hex_buf[0] = '\0';

    sim_emit_event("spi_transfer",
        "{\"direction\":\"tx\",\"size\":%u,\"data\":\"%s\"}",
        (unsigned)Size, hex_buf);

    return HAL_OK;
}

HAL_StatusTypeDef HAL_SPI_Receive(SPI_HandleTypeDef *hspi, uint8_t *pData,
                                  uint16_t Size, uint32_t Timeout) {
    (void)hspi;
    (void)Timeout;

    /* Zero-fill RX data (no device to receive from in loopback) */
    memset(pData, 0, Size);

    /* Build hex string (all zeros) */
    char hex_buf[512];
    int pos = 0;
    for (uint16_t i = 0; i < Size && pos < (int)sizeof(hex_buf) - 3; i++) {
        pos += snprintf(hex_buf + pos, 4, "%02X ", pData[i]);
    }
    if (pos > 0) hex_buf[pos - 1] = '\0';
    else hex_buf[0] = '\0';

    sim_emit_event("spi_transfer",
        "{\"direction\":\"rx\",\"size\":%u,\"data\":\"%s\"}",
        (unsigned)Size, hex_buf);

    return HAL_OK;
}

HAL_StatusTypeDef HAL_SPI_TransmitReceive(SPI_HandleTypeDef *hspi,
                                          const uint8_t *pTxData, uint8_t *pRxData,
                                          uint16_t Size, uint32_t Timeout) {
    (void)hspi;
    (void)Timeout;

    /* Loopback: copy TX to RX */
    for (uint16_t i = 0; i < Size; i++) {
        pRxData[i] = pTxData[i];
    }

    /* Build hex string of TX data */
    char hex_buf[512];
    int pos = 0;
    for (uint16_t i = 0; i < Size && pos < (int)sizeof(hex_buf) - 3; i++) {
        pos += snprintf(hex_buf + pos, 4, "%02X ", pTxData[i]);
    }
    if (pos > 0) hex_buf[pos - 1] = '\0'; /* trim trailing space */
    else hex_buf[0] = '\0';

    sim_emit_event("spi_transfer",
        "{\"direction\":\"txrx\",\"size\":%u,\"data\":\"%s\"}",
        (unsigned)Size, hex_buf);

    return HAL_OK;
}
