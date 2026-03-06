/**
 * STM32 Button + LED Example
 *
 * Reads a button on PA0 and controls an LED on PA5.
 * When the button is pressed (PA0 goes LOW), the LED turns on.
 * When the button is released (PA0 goes HIGH), the LED turns off.
 *
 * This example demonstrates:
 * - Configuring a GPIO pin as input with pull-up resistor
 * - Reading GPIO input state with HAL_GPIO_ReadPin
 * - Simple software debouncing with HAL_Delay
 * - The relationship between input and output GPIO
 *
 * Hardware:
 * - PA0: Button input with internal pull-up (active LOW)
 *   When not pressed: PA0 reads HIGH (pulled up internally)
 *   When pressed: PA0 reads LOW (button connects to GND)
 * - PA5: LED output (same as the blink example)
 *
 * Why active LOW?
 *   Most buttons on STM32 boards connect the pin to GND when pressed.
 *   The internal pull-up resistor holds the pin HIGH when the button
 *   is not pressed. This is called "active LOW" because the active
 *   (pressed) state is LOW.
 */

#include "stm32f4xx_hal.h"

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);

/* Pin definitions */
#define BUTTON_PIN    GPIO_PIN_0    /* Button on PA0 */
#define LED_PIN       GPIO_PIN_5    /* LED on PA5 */

/* Debounce delay in milliseconds.
   Mechanical buttons "bounce" -- they make and break contact multiple
   times in a few milliseconds when pressed. Reading too fast would
   see these bounces as multiple presses. A small delay filters them out. */
#define DEBOUNCE_MS   50

/**
 * @brief  The application entry point.
 * @retval int
 */
int main(void)
{
  /* Standard initialization */
  HAL_Init();
  SystemClock_Config();
  MX_GPIO_Init();

  /* Infinite loop -- continuously read button and update LED */
  while (1)
  {
    /* Read the button state.
       HAL_GPIO_ReadPin returns GPIO_PIN_SET (1) or GPIO_PIN_RESET (0).
       With pull-up: not pressed = SET (HIGH), pressed = RESET (LOW). */
    GPIO_PinState button_state = HAL_GPIO_ReadPin(GPIOA, BUTTON_PIN);

    if (button_state == GPIO_PIN_RESET)
    {
      /* Button is pressed (active LOW) -- turn LED on.
         We write the INVERSE of the button state:
         Button LOW (pressed) -> LED HIGH (on) */
      HAL_GPIO_WritePin(GPIOA, LED_PIN, GPIO_PIN_SET);
    }
    else
    {
      /* Button is released -- turn LED off */
      HAL_GPIO_WritePin(GPIOA, LED_PIN, GPIO_PIN_RESET);
    }

    /* Small delay for debouncing.
       This prevents reading the button faster than mechanical
       bouncing can settle. 50ms is a common debounce time. */
    HAL_Delay(DEBOUNCE_MS);
  }
}

/**
 * @brief GPIO Initialization Function
 *
 * Configures:
 * - PA0 as input with internal pull-up (button)
 * - PA5 as push-pull output (LED)
 *
 * Note: Input and output pins are configured separately because
 * they need different Mode and Pull settings.
 */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};

  /* Enable GPIOA clock -- needed for both button and LED */
  __HAL_RCC_GPIOA_CLK_ENABLE();

  /* Configure LED pin first -- start with LED off */
  HAL_GPIO_WritePin(GPIOA, LED_PIN, GPIO_PIN_RESET);

  GPIO_InitStruct.Pin = LED_PIN;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);

  /* Configure button pin as input with pull-up.
     GPIO_PULLUP enables the internal pull-up resistor, which holds
     the pin HIGH when the button is not pressed. When the button is
     pressed, it connects the pin to GND, pulling it LOW.
     No Speed setting is needed for inputs. */
  GPIO_InitStruct.Pin = BUTTON_PIN;
  GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
  GPIO_InitStruct.Pull = GPIO_PULLUP;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
}
