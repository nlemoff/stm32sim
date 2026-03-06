/**
 * @file hal_uart.c
 * @brief UART HAL stub implementations
 *
 * HAL_UART_Transmit emits uart_tx JSON events with properly escaped data.
 * HAL_UART_Receive reads from a ring buffer filled by stdin uart_rx messages,
 * polling with timeout support.
 *
 * USART peripheral instances are allocated as global structs so code using
 * USART1/USART2 macros can compile and link.
 */
#include "stm32f4xx_hal.h"
#include "sim_runtime.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>

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
    (void)Timeout;

    /* Escape JSON special characters in pData before embedding in event */
    char escaped[512];
    int pos = 0;
    for (uint16_t i = 0; i < Size && pos < (int)sizeof(escaped) - 6; i++) {
        uint8_t ch = pData[i];
        if (ch == '"')       { escaped[pos++] = '\\'; escaped[pos++] = '"'; }
        else if (ch == '\\') { escaped[pos++] = '\\'; escaped[pos++] = '\\'; }
        else if (ch == '\n') { escaped[pos++] = '\\'; escaped[pos++] = 'n'; }
        else if (ch == '\r') { escaped[pos++] = '\\'; escaped[pos++] = 'r'; }
        else if (ch == '\t') { escaped[pos++] = '\\'; escaped[pos++] = 't'; }
        else if (ch >= 0x20 && ch < 0x7F) { escaped[pos++] = (char)ch; }
        else { pos += snprintf(escaped + pos, 7, "\\u%04x", ch); }
    }
    escaped[pos] = '\0';

    sim_emit_event("uart_tx",
        "{\"data\":\"%s\",\"size\":%u}", escaped, (unsigned)Size);
    return HAL_OK;
}

HAL_StatusTypeDef HAL_UART_Receive(UART_HandleTypeDef *huart, uint8_t *pData,
                                   uint16_t Size, uint32_t Timeout) {
    (void)huart;

    uint32_t start = HAL_GetTick();
    uint16_t received = 0;

    while (received < Size) {
        /* Check stdin for new uart_rx messages */
        sim_check_stdin();

        /* Try to pop bytes from the ring buffer */
        int got = sim_uart_rx_pop(pData + received, Size - received);
        received += (uint16_t)got;

        if (received >= Size) break;

        /* Check timeout */
        uint32_t elapsed = HAL_GetTick() - start;
        if (elapsed >= Timeout) {
            return HAL_TIMEOUT;
        }

        /* Sleep 1ms between checks to avoid CPU spinning */
        usleep(1000);
    }

    return HAL_OK;
}
