/**
 * @file stm32f4xx_hal_gpio.h
 * @brief GPIO HAL module driver
 *
 * Defines GPIO types, pin/mode/pull/speed constants, and function
 * prototypes that match the real STM32F4 HAL GPIO interface.
 *
 * On real hardware, GPIO_TypeDef maps to memory-mapped registers.
 * In our simulator, these are plain structs whose fields are updated
 * by the stub implementations in hal_gpio.c.
 */
#ifndef __STM32F4xx_HAL_GPIO_H
#define __STM32F4xx_HAL_GPIO_H

#include "stm32f4xx_hal_def.h"

/**
 * GPIO register structure.
 * Mirrors the real STM32F4 GPIO peripheral register layout.
 * Each field corresponds to a hardware register.
 */
typedef struct {
  __IO uint32_t MODER;    /**< Mode register: input, output, AF, analog */
  __IO uint32_t OTYPER;   /**< Output type: push-pull or open-drain */
  __IO uint32_t OSPEEDR;  /**< Output speed register */
  __IO uint32_t PUPDR;    /**< Pull-up/pull-down register */
  __IO uint32_t IDR;      /**< Input data register (read pin states) */
  __IO uint32_t ODR;      /**< Output data register (write pin states) */
  __IO uint32_t BSRR;     /**< Bit set/reset register (atomic pin control) */
  __IO uint32_t LCKR;     /**< Configuration lock register */
  __IO uint32_t AFR[2];   /**< Alternate function registers (low/high) */
} GPIO_TypeDef;

/**
 * GPIO initialization structure.
 * This is how STM32CubeIDE configures GPIO pins.
 * You fill in this struct and pass it to HAL_GPIO_Init().
 */
typedef struct {
  uint32_t Pin;       /**< GPIO pin(s) to configure (bitmask, e.g. GPIO_PIN_5) */
  uint32_t Mode;      /**< Pin mode: input, output push-pull, output open-drain, etc. */
  uint32_t Pull;      /**< Pull-up/pull-down configuration */
  uint32_t Speed;     /**< Output speed (low, medium, high, very high) */
  uint32_t Alternate; /**< Alternate function selection (for AF mode) */
} GPIO_InitTypeDef;

/**
 * GPIO pin state enumeration.
 * Used with HAL_GPIO_ReadPin() and HAL_GPIO_WritePin().
 */
typedef enum {
  GPIO_PIN_RESET = 0,
  GPIO_PIN_SET
} GPIO_PinState;

/* ---- Pin Definitions (bitmask) ---- */
/* Each GPIO port has 16 pins. Pins are identified by bitmask,
   allowing multiple pins to be configured or controlled at once. */
#define GPIO_PIN_0    ((uint16_t)0x0001)
#define GPIO_PIN_1    ((uint16_t)0x0002)
#define GPIO_PIN_2    ((uint16_t)0x0004)
#define GPIO_PIN_3    ((uint16_t)0x0008)
#define GPIO_PIN_4    ((uint16_t)0x0010)
#define GPIO_PIN_5    ((uint16_t)0x0020)
#define GPIO_PIN_6    ((uint16_t)0x0040)
#define GPIO_PIN_7    ((uint16_t)0x0080)
#define GPIO_PIN_8    ((uint16_t)0x0100)
#define GPIO_PIN_9    ((uint16_t)0x0200)
#define GPIO_PIN_10   ((uint16_t)0x0400)
#define GPIO_PIN_11   ((uint16_t)0x0800)
#define GPIO_PIN_12   ((uint16_t)0x1000)
#define GPIO_PIN_13   ((uint16_t)0x2000)
#define GPIO_PIN_14   ((uint16_t)0x4000)
#define GPIO_PIN_15   ((uint16_t)0x8000)
#define GPIO_PIN_All  ((uint16_t)0xFFFF)

/* ---- Mode Definitions ---- */
/* These match the real STM32 HAL mode constants. In the simulator,
   they're used to track pin configuration for debugging/logging. */
#define GPIO_MODE_INPUT          0x00000000U  /**< Input floating */
#define GPIO_MODE_OUTPUT_PP      0x00000001U  /**< Output push-pull */
#define GPIO_MODE_OUTPUT_OD      0x00000011U  /**< Output open-drain */
#define GPIO_MODE_AF_PP          0x00000002U  /**< Alternate function push-pull */
#define GPIO_MODE_AF_OD          0x00000012U  /**< Alternate function open-drain */
#define GPIO_MODE_ANALOG         0x00000003U  /**< Analog mode */

/* ---- Pull Definitions ---- */
#define GPIO_NOPULL              0x00000000U  /**< No pull-up or pull-down */
#define GPIO_PULLUP              0x00000001U  /**< Activate pull-up resistor */
#define GPIO_PULLDOWN            0x00000002U  /**< Activate pull-down resistor */

/* ---- Speed Definitions ---- */
#define GPIO_SPEED_FREQ_LOW      0x00000000U  /**< Low speed (2 MHz) */
#define GPIO_SPEED_FREQ_MEDIUM   0x00000001U  /**< Medium speed (25 MHz) */
#define GPIO_SPEED_FREQ_HIGH     0x00000002U  /**< High speed (50 MHz) */
#define GPIO_SPEED_FREQ_VERY_HIGH 0x00000003U /**< Very high speed (100 MHz) */

/* ---- GPIO Port Instances ---- */
/* In real STM32, these are memory-mapped addresses.
   In our simulator, they're global structs allocated in hal_gpio.c. */
extern GPIO_TypeDef _GPIOA_Instance, _GPIOB_Instance, _GPIOC_Instance,
                    _GPIOD_Instance, _GPIOE_Instance;
#define GPIOA (&_GPIOA_Instance)
#define GPIOB (&_GPIOB_Instance)
#define GPIOC (&_GPIOC_Instance)
#define GPIOD (&_GPIOD_Instance)
#define GPIOE (&_GPIOE_Instance)

/* ---- Function Prototypes ---- */
/**
 * @brief Initialize GPIO pin(s) according to the specified parameters.
 * @param GPIOx GPIO port (GPIOA through GPIOE)
 * @param GPIO_Init Pointer to initialization structure
 */
void HAL_GPIO_Init(GPIO_TypeDef *GPIOx, GPIO_InitTypeDef *GPIO_Init);

/**
 * @brief De-initialize GPIO pin(s), resetting them to default state.
 */
void HAL_GPIO_DeInit(GPIO_TypeDef *GPIOx, uint32_t GPIO_Pin);

/**
 * @brief Read the state of a GPIO pin.
 * @return GPIO_PIN_SET if pin is high, GPIO_PIN_RESET if low
 */
GPIO_PinState HAL_GPIO_ReadPin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin);

/**
 * @brief Set or clear a GPIO output pin.
 */
void HAL_GPIO_WritePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin, GPIO_PinState PinState);

/**
 * @brief Toggle a GPIO output pin.
 */
void HAL_GPIO_TogglePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin);

/**
 * @brief Lock GPIO pin configuration.
 * @return HAL_OK if lock succeeded
 */
HAL_StatusTypeDef HAL_GPIO_LockPin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin);

#endif /* __STM32F4xx_HAL_GPIO_H */
