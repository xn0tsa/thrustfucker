#ifndef __STM32F4XX_HAL_CONF_H
#define __STM32F4XX_HAL_CONF_H

#ifdef __cplusplus
extern "C" {
#endif

/* ── Modules activés ─────────────────────────────────────────────────────── */
#define HAL_MODULE_ENABLED
#define HAL_ADC_MODULE_ENABLED      /* ADC1 — Hall sensors PA1/PA2           */
#define HAL_DMA_MODULE_ENABLED      /* DMA2 Stream0 — ADC circular           */
#define HAL_GPIO_MODULE_ENABLED
#define HAL_RCC_MODULE_ENABLED
#define HAL_CORTEX_MODULE_ENABLED   /* SysTick, NVIC, HAL_Delay              */
#define HAL_PCD_MODULE_ENABLED      /* USB OTG-FS PCD                        */
#define HAL_FLASH_MODULE_ENABLED    /* Lecture zone config                   */
#define HAL_PWR_MODULE_ENABLED      /* Requis par RCC                        */
#define HAL_EXTI_MODULE_ENABLED
#define HAL_SPI_MODULE_ENABLED      /* SPI2 — shift register boutons cluster L/R  */
#ifdef FIRMWARE_F
#  define HAL_TIM_MODULE_ENABLED    /* TIM2 PWM pour FSK Bell 202             */
#endif

/* ── Oscillateurs ────────────────────────────────────────────────────────── */
#if !defined(HSE_VALUE)
  #define HSE_VALUE             8000000U
#endif
#if !defined(HSE_STARTUP_TIMEOUT)
  #define HSE_STARTUP_TIMEOUT   100U
#endif
#if !defined(HSI_VALUE)
  #define HSI_VALUE             16000000U
#endif
#if !defined(LSI_VALUE)
  #define LSI_VALUE             32000U
#endif
#if !defined(LSE_VALUE)
  #define LSE_VALUE             32768U
#endif
#if !defined(LSE_STARTUP_TIMEOUT)
  #define LSE_STARTUP_TIMEOUT   5000U
#endif
#if !defined(EXTERNAL_CLOCK_VALUE)
  #define EXTERNAL_CLOCK_VALUE  12288000U
#endif

/* ── Configuration système ───────────────────────────────────────────────── */
#define VDD_VALUE                 3300U
#define TICK_INT_PRIORITY         0x0FU
#define USE_RTOS                  0U
#define PREFETCH_ENABLE           1U
#define INSTRUCTION_CACHE_ENABLE  1U
#define DATA_CACHE_ENABLE         1U

/* Callbacks registrables désactivés (gain ROM) */
#define USE_HAL_ADC_REGISTER_CALLBACKS  0U
#define USE_HAL_PCD_REGISTER_CALLBACKS  0U
#define USE_HAL_RTC_REGISTER_CALLBACKS  0U
#define USE_HAL_TIM_REGISTER_CALLBACKS  0U
#define USE_HAL_SPI_REGISTER_CALLBACKS  0U

/* ── assert_param : no-op en release ────────────────────────────────────── */
#ifdef USE_FULL_ASSERT
  #define assert_param(expr) \
    ((expr) ? (void)0U : assert_failed((uint8_t *)__FILE__, __LINE__))
  void assert_failed(uint8_t *file, uint32_t line);
#else
  #define assert_param(expr) ((void)0U)
#endif

/* ── Includes conditionnels ──────────────────────────────────────────────── */
#ifdef HAL_RCC_MODULE_ENABLED
  #include "stm32f4xx_hal_rcc.h"
  #include "stm32f4xx_hal_rcc_ex.h"
#endif
#ifdef HAL_GPIO_MODULE_ENABLED
  #include "stm32f4xx_hal_gpio.h"
#endif
#ifdef HAL_EXTI_MODULE_ENABLED
  #include "stm32f4xx_hal_exti.h"
#endif
#ifdef HAL_DMA_MODULE_ENABLED
  #include "stm32f4xx_hal_dma.h"
  #include "stm32f4xx_hal_dma_ex.h"
#endif
#ifdef HAL_CORTEX_MODULE_ENABLED
  #include "stm32f4xx_hal_cortex.h"
#endif
#ifdef HAL_ADC_MODULE_ENABLED
  #include "stm32f4xx_hal_adc.h"
  #include "stm32f4xx_hal_adc_ex.h"
#endif
#ifdef HAL_FLASH_MODULE_ENABLED
  #include "stm32f4xx_hal_flash.h"
  #include "stm32f4xx_hal_flash_ex.h"
  #include "stm32f4xx_hal_flash_ramfunc.h"
#endif
#ifdef HAL_PWR_MODULE_ENABLED
  #include "stm32f4xx_hal_pwr.h"
  #include "stm32f4xx_hal_pwr_ex.h"
#endif
#ifdef HAL_PCD_MODULE_ENABLED
  #include "stm32f4xx_hal_pcd.h"
  #include "stm32f4xx_hal_pcd_ex.h"
#endif
#ifdef HAL_SPI_MODULE_ENABLED
  #include "stm32f4xx_hal_spi.h"
#endif
#ifdef HAL_TIM_MODULE_ENABLED
  #include "stm32f4xx_hal_tim.h"
  #include "stm32f4xx_hal_tim_ex.h"
#endif

#ifdef __cplusplus
}
#endif

#endif /* __STM32F4XX_HAL_CONF_H */
