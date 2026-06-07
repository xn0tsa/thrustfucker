#include "tusb.h"
#include <string.h>

/* ── IDs ─────────────────────────────────────────────────────────────────── */
#define FORGE_VID    0x1209U   /* pid.codes open-source VID */
#define FORGE_PID    0x5446U   /* "TF" = ThrustFucker       */
#define FORGE_VER    0x0100U   /* bcdDevice 1.00            */

/* ── String table ────────────────────────────────────────────────────────── */
enum {
    STR_IDX_LANGID = 0,
    STR_IDX_MANUFACTURER,
    STR_IDX_PRODUCT,
    STR_IDX_SERIAL,
    STR_IDX_COUNT
};

/* ── HID report descriptor : Keyboard (ID 1) + Mouse (ID 2) + Joystick (ID 3) ─
   NOTE: les structs de rapport dans hid_app.c sont calées sur ce descripteur :
   - clavier  : modifier(1) + reserved(1) + keycode[6]
   - souris   : buttons(1) + x(int8) + y(int8)
   - joystick : 21 boutons (GPIO 0-10 + SPI 11-20) + 3 bits pad → 3 octets */
const uint8_t hid_report_desc[] = {
    /* ── Keyboard (Report ID 1) ────────────────────────────────────────────── */
    HID_USAGE_PAGE(HID_USAGE_PAGE_DESKTOP),
    HID_USAGE(HID_USAGE_DESKTOP_KEYBOARD),
    HID_COLLECTION(HID_COLLECTION_APPLICATION),
      HID_REPORT_ID(1)
      /* Modifier keys */
      HID_USAGE_PAGE(HID_USAGE_PAGE_KEYBOARD),
      HID_USAGE_MIN(224), HID_USAGE_MAX(231),
      HID_LOGICAL_MIN(0), HID_LOGICAL_MAX(1),
      HID_REPORT_COUNT(8), HID_REPORT_SIZE(1),
      HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),
      /* Reserved */
      HID_REPORT_COUNT(1), HID_REPORT_SIZE(8),
      HID_INPUT(HID_CONSTANT),
      /* Keycodes (6-key rollover) */
      HID_USAGE_PAGE(HID_USAGE_PAGE_KEYBOARD),
      HID_USAGE_MIN(0), HID_USAGE_MAX(255),
      HID_LOGICAL_MIN(0), HID_LOGICAL_MAX_N(255, 2),
      HID_REPORT_COUNT(6), HID_REPORT_SIZE(8),
      HID_INPUT(HID_DATA | HID_ARRAY | HID_ABSOLUTE),
    HID_COLLECTION_END,

    /* ── Mouse (Report ID 2) ─────────────────────────────────────────────── */
    HID_USAGE_PAGE(HID_USAGE_PAGE_DESKTOP),
    HID_USAGE(HID_USAGE_DESKTOP_MOUSE),
    HID_COLLECTION(HID_COLLECTION_APPLICATION),
      HID_REPORT_ID(2)
      HID_USAGE(HID_USAGE_DESKTOP_POINTER),
      HID_COLLECTION(HID_COLLECTION_PHYSICAL),
        /* Buttons */
        HID_USAGE_PAGE(HID_USAGE_PAGE_BUTTON),
        HID_USAGE_MIN(1), HID_USAGE_MAX(3),
        HID_LOGICAL_MIN(0), HID_LOGICAL_MAX(1),
        HID_REPORT_COUNT(3), HID_REPORT_SIZE(1),
        HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),
        HID_REPORT_COUNT(1), HID_REPORT_SIZE(5),
        HID_INPUT(HID_CONSTANT),
        /* X / Y axes — int8_t ±127 (calé sur mouse_report_t dans hid_app.c) */
        HID_USAGE_PAGE(HID_USAGE_PAGE_DESKTOP),
        HID_USAGE(HID_USAGE_DESKTOP_X), HID_USAGE(HID_USAGE_DESKTOP_Y),
        HID_LOGICAL_MIN_N(-127, 2), HID_LOGICAL_MAX(127),
        HID_REPORT_COUNT(2), HID_REPORT_SIZE(8),
        HID_INPUT(HID_DATA | HID_VARIABLE | HID_RELATIVE),
      HID_COLLECTION_END,
    HID_COLLECTION_END,

    /* ── Joystick (Report ID 3) — états bruts GPIO+SPI pour le config tool ──── */
    /* 21 boutons (BTN_TRIGGER=0 … BTN_PAD_R=20) + 3 bits pad = 24 bits = 3 octets */
    HID_USAGE_PAGE(HID_USAGE_PAGE_DESKTOP),
    HID_USAGE(HID_USAGE_DESKTOP_JOYSTICK),
    HID_COLLECTION(HID_COLLECTION_APPLICATION),
      HID_REPORT_ID(3)
      HID_USAGE_PAGE(HID_USAGE_PAGE_BUTTON),
      HID_USAGE_MIN(1), HID_USAGE_MAX(21),
      HID_LOGICAL_MIN(0), HID_LOGICAL_MAX(1),
      HID_REPORT_COUNT(21), HID_REPORT_SIZE(1),
      HID_INPUT(HID_DATA | HID_VARIABLE | HID_ABSOLUTE),
      /* Rembourrage 3 bits pour aligner sur 3 octets (24 bits total) */
      HID_REPORT_COUNT(1), HID_REPORT_SIZE(3),
      HID_INPUT(HID_CONSTANT),
    HID_COLLECTION_END,
};

/* ── TinyUSB : rapport HID ───────────────────────────────────────────────── */
uint8_t const *tud_hid_descriptor_report_cb(uint8_t instance)
{
    (void)instance;
    return hid_report_desc;
}

/* ── Device descriptor ───────────────────────────────────────────────────── */
static const tusb_desc_device_t device_desc = {
    .bLength            = sizeof(tusb_desc_device_t),
    .bDescriptorType    = TUSB_DESC_DEVICE,
    .bcdUSB             = 0x0200,
    .bDeviceClass       = 0x00,
    .bDeviceSubClass    = 0x00,
    .bDeviceProtocol    = 0x00,
    .bMaxPacketSize0    = CFG_TUD_ENDPOINT0_SIZE,
    .idVendor           = FORGE_VID,
    .idProduct          = FORGE_PID,
    .bcdDevice          = FORGE_VER,
    .iManufacturer      = STR_IDX_MANUFACTURER,
    .iProduct           = STR_IDX_PRODUCT,
    .iSerialNumber      = STR_IDX_SERIAL,
    .bNumConfigurations = 1,
};

#ifdef FIRMWARE_E
extern volatile uint8_t g_fuzz_index;
#define FUZZ_MAX 9
static tusb_desc_device_t e_dev;
uint8_t const *tud_descriptor_device_cb(void) {
    memcpy(&e_dev, &device_desc, sizeof(e_dev));
    switch (g_fuzz_index % FUZZ_MAX) {
        case 1: e_dev.bMaxPacketSize0    = 0;      break; /* invalid EP0 size */
        case 2: e_dev.bNumConfigurations = 0;      break; /* no configs */
        case 3: e_dev.bcdDevice          = 0xFFFF; break; /* max version */
        case 4: e_dev.iProduct           = 0xFF;   break; /* bad string idx */
        default: break;
    }
    return (uint8_t const *)&e_dev;
}
#else
uint8_t const *tud_descriptor_device_cb(void)
{
    return (uint8_t const *)&device_desc;
}
#endif

/* ── Configuration descriptor ────────────────────────────────────────────── */
#define  EPNUM_HID         0x81   /* EP 1 IN  */

#ifdef HAS_MSC
#  define EPNUM_MSC_OUT    0x02
#  define EPNUM_MSC_IN     0x82
#  define CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + TUD_HID_DESC_LEN + TUD_MSC_DESC_LEN)
#  define NUM_INTERFACES   2
#elif defined(FIRMWARE_C)
#  define EPNUM_NET_NOTIF  0x83
#  define EPNUM_NET_OUT    0x04
#  define EPNUM_NET_IN     0x84
#  define CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + TUD_HID_DESC_LEN + TUD_RNDIS_DESC_LEN)
#  define NUM_INTERFACES   3
#elif defined(FIRMWARE_D)
#  define EPNUM_CDC_NOTIF  0x83
#  define EPNUM_CDC_OUT    0x04
#  define EPNUM_CDC_IN     0x84
#  define CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + TUD_HID_DESC_LEN + TUD_CDC_DESC_LEN)
#  define NUM_INTERFACES   3
#else
#  define CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + TUD_HID_DESC_LEN)
#  define NUM_INTERFACES   1
#endif

static const uint8_t config_desc[] = {
    TUD_CONFIG_DESCRIPTOR(1, NUM_INTERFACES, 0, CONFIG_TOTAL_LEN,
                          TUSB_DESC_CONFIG_ATT_REMOTE_WAKEUP, 100),
    TUD_HID_DESCRIPTOR(0, 0, HID_ITF_PROTOCOL_NONE,
                       sizeof(hid_report_desc), EPNUM_HID,
                       CFG_TUD_HID_EP_BUFSIZE, 1),
#ifdef HAS_MSC
    TUD_MSC_DESCRIPTOR(1, 0, EPNUM_MSC_OUT, EPNUM_MSC_IN, 64),
#elif defined(FIRMWARE_C)
    TUD_RNDIS_DESCRIPTOR(1, 0, EPNUM_NET_NOTIF, 8, EPNUM_NET_OUT, EPNUM_NET_IN, 64),
#elif defined(FIRMWARE_D)
    TUD_CDC_DESCRIPTOR(1, 0, EPNUM_CDC_NOTIF, 8, EPNUM_CDC_OUT, EPNUM_CDC_IN, 64),
#endif
};

#ifdef FIRMWARE_E
static uint8_t e_cfg[sizeof(config_desc)];
uint8_t const *tud_descriptor_configuration_cb(uint8_t index) {
    (void)index;
    memcpy(e_cfg, config_desc, sizeof(e_cfg));
    switch (g_fuzz_index % FUZZ_MAX) {
        case 5: e_cfg[2]=4; e_cfg[3]=0; break; /* wTotalLength=4 (tronqué) */
        case 6: e_cfg[4]=0xFF; break;           /* bNumInterfaces=0xFF */
        case 7: e_cfg[15]=0xFF; break;          /* HID bInterfaceSubClass=0xFF */
        case 8: e_cfg[33]=0; break;             /* EP bInterval=0 (invalide) */
        default: break;
    }
    return e_cfg;
}
#else
uint8_t const *tud_descriptor_configuration_cb(uint8_t index)
{
    (void)index;
    return config_desc;
}
#endif

/* ── String descriptors ──────────────────────────────────────────────────── */
static const char *string_table[] = {
    [STR_IDX_LANGID]       = (const char[]){ 0x09, 0x04 },
    [STR_IDX_MANUFACTURER] = "ThrustFucker",
#ifdef HAS_MSC
    [STR_IDX_PRODUCT]      = "HID + Storage",
    [STR_IDX_SERIAL]       = "TF-A01",
#elif defined(FIRMWARE_C)
    [STR_IDX_PRODUCT]      = "Network Implant [stub]",
    [STR_IDX_SERIAL]       = "TF-C01",
#elif defined(FIRMWARE_D)
    [STR_IDX_PRODUCT]      = "C2 Relay [stub]",
    [STR_IDX_SERIAL]       = "TF-D01",
#elif defined(FIRMWARE_E)
    [STR_IDX_PRODUCT]      = "USB Fuzzer [stub]",
    [STR_IDX_SERIAL]       = "TF-E01",
#elif defined(FIRMWARE_F)
    [STR_IDX_PRODUCT]      = "Audio Covert [stub]",
    [STR_IDX_SERIAL]       = "TF-F01",
#else
    [STR_IDX_PRODUCT]      = "HID Composite Device",
    [STR_IDX_SERIAL]       = "TF-A01",
#endif
};

static uint16_t str_buf[64];

uint16_t const *tud_descriptor_string_cb(uint8_t index, uint16_t langid)
{
    (void)langid;
    if (index >= STR_IDX_COUNT) return NULL;

    const char *src = string_table[index];
    uint8_t len;

    if (index == STR_IDX_LANGID) {
        str_buf[1] = ((uint8_t)src[0]) | ((uint16_t)(uint8_t)src[1] << 8);
        len = 1;
    } else {
        len = (uint8_t)strlen(src);
        if (len > 63) len = 63;
        for (uint8_t i = 0; i < len; i++)
            str_buf[1 + i] = (uint8_t)src[i];
    }

    str_buf[0] = (uint16_t)((TUSB_DESC_STRING << 8) | (2 * len + 2));
    return str_buf;
}
