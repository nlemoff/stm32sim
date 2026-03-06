/**
 * UART Hello World
 *
 * Sends "Hello from STM32!" over UART1, then echoes back any
 * characters received. This demonstrates basic serial communication.
 */
#include "stm32f4xx_hal.h"
#include <string.h>

void SystemClock_Config(void);
static void MX_USART1_UART_Init(void);

UART_HandleTypeDef huart1;

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_USART1_UART_Init();

    const char *msg = "Hello from STM32!\r\n";
    HAL_UART_Transmit(&huart1, (uint8_t *)msg, strlen(msg), 1000);

    uint8_t rx_byte;
    while (1) {
        if (HAL_UART_Receive(&huart1, &rx_byte, 1, 100) == HAL_OK) {
            /* Echo received byte back */
            HAL_UART_Transmit(&huart1, &rx_byte, 1, 100);
        }
        HAL_Delay(10);
    }
}

static void MX_USART1_UART_Init(void) {
    huart1.Instance = USART1;
    huart1.Init.BaudRate = 115200;
    huart1.Init.WordLength = UART_WORDLENGTH_8B;
    huart1.Init.StopBits = UART_STOPBITS_1;
    huart1.Init.Parity = UART_PARITY_NONE;
    huart1.Init.Mode = UART_MODE_TX_RX;
    huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    huart1.Init.OverSampling = UART_OVERSAMPLING_16;
    HAL_UART_Init(&huart1);
}
