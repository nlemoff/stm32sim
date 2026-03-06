/**
 * STM32 Knight Rider LED Example
 *
 * Creates a "Knight Rider" (KITT) chase pattern using 4 LEDs on PA5-PA8.
 * The LEDs light up one at a time, sweeping left then right, creating
 * the classic scanning effect from the TV show.
 *
 * This example demonstrates:
 * - Configuring multiple GPIO pins as outputs
 * - Controlling individual pins in a sequence
 * - Using HAL_Delay for timing patterns
 *
 * Hardware: 4 LEDs connected to PA5, PA6, PA7, PA8
 * Pattern: PA5 -> PA6 -> PA7 -> PA8 -> PA7 -> PA6 -> (repeat)
 */

#include "stm32f4xx_hal.h"

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);

/* LED pin definitions for easy reference */
#define LED1_PIN  GPIO_PIN_5    /* First LED (leftmost) */
#define LED2_PIN  GPIO_PIN_6
#define LED3_PIN  GPIO_PIN_7
#define LED4_PIN  GPIO_PIN_8    /* Last LED (rightmost) */

/* All LED pins combined -- useful for turning all off at once */
#define ALL_LED_PINS (LED1_PIN | LED2_PIN | LED3_PIN | LED4_PIN)

/* Chase speed in milliseconds -- how long each LED stays lit */
#define CHASE_DELAY_MS  100

/**
 * @brief  The application entry point.
 * @retval int
 */
int main(void)
{
  /* Standard STM32 initialization sequence */
  HAL_Init();
  SystemClock_Config();
  MX_GPIO_Init();

  /* Array of pins in chase order for cleaner loop logic.
     This makes it easy to change the number of LEDs or pin assignments. */
  uint16_t chase_pins[] = { LED1_PIN, LED2_PIN, LED3_PIN, LED4_PIN };
  int num_leds = sizeof(chase_pins) / sizeof(chase_pins[0]);

  /* Infinite loop -- run the chase pattern forever */
  while (1)
  {
    /* Sweep left to right: PA5 -> PA6 -> PA7 -> PA8 */
    for (int i = 0; i < num_leds; i++)
    {
      /* Turn on current LED */
      HAL_GPIO_WritePin(GPIOA, chase_pins[i], GPIO_PIN_SET);

      /* Wait for the chase delay */
      HAL_Delay(CHASE_DELAY_MS);

      /* Turn off current LED before moving to the next */
      HAL_GPIO_WritePin(GPIOA, chase_pins[i], GPIO_PIN_RESET);
    }

    /* Sweep right to left: PA7 -> PA6 (skip PA8 and PA5 to avoid
       double-lighting at the ends of the sweep) */
    for (int i = num_leds - 2; i > 0; i--)
    {
      HAL_GPIO_WritePin(GPIOA, chase_pins[i], GPIO_PIN_SET);
      HAL_Delay(CHASE_DELAY_MS);
      HAL_GPIO_WritePin(GPIOA, chase_pins[i], GPIO_PIN_RESET);
    }
  }
}

/**
 * @brief GPIO Initialization Function
 *
 * Configures PA5, PA6, PA7, and PA8 as push-pull outputs.
 *
 * Note: You can configure multiple pins at once by OR-ing their
 * bitmasks together in GPIO_InitStruct.Pin. The HAL will apply
 * the same Mode/Pull/Speed settings to all specified pins.
 */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};

  /* Enable GPIOA clock */
  __HAL_RCC_GPIOA_CLK_ENABLE();

  /* Start with all LEDs off */
  HAL_GPIO_WritePin(GPIOA, ALL_LED_PINS, GPIO_PIN_RESET);

  /* Configure all 4 LED pins at once.
     OR-ing the pin masks together configures them all with
     the same settings in a single HAL_GPIO_Init call. */
  GPIO_InitStruct.Pin = ALL_LED_PINS;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
}
