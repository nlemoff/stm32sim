/**
 * @file stm32f4xx_hal_spi.h
 * @brief SPI HAL module driver
 *
 * Defines SPI types and function prototypes matching the real
 * STM32F4 HAL SPI interface. In Phase 1, these compile but are
 * no-op stubs. Full SPI behavior is wired in Phase 3.
 */
#ifndef __STM32F4xx_HAL_SPI_H
#define __STM32F4xx_HAL_SPI_H

#include "stm32f4xx_hal_def.h"

/**
 * SPI register structure.
 */
typedef struct {
  __IO uint32_t CR1;    /**< Control register 1 */
  __IO uint32_t CR2;    /**< Control register 2 */
  __IO uint32_t SR;     /**< Status register */
  __IO uint32_t DR;     /**< Data register */
  __IO uint32_t CRCPR;  /**< CRC polynomial register */
  __IO uint32_t RXCRCR; /**< RX CRC register */
  __IO uint32_t TXCRCR; /**< TX CRC register */
} SPI_TypeDef;

/**
 * SPI initialization structure.
 */
typedef struct {
  uint32_t Mode;              /**< Master or slave */
  uint32_t Direction;         /**< Full duplex, half duplex, RX only */
  uint32_t DataSize;          /**< 8-bit or 16-bit */
  uint32_t CLKPolarity;       /**< Clock polarity */
  uint32_t CLKPhase;          /**< Clock phase */
  uint32_t NSS;               /**< Slave select management */
  uint32_t BaudRatePrescaler; /**< Baud rate prescaler */
  uint32_t FirstBit;          /**< MSB or LSB first */
} SPI_InitTypeDef;

/**
 * SPI handle structure.
 */
typedef struct {
  SPI_TypeDef       *Instance;  /**< SPI peripheral base address */
  SPI_InitTypeDef    Init;      /**< SPI configuration parameters */
} SPI_HandleTypeDef;

/* SPI instance (allocated in hal_spi.c) */
extern SPI_TypeDef _SPI1_Instance;
#define SPI1 (&_SPI1_Instance)

/* ---- Function Prototypes ---- */
HAL_StatusTypeDef HAL_SPI_Init(SPI_HandleTypeDef *hspi);
HAL_StatusTypeDef HAL_SPI_Transmit(SPI_HandleTypeDef *hspi, const uint8_t *pData,
                                   uint16_t Size, uint32_t Timeout);
HAL_StatusTypeDef HAL_SPI_Receive(SPI_HandleTypeDef *hspi, uint8_t *pData,
                                  uint16_t Size, uint32_t Timeout);
HAL_StatusTypeDef HAL_SPI_TransmitReceive(SPI_HandleTypeDef *hspi,
                                          const uint8_t *pTxData, uint8_t *pRxData,
                                          uint16_t Size, uint32_t Timeout);

#endif /* __STM32F4xx_HAL_SPI_H */
