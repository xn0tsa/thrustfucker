#include "hid_app.h"
#include "tusb.h"
#include "config.h"
#include <string.h>

/* hid_report_desc et tud_hid_descriptor_report_cb sont dans usb_descriptors.c */

/* Keyboard report (Report ID 1) */
typedef struct __attribute__((packed)) {
    uint8_t report_id;
    uint8_t modifier;
    uint8_t reserved;
    uint8_t keycode[6];
} kbd_report_t;

/* Mouse report (Report ID 2) */
typedef struct __attribute__((packed)) {
    uint8_t report_id;
    uint8_t buttons;
    int8_t  x;
    int8_t  y;
} mouse_report_t;

/* Joystick report (Report ID 3) — 21 boutons (GPIO 0-10 + SPI 11-20) + 3-bit pad = 3 octets payload */
typedef struct __attribute__((packed)) {
    uint8_t  report_id;
    uint8_t  buttons[3]; /* bits 0-20 actifs, bits 21-23 = pad (calé sur gpio_read_buttons) */
} joy_report_t;

/* ── TinyUSB callbacks ────────────────────────────────────────────────────── */

uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t type, uint8_t* buffer, uint16_t reqlen)
{
    (void)instance; (void)report_id; (void)type; (void)buffer; (void)reqlen;
    return 0;
}

void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t type, const uint8_t* buffer, uint16_t bufsize)
{
    (void)instance; (void)report_id; (void)type; (void)buffer; (void)bufsize;
}

/* ── API publique ─────────────────────────────────────────────────────────── */

void hid_send_key(uint8_t modifier, uint8_t keycode)
{
    if (!tud_hid_ready()) return;
    kbd_report_t r = { .report_id = 1, .modifier = modifier, .reserved = 0 };
    r.keycode[0] = keycode;
    tud_hid_report(1, &r.modifier, sizeof(kbd_report_t) - 1);
}

void hid_release_keys(void)
{
    if (!tud_hid_ready()) return;
    kbd_report_t r = {0};
    r.report_id = 1;
    tud_hid_report(1, &r.modifier, sizeof(kbd_report_t) - 1);
}

void hid_send_mouse(int8_t x, int8_t y, uint8_t buttons)
{
    if (!tud_hid_ready()) return;
    mouse_report_t r = { .report_id = 2, .buttons = buttons, .x = x, .y = y };
    tud_hid_report(2, &r.buttons, sizeof(mouse_report_t) - 1);
}

void hid_send_buttons(uint32_t btn_bitmask)
{
    if (!tud_hid_ready()) return;
    uint32_t b = btn_bitmask & 0x1FFFFFu;  /* bits 0-20 (GPIO 0-10 + SPI 11-20) */
    joy_report_t r = {
        .report_id = 3,
        .buttons   = { (uint8_t)(b), (uint8_t)(b >> 8), (uint8_t)(b >> 16) }
    };
    tud_hid_report(3, r.buttons, sizeof(r.buttons));
}

/* ── Task : mouse jiggler si mode A-16 ───────────────────────────────────────
   Appelé depuis la boucle principale à chaque tour.
   Pour les autres modes HID, ne fait rien ici — c'est ducky_run() qui envoie. */
void hid_task(volatile uint16_t* adc_buf, volatile uint32_t buttons, const forge_config_t* cfg)
{
#ifdef MODE_A16
    /* Mouse Jiggler : micro-mouvements périodiques */
    static uint32_t last_jiggle = 0;
    uint32_t now = HAL_GetTick();
    uint16_t interval_ms = cfg ? (cfg->keystroke_delay_ms * 1000u) : 15000u;
    if ((now - last_jiggle) >= interval_ms) {
        last_jiggle = now;
        uint8_t amp = (cfg && cfg->slot_count > 0) ? (uint8_t)(cfg->slots[0].data[0]) : 3;
        static int8_t dir = 1;
        hid_send_mouse(dir * amp, 0, 0);
        HAL_Delay(50);
        hid_send_mouse(-dir * amp, 0, 0);
        dir = -dir;
    }
#else
    (void)adc_buf; (void)buttons; (void)cfg;
#endif
}
