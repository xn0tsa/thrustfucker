/**
 * ThrustFucker — Firmware B : HID Keyboard/Mouse + USB Mass Storage
 *
 * Ajoute un disque RAM FAT12 64KB au firmware A.
 * Le DuckyScript injecté peut écrire les données exfiltrées directement
 * sur le lecteur USB (cherche le volume par cfg->drive_label).
 *
 * Exemple PS pour écrire sur la clé :
 *   $d=(Get-WmiObject Win32_LogicalDisk|?{$_.VolumeName -eq 'KINGSTON 8GB'}).DeviceID
 *   "résultats" | Out-File "$d\out.txt"
 */

#include "stm32f4xx_hal.h"
#include "tusb.h"
#include "config.h"
#include "drivers/gpio.h"
#include "drivers/adc.h"
#include "duckyscript/duckyscript.h"
#include "usb/hid_app.h"
#include "usb/ramdisk.h"

#define CONFIG_FLASH_ADDR   0x08010000U
#define CONFIG_MAGIC        0x464F5247U

static void SystemClock_Config(void);
static void Error_Handler(void);

volatile uint16_t g_adc_buf[ADC_CH_COUNT];
volatile uint32_t g_buttons;
forge_config_t*   g_config;

int main(void)
{
    HAL_Init();
    SystemClock_Config();
    gpio_init();
    adc_init();

    forge_config_t* cfg = (forge_config_t*)CONFIG_FLASH_ADDR;
    g_config = (cfg->magic == CONFIG_MAGIC) ? cfg : NULL;

    /* Init RAM disk avec le label configuré (ex : "KINGSTON 8GB") */
    const char* label = (g_config && g_config->drive_label[0])
                        ? g_config->drive_label : "FORGE USB";
    ramdisk_init(label);

    tusb_init();

    /* Utilise le slot 0 comme payload unique — variante B mono-slot */
    if (g_config && g_config->slot_count > 0) {
        ducky_load((const char*)g_config->slots[0].data, g_config->slots[0].len);
        if (g_config->keystroke_delay_ms > 0)
            ducky_set_default_delay(g_config->keystroke_delay_ms);
        ducky_set_layout(g_config->keyboard_layout);
    }

    while (1) {
        tud_task();
        g_buttons = gpio_read_buttons();
        if (gpio_trigger_pressed(g_config)) {
            ducky_run();
        }
        hid_task(g_adc_buf, g_buttons, g_config);
    }
}

/* ── 168 MHz (HSE 8MHz), PLLQ=7 → 48MHz USB exact ────────────────────────── */
static void SystemClock_Config(void)
{
    RCC_OscInitTypeDef osc = {0};
    RCC_ClkInitTypeDef clk = {0};

    __HAL_RCC_PWR_CLK_ENABLE();
    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);

    osc.OscillatorType = RCC_OSCILLATORTYPE_HSE;
    osc.HSEState       = RCC_HSE_ON;
    osc.PLL.PLLState   = RCC_PLL_ON;
    osc.PLL.PLLSource  = RCC_PLLSOURCE_HSE;
    osc.PLL.PLLM       = 4;
    osc.PLL.PLLN       = 168;
    osc.PLL.PLLP       = RCC_PLLP_DIV2;
    osc.PLL.PLLQ       = 7;
    if (HAL_RCC_OscConfig(&osc) != HAL_OK) Error_Handler();
    if (HAL_PWREx_EnableOverDrive() != HAL_OK) Error_Handler();

    clk.ClockType      = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK |
                         RCC_CLOCKTYPE_PCLK1  | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource   = RCC_SYSCLKSOURCE_PLLCLK;
    clk.AHBCLKDivider  = RCC_SYSCLK_DIV1;
    clk.APB1CLKDivider = RCC_HCLK_DIV4;
    clk.APB2CLKDivider = RCC_HCLK_DIV2;
    if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_5) != HAL_OK) Error_Handler();
}

static void Error_Handler(void) { __disable_irq(); while (1) {} }

void SysTick_Handler(void)   { HAL_IncTick(); }
void OTG_FS_IRQHandler(void) { tud_int_handler(0); }
