/**
 * ThrustFucker — Firmware base (Firmware A: HID Keyboard + Mouse)
 * STM32F446xx, 180 MHz, USB OTG-FS PA11/PA12
 *
 * Pinout (confirmé par RE de l'original) :
 *   PA1 = ADC1_IN1 (axe X, capteur Hall)
 *   PA2 = ADC1_IN2 (axe Y, capteur Hall)
 *   PA0, PA10, PB0, PB3, PB4, PC0, PC1, PC4, PC5, PC14, PC15 = boutons INPUT PU
 *   PA11, PA12 = USB OTG-FS (AF10)
 */

#include "stm32f4xx_hal.h"
#include "tusb.h"
#include "config.h"
#include "drivers/gpio.h"
#include "drivers/adc.h"
#include "duckyscript/duckyscript.h"
#include "usb/hid_app.h"
#ifdef HAS_MSC
#  include "usb/ramdisk.h"
#endif

/* ── Config flash region (patché par le launcher) ─────────────────────────── */
#define CONFIG_FLASH_ADDR   0x08010000U   /* 64KB offset dans la flash */
#define CONFIG_MAGIC        0x464F5247U   /* "FORG" */

/* ── Prototypes ────────────────────────────────────────────────────────────── */
static void SystemClock_Config(void);
static void Error_Handler(void);
static forge_config_t* config_load(void);

/* ── Globaux partagés entre modules ────────────────────────────────────────── */
volatile uint16_t g_adc_buf[ADC_CH_COUNT];   /* DMA buffer : [0]=X [1]=Y */
volatile uint32_t g_buttons;                  /* bitmask état courant boutons */
forge_config_t*   g_config;

/* ─────────────────────────────────────────────────────────────────────────── */
int main(void)
{
    HAL_Init();
    SystemClock_Config();

    /* GPIO : boutons + LED + CS */
    gpio_init();

    /* ADC1 DMA (PA1/PA2, DMA2_Stream0 Ch0) */
    adc_init();

    /* Charger la config depuis la flash patchée */
    g_config = config_load();

#ifdef HAS_MSC
    /* RAM disk FAT12 — label depuis config ou défaut */
    const char* label = (g_config && g_config->drive_label[0])
                        ? g_config->drive_label : "FORGE USB";
    ramdisk_init(label);
#endif

    /* TinyUSB init */
    tusb_init();

    /* Paramètres globaux depuis config */
    if (g_config && g_config->magic == CONFIG_MAGIC) {
        if (g_config->keystroke_delay_ms > 0)
            ducky_set_default_delay(g_config->keystroke_delay_ms);
        ducky_set_layout(g_config->keyboard_layout);
    }

    /* ── Boucle principale ─────────────────────────────────────────────────── */
    uint32_t btn_prev = 0;
    uint32_t joy_prev = 0xFFFFFFFFU; /* forcer l'envoi du rapport joystick au démarrage */
    while (1) {
        tud_task();

        uint32_t btn_now  = gpio_read_buttons();
        uint32_t btn_edge = btn_now & ~btn_prev; /* fronts montants uniquement */
        btn_prev          = btn_now;

        /* Dispatch multi-slot : trouver le slot dont le bouton vient d'être pressé */
        if (g_config && g_config->magic == CONFIG_MAGIC && btn_edge) {
            for (uint8_t i = 0; i < g_config->slot_count; i++) {
                if ((btn_edge >> g_config->slots[i].button) & 1U) {
                    ducky_load((const char*)g_config->slots[i].data, g_config->slots[i].len);
                    ducky_run();
                    btn_prev = gpio_read_buttons(); /* flush état après run bloquant */
                    break;
                }
            }
        }

        /* Report ID 3 (joystick) : envoyer uniquement si l'état des boutons change.
           Permet à l'API Gamepad du browser de détecter le stick en mode normal. */
        if (btn_now != joy_prev) {
            hid_send_buttons(btn_now);
            joy_prev = btn_now;
        }

        g_buttons = btn_now;
        hid_task(g_adc_buf, g_buttons, g_config);
    }
}

/* ── Horloge : HSE 8MHz → PLL → 168MHz (SYSCLK), 42MHz (APB1), 84MHz (APB2), 48MHz USB */
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
    osc.PLL.PLLM       = 4;    /* 8MHz/4 = 2MHz */
    osc.PLL.PLLN       = 168;  /* 2MHz × 168 = 336MHz VCO */
    osc.PLL.PLLP       = RCC_PLLP_DIV2; /* 336/2 = 168MHz SYSCLK */
    osc.PLL.PLLQ       = 7;    /* 336/7 = 48MHz USB exact (360/8=45MHz serait faux) */
    if (HAL_RCC_OscConfig(&osc) != HAL_OK) Error_Handler();

    /* Activer Over-Drive pour 180MHz */
    if (HAL_PWREx_EnableOverDrive() != HAL_OK) Error_Handler();

    clk.ClockType      = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK |
                         RCC_CLOCKTYPE_PCLK1  | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource   = RCC_SYSCLKSOURCE_PLLCLK;
    clk.AHBCLKDivider  = RCC_SYSCLK_DIV1;
    clk.APB1CLKDivider = RCC_HCLK_DIV4;   /* 45MHz */
    clk.APB2CLKDivider = RCC_HCLK_DIV2;   /* 90MHz */
    if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_5) != HAL_OK) Error_Handler();

}

/* ── Chargement config depuis flash ─────────────────────────────────────────── */
static forge_config_t* config_load(void)
{
    forge_config_t* cfg = (forge_config_t*)CONFIG_FLASH_ADDR;
    if (cfg->magic != CONFIG_MAGIC) return NULL;
    return cfg;
}

static void Error_Handler(void)
{
    __disable_irq();
    while (1) {}
}

/* ── Callbacks requis par TinyUSB ──────────────────────────────────────────── */
void SysTick_Handler(void)        { HAL_IncTick(); }
void OTG_FS_IRQHandler(void)      { tud_int_handler(0); }
