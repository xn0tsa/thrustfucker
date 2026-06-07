/**
 * ThrustFucker — Firmware E : USB Descriptor Fuzzer
 *
 * Appui sur le bouton gâchette → incrémente g_fuzz_index (0..8)
 * et force une ré-énumération USB pour que l'hôte lise les nouveaux
 * descripteurs (potentiellement malformés).
 *
 * Scénarios de fuzz (définis dans usb_descriptors.c #ifdef FIRMWARE_E) :
 *   0  Identity            — descripteurs valides (baseline)
 *   1  bMaxPacketSize0=0   — taille EP0 invalide
 *   2  bNumConfigurations=0 — aucune configuration déclarée
 *   3  bcdDevice=0xFFFF    — version max inhabituelle
 *   4  iProduct=0xFF       — index de string inexistant
 *   5  wTotalLength=4      — config descriptor tronqué
 *   6  bNumInterfaces=0xFF — nombre d'interfaces démesuré
 *   7  HID bInterfaceSubClass=0xFF — sous-classe invalide
 *   8  EP bInterval=0      — intervalle nul pour endpoint interrupt
 *
 * La LED clignote N fois (N = fuzz_index) pour indiquer le scénario actif.
 */

#include "stm32f4xx_hal.h"
#include "tusb.h"
#include "config.h"
#include "drivers/gpio.h"
#include "drivers/adc.h"
#include "usb/hid_app.h"

#define CONFIG_FLASH_ADDR   0x08010000U
#define CONFIG_MAGIC        0x464F5247U
#define FUZZ_MAX            9

/* Partagé avec usb_descriptors.c (extern volatile uint8_t g_fuzz_index) */
volatile uint8_t g_fuzz_index = 0;

static void SystemClock_Config(void);
static void Error_Handler(void);

volatile uint16_t g_adc_buf[ADC_CH_COUNT];
volatile uint32_t g_buttons;
forge_config_t*   g_config;

/* ── Indication LED : clignote N fois ────────────────────────────────────── */
static void blink_n(uint8_t n) {
    for (uint8_t i = 0; i < n; i++) {
        gpio_led_set(true);
        HAL_Delay(80);
        gpio_led_set(false);
        HAL_Delay(120);
    }
}

/* ── Main ────────────────────────────────────────────────────────────────── */
int main(void) {
    HAL_Init();
    SystemClock_Config();
    gpio_init();
    adc_init();

    forge_config_t *cfg = (forge_config_t *)CONFIG_FLASH_ADDR;
    g_config = (cfg->magic == CONFIG_MAGIC) ? cfg : NULL;

    tusb_init();
    blink_n(1);  /* signal : prêt, scénario 0 (valide) */

    bool     btn_last   = false;
    uint32_t reconnect_t = 0;
    bool     reconnecting = false;

    while (1) {
        tud_task();

        /* Reconnect pending : attendre 200ms puis reconnecter */
        if (reconnecting && (HAL_GetTick() - reconnect_t >= 200)) {
            tud_connect();
            reconnecting = false;
            blink_n(g_fuzz_index ? g_fuzz_index : 1);
        }

        if (!reconnecting) {
            g_buttons = gpio_read_buttons();
            hid_task(g_adc_buf, g_buttons, NULL); /* NULL = pas de payload */

            bool btn_now = gpio_trigger_pressed(g_config);
            if (btn_now && !btn_last) {
                g_fuzz_index = (uint8_t)((g_fuzz_index + 1) % FUZZ_MAX);
                tud_disconnect();
                reconnect_t  = HAL_GetTick();
                reconnecting = true;
            }
            btn_last = btn_now;
        }
    }
}

static void SystemClock_Config(void) {
    RCC_OscInitTypeDef osc = {0}; RCC_ClkInitTypeDef clk = {0};
    __HAL_RCC_PWR_CLK_ENABLE();
    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);
    osc.OscillatorType = RCC_OSCILLATORTYPE_HSE; osc.HSEState = RCC_HSE_ON;
    osc.PLL.PLLState = RCC_PLL_ON; osc.PLL.PLLSource = RCC_PLLSOURCE_HSE;
    osc.PLL.PLLM = 4; osc.PLL.PLLN = 168; osc.PLL.PLLP = RCC_PLLP_DIV2; osc.PLL.PLLQ = 7;
    if (HAL_RCC_OscConfig(&osc) != HAL_OK) Error_Handler();
    if (HAL_PWREx_EnableOverDrive() != HAL_OK) Error_Handler();
    clk.ClockType = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK; clk.AHBCLKDivider = RCC_SYSCLK_DIV1;
    clk.APB1CLKDivider = RCC_HCLK_DIV4; clk.APB2CLKDivider = RCC_HCLK_DIV2;
    if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_5) != HAL_OK) Error_Handler();
}

static void Error_Handler(void) { __disable_irq(); while (1) {} }
void SysTick_Handler(void)      { HAL_IncTick(); }
void OTG_FS_IRQHandler(void)    { tud_int_handler(0); }
