/**
 * SPI Loopback Test
 *
 * Sends data over SPI1 and receives it back (loopback mode).
 * Demonstrates SPI initialization and data transfer.
 */
#include "stm32f4xx_hal.h"
#include <string.h>

void SystemClock_Config(void);
static void MX_SPI1_Init(void);

SPI_HandleTypeDef hspi1;

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_SPI1_Init();

    uint8_t tx_data[] = {0xDE, 0xAD, 0xBE, 0xEF};
    uint8_t rx_data[4] = {0};

    while (1) {
        HAL_SPI_TransmitReceive(&hspi1, tx_data, rx_data, 4, 1000);
        HAL_Delay(1000);
    }
}

static void MX_SPI1_Init(void) {
    hspi1.Instance = SPI1;
    hspi1.Init.Mode = 0;           /* SPI_MODE_MASTER */
    hspi1.Init.Direction = 0;      /* SPI_DIRECTION_2LINES */
    hspi1.Init.DataSize = 0;       /* SPI_DATASIZE_8BIT */
    hspi1.Init.CLKPolarity = 0;    /* SPI_POLARITY_LOW */
    hspi1.Init.CLKPhase = 0;       /* SPI_CPOL_1EDGE */
    hspi1.Init.NSS = 0;            /* SPI_NSS_SOFT */
    hspi1.Init.BaudRatePrescaler = 0;
    hspi1.Init.FirstBit = 0;       /* SPI_FIRSTBIT_MSB */
    HAL_SPI_Init(&hspi1);
}
