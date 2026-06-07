/**
 * ThrustFucker — Firmware F : Audio Covert Channel
 *
 * Émission FSK Bell 202 (1200 baud) via TIM2_CH1 → PA5 (jack tip)
 *   Mark (bit 1) = 1200 Hz  →  ARR = 69999, CCR1 = 35000
 *   Space (bit 0) = 2200 Hz →  ARR = 38180, CCR1 = 19090
 *   (TIM2_CLK = 84 MHz = SYSCLK/4 × 2 car APB1_DIV=4)
 *
 * Réception DTMF via ADC1_IN6 → PA6 (jack mic)
 *   Algorithme de Goertzel, 8 fréquences, N=102 échantillons à ~8 kHz
 *   Chaque chiffre DTMF détecté est tapé comme frappe HID clavier.
 *
 * Gâchette = démarrer émission FSK du payload (DuckyScript comme données)
 */

#include "stm32f4xx_hal.h"
#include "tusb.h"
#include "config.h"
#include "drivers/gpio.h"
#include "usb/hid_app.h"
#include <string.h>

#define CONFIG_FLASH_ADDR   0x08010000U
#define CONFIG_MAGIC        0x464F5247U

static void SystemClock_Config(void);
static void Error_Handler(void);

volatile uint16_t g_adc_buf[2];   /* non utilisé pour axes, placebo pour ADC_CH_COUNT */
volatile uint32_t g_buttons;
forge_config_t*   g_config;

/* ── TIM2 PWM (PA5) ──────────────────────────────────────────────────────── */
static TIM_HandleTypeDef htim2;

static void TIM2_PWM_Init(void) {
    __HAL_RCC_TIM2_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin       = GPIO_PIN_5;
    gpio.Mode      = GPIO_MODE_AF_PP;
    gpio.Pull      = GPIO_NOPULL;
    gpio.Speed     = GPIO_SPEED_FREQ_HIGH;
    gpio.Alternate = GPIO_AF1_TIM2;
    HAL_GPIO_Init(GPIOA, &gpio);

    htim2.Instance           = TIM2;
    htim2.Init.Prescaler     = 0;
    htim2.Init.CounterMode   = TIM_COUNTERMODE_UP;
    htim2.Init.Period        = 69999;   /* 1200 Hz initial */
    htim2.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
    htim2.Init.AutoReloadPreload = TIM_AUTORELOAD_PRELOAD_ENABLE;
    HAL_TIM_PWM_Init(&htim2);

    TIM_OC_InitTypeDef oc = {0};
    oc.OCMode     = TIM_OCMODE_PWM1;
    oc.Pulse      = 35000;   /* 50 % duty */
    oc.OCPolarity = TIM_OCPOLARITY_HIGH;
    oc.OCFastMode = TIM_OCFAST_DISABLE;
    HAL_TIM_PWM_ConfigChannel(&htim2, &oc, TIM_CHANNEL_1);

    /* CCR1 preload enable : les changements ARR/CCR1 prennent effet à l'update suivant */
    TIM2->CCMR1 |= TIM_CCMR1_OC1PE;
    /* PWM éteint initialement */
    HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1);
    TIM2->CCR1 = 0;
}

/* ── ADC1 IN6 (PA6) — polling, indépendant de adc.c ─────────────────────── */
static ADC_HandleTypeDef hadc_f;

static void ADC_Init_F(void) {
    __HAL_RCC_ADC1_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin  = GPIO_PIN_6;
    gpio.Mode = GPIO_MODE_ANALOG;
    gpio.Pull = GPIO_NOPULL;
    HAL_GPIO_Init(GPIOA, &gpio);

    hadc_f.Instance                   = ADC1;
    hadc_f.Init.ClockPrescaler        = ADC_CLOCK_SYNC_PCLK_DIV4;
    hadc_f.Init.Resolution            = ADC_RESOLUTION_12B;
    hadc_f.Init.ScanConvMode          = DISABLE;
    hadc_f.Init.ContinuousConvMode    = DISABLE;
    hadc_f.Init.DiscontinuousConvMode = DISABLE;
    hadc_f.Init.ExternalTrigConvEdge  = ADC_EXTERNALTRIGCONVEDGE_NONE;
    hadc_f.Init.ExternalTrigConv      = ADC_SOFTWARE_START;
    hadc_f.Init.DataAlign             = ADC_DATAALIGN_RIGHT;
    hadc_f.Init.NbrOfConversion       = 1;
    hadc_f.Init.DMAContinuousRequests = DISABLE;
    hadc_f.Init.EOCSelection          = ADC_EOC_SINGLE_CONV;
    HAL_ADC_Init(&hadc_f);

    ADC_ChannelConfTypeDef ch = {0};
    ch.Channel      = ADC_CHANNEL_6;
    ch.Rank         = 1;
    ch.SamplingTime = ADC_SAMPLETIME_56CYCLES;
    HAL_ADC_ConfigChannel(&hadc_f, &ch);
}

static int16_t adc_read_f(void) {
    HAL_ADC_Start(&hadc_f);
    HAL_ADC_PollForConversion(&hadc_f, 5);
    return (int16_t)((int32_t)HAL_ADC_GetValue(&hadc_f) - 2048);
}

/* ── FSK Bell 202 émetteur ───────────────────────────────────────────────── */
/* TIM2_CLK = 84 MHz ; période en cycles CPU à 168 MHz */
#define FSK_MARK_ARR   69999UL
#define FSK_SPACE_ARR  38180UL
#define FSK_BIT_CYC    (168000000UL / 1200UL)   /* 140 000 cycles par bit */

typedef enum { FSK_IDLE = 0, FSK_DATA } fsk_state_t;
static fsk_state_t fsk_state    = FSK_IDLE;
static uint32_t    fsk_bit_t0   = 0;
static uint16_t    fsk_byte_idx = 0;
static uint8_t     fsk_bit_pos  = 0;
static uint8_t     fsk_cur_byte = 0;

static void fsk_start(void) {
    /* Slot 0 = données FSK à émettre (payload brut ou DuckyScript ignoré) */
    if (!g_config || !g_config->slot_count || !g_config->slots[0].len) return;
    fsk_byte_idx  = 0;
    fsk_bit_pos   = 0;
    fsk_cur_byte  = g_config->slots[0].data[0];
    fsk_bit_t0    = DWT->CYCCNT;
    fsk_state     = FSK_DATA;
    gpio_led_set(true);
    TIM2->ARR  = FSK_MARK_ARR;
    TIM2->CCR1 = (FSK_MARK_ARR + 1) / 2;
}

static void fsk_poll(void) {
    if (fsk_state != FSK_DATA) return;
    if ((DWT->CYCCNT - fsk_bit_t0) < FSK_BIT_CYC) return;
    fsk_bit_t0 += FSK_BIT_CYC;

    uint8_t bit = (fsk_cur_byte >> fsk_bit_pos) & 1;
    if (bit) {
        TIM2->ARR  = FSK_MARK_ARR;
        TIM2->CCR1 = (FSK_MARK_ARR + 1) / 2;
    } else {
        TIM2->ARR  = FSK_SPACE_ARR;
        TIM2->CCR1 = (FSK_SPACE_ARR + 1) / 2;
    }

    if (++fsk_bit_pos >= 8) {
        fsk_bit_pos = 0;
        if (++fsk_byte_idx >= g_config->slots[0].len) {
            fsk_state  = FSK_IDLE;
            TIM2->CCR1 = 0;
            gpio_led_set(false);
        } else {
            fsk_cur_byte = g_config->slots[0].data[fsk_byte_idx];
        }
    }
}

/* ── Goertzel DTMF décodeur ──────────────────────────────────────────────── */
#define GOERTZEL_N  102     /* échantillons par bloc à ~8 kHz ≈ 12,75 ms */
#define GOERTZEL_FS 8000

/*
 * Coefficients 2*cos(2π*f/8000) en Q15 (×32768).
 * Fréquences DTMF : lignes 697,770,852,941 Hz + colonnes 1209,1336,1477,1633 Hz
 */
static const int32_t dtmf_coeff[8] = {
    56091, 53762, 51208, 48413,   /* 697, 770, 852, 941 Hz */
    38153, 32751, 26444, 18507    /* 1209,1336,1477,1633 Hz */
};

/* Matrice de décodage : ligne × colonne */
static const char dtmf_map[4][4] = {
    {'1','2','3','A'},
    {'4','5','6','B'},
    {'7','8','9','C'},
    {'*','0','#','D'},
};

static uint32_t goertzel(const int16_t *s, int32_t coeff) {
    int32_t q1 = 0, q2 = 0;
    for (uint16_t i = 0; i < GOERTZEL_N; i++) {
        int32_t q0 = (int32_t)(((int64_t)coeff * q1) >> 15) - q2 + s[i];
        q2 = q1; q1 = q0;
    }
    int64_t pwr = (int64_t)q1*q1 + (int64_t)q2*q2
                - (((int64_t)q1*q2*coeff) >> 15);
    return (uint32_t)(pwr >> 10);
}

/* Période d'un échantillon à 8 kHz : 168MHz/8000 = 21000 cycles */
#define SAMPLE_CYC (168000000UL / GOERTZEL_FS)

static void sample_block(int16_t *buf) {
    for (uint16_t i = 0; i < GOERTZEL_N; i++) {
        uint32_t t0 = DWT->CYCCNT;
        buf[i] = adc_read_f();
        while ((DWT->CYCCNT - t0) < SAMPLE_CYC) {
            tud_task();  /* USB reste actif entre deux échantillons */
        }
    }
}

/* Keycode HID pour les symboles DTMF */
static void send_dtmf_key(char c) {
    uint8_t mod = 0, key = 0;
    if (c >= '1' && c <= '9') { key = (uint8_t)(0x1D + (c - '0')); }
    else if (c == '0')         { key = 0x27; }
    else if (c == '*')         { mod = 0x02; key = 0x25; } /* Shift+8 */
    else if (c == '#')         { mod = 0x02; key = 0x20; } /* Shift+3 */
    else if (c >= 'A' && c <= 'D') { key = (uint8_t)(0x04 + (c - 'A')); }
    if (key && tud_hid_ready()) {
        hid_send_key(mod, key);
        HAL_Delay(10);
        hid_release_keys();
    }
}

#define DTMF_THRESHOLD 800UL

static void dtmf_poll(void) {
    static int16_t samples[GOERTZEL_N];
    sample_block(samples);

    uint32_t pwr[8];
    for (uint8_t i = 0; i < 8; i++) pwr[i] = goertzel(samples, dtmf_coeff[i]);

    /* Fréquence la plus forte dans chaque groupe (lignes 0-3, colonnes 4-7) */
    uint8_t row = 0, col = 4;
    for (uint8_t i = 1; i < 4; i++) if (pwr[i] > pwr[row]) row = i;
    for (uint8_t i = 5; i < 8; i++) if (pwr[i] > pwr[col]) col = i;

    if (pwr[row] > DTMF_THRESHOLD && pwr[col] > DTMF_THRESHOLD) {
        static char last = 0;
        char ch = dtmf_map[row][col - 4];
        if (ch != last) {
            send_dtmf_key(ch);
            last = ch;
        }
    } else {
        static char last = 0; /* reset sur silence */
        last = 0;
    }
}

/* ── Main ────────────────────────────────────────────────────────────────── */
int main(void) {
    HAL_Init();
    SystemClock_Config();
    gpio_init();
    /* Pas d'adc_init() — on initialise ADC1 en mode polling pour PA6 */
    ADC_Init_F();
    TIM2_PWM_Init();

    /* Activer le DWT counter pour timing microsecondes (Bell 202) */
    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
    DWT->CYCCNT = 0;
    DWT->CTRL  |= DWT_CTRL_CYCCNTENA_Msk;

    forge_config_t *cfg = (forge_config_t *)CONFIG_FLASH_ADDR;
    g_config = (cfg->magic == CONFIG_MAGIC) ? cfg : NULL;

    tusb_init();

    bool btn_last = false;
    static uint32_t last_dtmf_ms = 0;

    while (1) {
        tud_task();
        fsk_poll();

        g_buttons = gpio_read_buttons();
        bool btn_now = gpio_trigger_pressed(g_config);
        if (btn_now && !btn_last && fsk_state == FSK_IDLE)
            fsk_start();
        btn_last = btn_now;

        /* Détection DTMF toutes les 50 ms quand FSK inactif */
        if (fsk_state == FSK_IDLE && HAL_GetTick() - last_dtmf_ms >= 50) {
            last_dtmf_ms = HAL_GetTick();
            dtmf_poll();
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
