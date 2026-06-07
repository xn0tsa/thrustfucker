#pragma once
#include <stdint.h>
#include <stdbool.h>

#define ADC_CH_COUNT    2
#define PAYLOAD_MAX_LEN 4096
#define MAX_SLOTS       8

/* Un slot = un bouton → un DuckyScript */
typedef struct __attribute__((packed)) {
    uint8_t  button;                 /* BTN_TRIGGER..BTN_EXTRA */
    uint16_t len;                    /* longueur du DuckyScript */
    uint8_t  data[PAYLOAD_MAX_LEN]; /* DuckyScript brut (4096 octets max) */
} payload_slot_t;                   /* 4099 octets */

/* Config écrite par le launcher à CONFIG_FLASH_ADDR
 * Header : 4+8+2+1+1+256+32+32+512+1 = 849 octets
 * Total  : 849 + 8×4099 = 33641 octets */
typedef struct __attribute__((packed)) {
    uint32_t magic;              /* 0x464F5247 "FORG" */
    uint8_t  mode_id[8];         /* ex: "A-01\0..." */
    uint16_t keystroke_delay_ms; /* délai global entre frappes */
    uint8_t  exfil_mode;         /* 0=none 1=webhook 2=device 3=dual-usb */
    uint8_t  keyboard_layout;    /* 0=QWERTY(US) 1=AZERTY(FR) */
    char     webhook_url[256];   /* URL webhook si exfil_mode=1 */
    char     drive_label[32];    /* nom du lecteur USB si firmware A */
    char     aes_key[32];        /* clé AES si firmware D */
    char     extra_json[512];    /* config JSON mode-spécifique (C/E/F) */
    uint8_t  slot_count;         /* nombre de slots actifs (0..MAX_SLOTS) */
    payload_slot_t slots[MAX_SLOTS]; /* 8 × 4099 = 32792 octets */
} forge_config_t;

/* Boutons physiques — index dans g_buttons bitmask */
#define BTN_TRIGGER 0   /* PC0 — gâchette */
#define BTN_A       1   /* PC1 */
#define BTN_B       2   /* PC1? — non confirmé, possiblement SPI */
#define BTN_C       3   /* PC5 — non confirmé */
#define BTN_D       4   /* PA0 — non confirmé */
#define BTN_E       5   /* PA10 — non confirmé */
#define BTN_HAT_U   6   /* PB0 — non confirmé */
#define BTN_HAT_D   7   /* PC4 — confirmé par test physique 2026-06-07 */
#define BTN_HAT_L   8   /* ??? — PB4 retiré (SPI1 MISO), pin inconnue */
#define BTN_HAT_R   9   /* PC14 — confirmé par test physique 2026-06-07 */
#define BTN_EXTRA   10  /* PC15 */

/* Boutons SPI IO expander (CS=PC3, SPI1) — bits 11-26 du bitmask
 * BTN_SPI_BASE + N  où N = position dans les 2 octets lus (bit 0-15).
 * Le mapping bit↔bouton physique est à confirmer par test (flash + UI Detect). */
#define BTN_SPI_BASE 11
#define BTN_R_Y      11  /* SPI bit  0 — cluster droit, bouton Y  (provisional) */
#define BTN_R_X      12  /* SPI bit  1 — cluster droit, bouton X  (provisional) */
#define BTN_R_B1     13  /* SPI bit  2 — cluster droit, B1         (provisional) */
#define BTN_R_B2     14  /* SPI bit  3 — cluster droit, B2         (provisional) */
#define BTN_L_X      15  /* SPI bit  4 — cluster gauche, bouton X  (provisional) */
#define BTN_L_Y      16  /* SPI bit  5 — cluster gauche, bouton Y  (provisional) */
#define BTN_L_B1     17  /* SPI bit  6 — cluster gauche, B1         (provisional) */
#define BTN_L_B2     18  /* SPI bit  7 — cluster gauche, B2         (provisional) */
#define BTN_PAD_L    19  /* SPI bit  8 — palette gauche             (provisional) */
#define BTN_PAD_R    20  /* SPI bit  9 — palette droite             (provisional) */
/* Bits 10-15 (BTN 21-26) : réservés, non assignés au matériel connu */

/* Hall sensor ADC range (calibration d'origine) */
#define ADC_CENTER   440
#define ADC_MAX     3280
#define ADC_OUTPUT  2047   /* mapping vers ±2047 pour HID */
