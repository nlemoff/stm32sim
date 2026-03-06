/**
 * STM32 Blink LED Example
 *
 * Classic "Hello World" for microcontrollers.
 * Toggles the LED on PA5 (pin 5 of GPIO port A) every 500ms.
 *
 * On the STM32 Nucleo-F401RE board, PA5 is connected to the green LED (LD2).
 * This code looks exactly like what STM32CubeIDE generates -- the same
 * HAL_Init/SystemClock_Config/MX_GPIO_Init pattern you'll see in every
 * STM32 project.
 *
 * How it works:
 * 1. HAL_Init() initializes the HAL library (Flash, SysTick, NVIC)
 * 2. SystemClock_Config() sets up the system clock (PLL, prescalers)
 * 3. MX_GPIO_Init() configures PA5 as a push-pull output
 * 4. The main loop toggles PA5 and waits 500ms forever
 */

#include "stm32f4xx_hal.h"

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);

/**
 * @brief  The application entry point.
 * @retval int
 */
int main(void)
{
  /* Reset of all peripherals, Initializes the Flash interface and the Systick.
     This is always the first call in any STM32 program. */
  HAL_Init();

  /* Configure the system clock.
     On real hardware, this sets up the PLL to run the CPU at the desired
     frequency (e.g., 84 MHz on STM32F401). In the simulator, it's a no-op. */
  SystemClock_Config();

  /* Initialize all configured peripherals.
     This is where GPIO pins, UART, SPI, etc. get configured. */
  MX_GPIO_Init();

  /* Infinite loop -- the main program logic lives here.
     On a microcontroller, main() should never return. */
  while (1)
  {
    /* Toggle the LED on PA5.
       HAL_GPIO_TogglePin flips the output state: if the LED was on (HIGH),
       it goes off (LOW), and vice versa. */
    HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);

    /* Wait 500 milliseconds.
       This creates a 1-second blink cycle: 500ms on + 500ms off.
       On real hardware, HAL_Delay uses the SysTick timer.
       In the simulator, it uses usleep with a speed multiplier. */
    HAL_Delay(500);
  }
}

/**
 * @brief GPIO Initialization Function
 *
 * Configures PA5 as a push-pull output with no pull-up/pull-down.
 * This is exactly how STM32CubeIDE generates GPIO initialization code.
 *
 * The GPIO_InitTypeDef structure specifies:
 * - Pin: which pin(s) to configure (GPIO_PIN_5 = bit 5 = 0x0020)
 * - Mode: output type (push-pull means the pin can drive both high and low)
 * - Pull: internal pull resistor (none needed for an output driving an LED)
 * - Speed: output switching speed (low is fine for an LED blinking at 1Hz)
 */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};

  /* GPIO Port A Clock Enable.
     On real STM32, the clock to each GPIO port must be enabled before
     the port can be used. This is a common "gotcha" for beginners --
     forgetting this call means GPIO writes silently do nothing.
     In the simulator, this is a no-op since there's no real clock tree. */
  __HAL_RCC_GPIOA_CLK_ENABLE();

  /* Configure GPIO pin Output Level -- start with LED off.
     It's good practice to set the initial output state before
     configuring the pin as an output, to avoid glitches. */
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);

  /* Configure GPIO pin: PA5 (LED) */
  GPIO_InitStruct.Pin = GPIO_PIN_5;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;   /* Push-pull output */
  GPIO_InitStruct.Pull = GPIO_NOPULL;           /* No pull-up/pull-down */
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;  /* Low speed is fine for LED */
  HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
}
