/**
 * ThrustFucker — Firmware D : C2 Relay (CDC Serial + HID)
 *
 * Le device s'énumère comme HID composite + port série USB (CDC ACM).
 *
 * Commandes (terminées par \r ou \n) :
 *   EXEC <script>  — exécute une ligne DuckyScript via le clavier HID
 *   STATUS         — retourne état boutons + valeurs ADC
 *   LED ON|OFF     — contrôle la LED
 *   PING           — répond PONG\r\n
 *
 * Le bouton gâchette exécute toujours le payload stocké en flash (normal).
 */

#include "stm32f4xx_hal.h"
#include "tusb.h"
#include "config.h"
#include "drivers/gpio.h"
#include "drivers/adc.h"
#include "duckyscript/duckyscript.h"
#include "usb/hid_app.h"
#include <string.h>
#include <stdio.h>

#define CONFIG_FLASH_ADDR   0x08010000U
#define CONFIG_MAGIC        0x464F5247U

static void SystemClock_Config(void);
static void Error_Handler(void);

volatile uint16_t g_adc_buf[ADC_CH_COUNT];
volatile uint32_t g_buttons;
forge_config_t*   g_config;

/* ── CDC output helpers ──────────────────────────────────────────────────── */
static void cdc_str(const char *s) {
    tud_cdc_n_write_str(0, s);
    tud_cdc_n_write_flush(0);
}

/* ── Command interpreter ─────────────────────────────────────────────────── */
static void handle_cmd(const char *cmd) {
    if (strncmp(cmd, "EXEC ", 5) == 0) {
        if (ducky_is_running()) {
            cdc_str("BUSY\r\n");
            return;
        }
        const char *script = cmd + 5;
        ducky_load(script, (uint16_t)strlen(script));
        cdc_str("OK\r\n");
    } else if (strcmp(cmd, "STATUS") == 0) {
        char buf[80];
        snprintf(buf, sizeof(buf), "BTN:%lu X:%u Y:%u MODE:%s\r\n",
                 (unsigned long)g_buttons,
                 g_adc_buf[0], g_adc_buf[1],
                 g_config ? (const char*)g_config->mode_id : "none");
        cdc_str(buf);
    } else if (strcmp(cmd, "LED ON") == 0) {
        gpio_led_set(true);
        cdc_str("OK\r\n");
    } else if (strcmp(cmd, "LED OFF") == 0) {
        gpio_led_set(false);
        cdc_str("OK\r\n");
    } else if (strcmp(cmd, "PING") == 0) {
        cdc_str("PONG\r\n");
    } else {
        cdc_str("ERR\r\n");
    }
}

/* ── TinyUSB CDC RX callback ─────────────────────────────────────────────── */
void tud_cdc_rx_cb(uint8_t itf) {
    static char rx[256];
    static uint16_t pos = 0;
    (void)itf;

    while (tud_cdc_n_available(0)) {
        int32_t c = tud_cdc_n_read_char(0);
        if (c < 0) break;
        if (c == '\r' || c == '\n') {
            if (pos > 0) {
                rx[pos] = '\0';
                handle_cmd(rx);
                pos = 0;
            }
        } else if (pos < (uint16_t)(sizeof(rx) - 1)) {
            rx[pos++] = (char)c;
        }
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

    while (1) {
        tud_task();
        g_buttons = gpio_read_buttons();
        hid_task(g_adc_buf, g_buttons, g_config);
        if (ducky_is_running()) ducky_run();
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
