/**
 * @file hal_gpio.c
 * @brief GPIO HAL stub implementations
 *
 * Provides GPIO functions that behave like real STM32 HAL but emit
 * JSON events to stdout instead of touching hardware registers.
 *
 * In-memory state tracks the Output Data Register (ODR) and Input
 * Data Register (IDR) for each of the 5 GPIO ports (A-E).
 *
 * IMPORTANT: Pin bitmasks are decoded to individual pin numbers.
 * GPIO_PIN_5 = 0x0020 = (1 << 5), so we emit pin number 5, not 32.
 * If multiple pins are set in the mask, one event is emitted per pin.
 */
#include "stm32f4xx_hal_gpio.h"
#include "sim_runtime.h"
#include <stdio.h>
#include <string.h>

/* ---- GPIO Port Instances ---- */
/* These are the global structs that GPIOA-GPIOE macros point to. */
GPIO_TypeDef _GPIOA_Instance;
GPIO_TypeDef _GPIOB_Instance;
GPIO_TypeDef _GPIOC_Instance;
GPIO_TypeDef _GPIOD_Instance;
GPIO_TypeDef _GPIOE_Instance;

/**
 * Map a GPIO_TypeDef pointer to a port index (0-4) and letter.
 * Returns -1 for unknown ports.
 */
static int port_index(GPIO_TypeDef *GPIOx) {
    if (GPIOx == GPIOA) return 0;
    if (GPIOx == GPIOB) return 1;
    if (GPIOx == GPIOC) return 2;
    if (GPIOx == GPIOD) return 3;
    if (GPIOx == GPIOE) return 4;
    return -1;
}

static const char *port_letter(int idx) {
    static const char *letters[] = {"A", "B", "C", "D", "E"};
    if (idx >= 0 && idx < 5) return letters[idx];
    return "?";
}

/**
 * Map a mode constant to a human-readable string for event data.
 */
static const char *mode_string(uint32_t mode) {
    switch (mode) {
        case GPIO_MODE_INPUT:     return "input";
        case GPIO_MODE_OUTPUT_PP: return "output_pp";
        case GPIO_MODE_OUTPUT_OD: return "output_od";
        case GPIO_MODE_AF_PP:     return "af_pp";
        case GPIO_MODE_AF_OD:     return "af_od";
        case GPIO_MODE_ANALOG:    return "analog";
        default:                  return "unknown";
    }
}

void HAL_GPIO_Init(GPIO_TypeDef *GPIOx, GPIO_InitTypeDef *GPIO_Init) {
    int idx = port_index(GPIOx);
    if (idx < 0) return;

    /* Build a JSON array of pin numbers from the bitmask */
    /* e.g., Pin=0x0060 (pins 5 and 6) -> [5,6] */
    char pins_buf[128];
    int pos = 0;
    pins_buf[pos++] = '[';
    int first = 1;
    for (int pin = 0; pin < 16; pin++) {
        if (GPIO_Init->Pin & (1 << pin)) {
            if (!first) pins_buf[pos++] = ',';
            pos += snprintf(pins_buf + pos, sizeof(pins_buf) - pos, "%d", pin);
            first = 0;
        }
    }
    pins_buf[pos++] = ']';
    pins_buf[pos] = '\0';

    sim_emit_event("gpio_init",
        "{\"port\":\"%s\",\"pins\":%s,\"mode\":\"%s\"}",
        port_letter(idx), pins_buf, mode_string(GPIO_Init->Mode));
}

void HAL_GPIO_DeInit(GPIO_TypeDef *GPIOx, uint32_t GPIO_Pin) {
    /* Reset pins to default state -- no-op in simulator */
    (void)GPIOx;
    (void)GPIO_Pin;
}

GPIO_PinState HAL_GPIO_ReadPin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin) {
    /* Check for pending stdin input before reading */
    sim_check_stdin();

    int idx = port_index(GPIOx);
    if (idx < 0) return GPIO_PIN_RESET;

    /* Read from the Input Data Register */
    return (GPIOx->IDR & GPIO_Pin) ? GPIO_PIN_SET : GPIO_PIN_RESET;
}

void HAL_GPIO_WritePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin, GPIO_PinState PinState) {
    int idx = port_index(GPIOx);
    if (idx < 0) return;

    /* Update the Output Data Register */
    if (PinState == GPIO_PIN_SET) {
        GPIOx->ODR |= GPIO_Pin;
    } else {
        GPIOx->ODR &= ~GPIO_Pin;
    }

    /* Emit one event per pin in the mask */
    for (int pin = 0; pin < 16; pin++) {
        if (GPIO_Pin & (1 << pin)) {
            sim_emit_event("gpio_write",
                "{\"port\":\"%s\",\"pin\":%d,\"state\":%d}",
                port_letter(idx), pin, (int)PinState);
        }
    }
}

void HAL_GPIO_TogglePin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin) {
    int idx = port_index(GPIOx);
    if (idx < 0) return;

    /* XOR the Output Data Register to toggle */
    GPIOx->ODR ^= GPIO_Pin;

    /* Emit one event per pin in the mask, with the new state */
    for (int pin = 0; pin < 16; pin++) {
        if (GPIO_Pin & (1 << pin)) {
            int state = (GPIOx->ODR & (1 << pin)) ? 1 : 0;
            sim_emit_event("gpio_write",
                "{\"port\":\"%s\",\"pin\":%d,\"state\":%d}",
                port_letter(idx), pin, state);
        }
    }
}

HAL_StatusTypeDef HAL_GPIO_LockPin(GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin) {
    /* Lock configuration -- no-op in simulator */
    (void)GPIOx;
    (void)GPIO_Pin;
    return HAL_OK;
}
