/**
 * @file stm32f4xx_hal_conf.h
 * @brief HAL configuration file
 *
 * In real STM32 projects, this file enables/disables HAL modules
 * to control code size. STM32CubeIDE generates this file based on
 * which peripherals are configured in the .ioc file.
 *
 * For our simulator, all supported modules are enabled.
 */
#ifndef __STM32F4xx_HAL_CONF_H
#define __STM32F4xx_HAL_CONF_H

/* Module enable macros -- each enables a peripheral HAL driver */
#define HAL_MODULE_ENABLED
#define HAL_GPIO_MODULE_ENABLED
#define HAL_UART_MODULE_ENABLED
#define HAL_SPI_MODULE_ENABLED
#define HAL_I2C_MODULE_ENABLED
#define HAL_RCC_MODULE_ENABLED
#define HAL_CORTEX_MODULE_ENABLED

#endif /* __STM32F4xx_HAL_CONF_H */
