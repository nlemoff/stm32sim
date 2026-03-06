/**
 * @file hal_spi.c
 * @brief SPI HAL stub implementations
 *
 * // SPI behavior wired in Phase 3. These stubs allow SPI code to compile.
 *
 * All functions are no-op stubs returning HAL_OK. SPI peripheral
 * instance is allocated as a global struct so code using the SPI1
 * macro can compile and link.
 */
#include "stm32f4xx_hal_spi.h"

/* SPI peripheral instance */
SPI_TypeDef _SPI1_Instance;

HAL_StatusTypeDef HAL_SPI_Init(SPI_HandleTypeDef *hspi) {
    (void)hspi;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_SPI_Transmit(SPI_HandleTypeDef *hspi, const uint8_t *pData,
                                   uint16_t Size, uint32_t Timeout) {
    (void)hspi;
    (void)pData;
    (void)Size;
    (void)Timeout;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_SPI_Receive(SPI_HandleTypeDef *hspi, uint8_t *pData,
                                  uint16_t Size, uint32_t Timeout) {
    (void)hspi;
    (void)pData;
    (void)Size;
    (void)Timeout;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_SPI_TransmitReceive(SPI_HandleTypeDef *hspi,
                                          const uint8_t *pTxData, uint8_t *pRxData,
                                          uint16_t Size, uint32_t Timeout) {
    (void)hspi;
    (void)pTxData;
    (void)pRxData;
    (void)Size;
    (void)Timeout;
    return HAL_OK;
}
