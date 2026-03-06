/**
 * @file hal_uart.c
 * @brief UART HAL stub implementations
 *
 * // UART behavior wired in Phase 3. These stubs allow UART code to compile.
 *
 * All functions are no-op stubs returning HAL_OK. USART peripheral
 * instances are allocated as global structs so code using USART1/USART2
 * macros can compile and link.
 */
#include "stm32f4xx_hal_uart.h"

/* USART peripheral instances */
USART_TypeDef _USART1_Instance;
USART_TypeDef _USART2_Instance;

HAL_StatusTypeDef HAL_UART_Init(UART_HandleTypeDef *huart) {
    (void)huart;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_UART_Transmit(UART_HandleTypeDef *huart, const uint8_t *pData,
                                    uint16_t Size, uint32_t Timeout) {
    (void)huart;
    (void)pData;
    (void)Size;
    (void)Timeout;
    return HAL_OK;
}

HAL_StatusTypeDef HAL_UART_Receive(UART_HandleTypeDef *huart, uint8_t *pData,
                                   uint16_t Size, uint32_t Timeout) {
    (void)huart;
    (void)pData;
    (void)Size;
    (void)Timeout;
    return HAL_OK;
}
