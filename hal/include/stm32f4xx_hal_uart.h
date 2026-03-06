/**
 * @file stm32f4xx_hal_uart.h
 * @brief UART HAL module driver
 *
 * Defines UART types and function prototypes matching the real
 * STM32F4 HAL UART interface. In Phase 1, these compile but are
 * no-op stubs. Full UART behavior is wired in Phase 3.
 */
#ifndef __STM32F4xx_HAL_UART_H
#define __STM32F4xx_HAL_UART_H

#include "stm32f4xx_hal_def.h"

/**
 * USART register structure.
 * Mirrors the real USART peripheral registers.
 */
typedef struct {
  __IO uint32_t SR;    /**< Status register */
  __IO uint32_t DR;    /**< Data register */
  __IO uint32_t BRR;   /**< Baud rate register */
  __IO uint32_t CR1;   /**< Control register 1 */
  __IO uint32_t CR2;   /**< Control register 2 */
  __IO uint32_t CR3;   /**< Control register 3 */
  __IO uint32_t GTPR;  /**< Guard time and prescaler register */
} USART_TypeDef;

/**
 * UART initialization structure.
 * Configures baud rate, word length, stop bits, parity, etc.
 */
typedef struct {
  uint32_t BaudRate;      /**< Baud rate (e.g. 115200) */
  uint32_t WordLength;    /**< Data bits */
  uint32_t StopBits;      /**< Stop bits */
  uint32_t Parity;        /**< Parity mode */
  uint32_t Mode;          /**< TX/RX mode */
  uint32_t HwFlowCtl;     /**< Hardware flow control */
  uint32_t OverSampling;  /**< Oversampling mode */
} UART_InitTypeDef;

/**
 * UART handle structure.
 * Contains the UART instance pointer and configuration.
 */
typedef struct {
  USART_TypeDef       *Instance;  /**< USART peripheral base address */
  UART_InitTypeDef     Init;      /**< UART configuration parameters */
} UART_HandleTypeDef;

/* USART instances (allocated in hal_uart.c) */
extern USART_TypeDef _USART1_Instance, _USART2_Instance;
#define USART1 (&_USART1_Instance)
#define USART2 (&_USART2_Instance)

/* Word length defines */
#define UART_WORDLENGTH_8B    0x00000000U
#define UART_WORDLENGTH_9B    0x00001000U

/* Stop bit defines */
#define UART_STOPBITS_1       0x00000000U
#define UART_STOPBITS_2       0x00002000U

/* Parity defines */
#define UART_PARITY_NONE      0x00000000U
#define UART_PARITY_EVEN      0x00000400U
#define UART_PARITY_ODD       0x00000600U

/* Mode defines */
#define UART_MODE_RX          0x00000004U
#define UART_MODE_TX          0x00000008U
#define UART_MODE_TX_RX       (UART_MODE_TX | UART_MODE_RX)

/* Hardware flow control */
#define UART_HWCONTROL_NONE   0x00000000U

/* Oversampling */
#define UART_OVERSAMPLING_16  0x00000000U

/* ---- Function Prototypes ---- */
HAL_StatusTypeDef HAL_UART_Init(UART_HandleTypeDef *huart);
HAL_StatusTypeDef HAL_UART_Transmit(UART_HandleTypeDef *huart, const uint8_t *pData,
                                    uint16_t Size, uint32_t Timeout);
HAL_StatusTypeDef HAL_UART_Receive(UART_HandleTypeDef *huart, uint8_t *pData,
                                   uint16_t Size, uint32_t Timeout);

#endif /* __STM32F4xx_HAL_UART_H */
