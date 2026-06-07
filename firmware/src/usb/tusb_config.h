#pragma once

/* ── MCU / OS ─────────────────────────────────────────────────────────────── */
#define CFG_TUSB_MCU    OPT_MCU_STM32F4
#define CFG_TUSB_OS     OPT_OS_NONE

/* ── Rhport 0 = USB OTG-FS (PA11/PA12) ───────────────────────────────────── */
#define BOARD_TUD_RHPORT          0
#define BOARD_TUD_MAX_SPEED       OPT_MODE_FULL_SPEED

/* TinyUSB >= 0.15 : tusb_init() sans args exige ce define                   */
#define CFG_TUSB_RHPORT0_MODE     (OPT_MODE_DEVICE | OPT_MODE_FULL_SPEED)

/* ── Device stack ────────────────────────────────────────────────────────── */
#define CFG_TUD_ENABLED           1
#define CFG_TUD_MAX_SPEED         OPT_MODE_FULL_SPEED

/* ── Classes ─────────────────────────────────────────────────────────────── */
#define CFG_TUD_HID               1
#define CFG_TUD_HID_EP_BUFSIZE    64

/* MSC activé pour tout firmware avec HAS_MSC (classe A et dérivés) */
#ifdef HAS_MSC
#  define CFG_TUD_MSC             1
#  define CFG_TUD_MSC_EP_BUFSIZE  512
#else
#  define CFG_TUD_MSC             0
#  define CFG_TUD_MSC_EP_BUFSIZE  512
#endif

/* CDC activé pour Firmware D (relay série) */
#ifdef FIRMWARE_D
#  define CFG_TUD_CDC             1
#  define CFG_TUD_CDC_EP_BUFSIZE  64
#else
#  define CFG_TUD_CDC             0
#  define CFG_TUD_CDC_EP_BUFSIZE  64
#endif

/* RNDIS activé pour Firmware C (network implant) */
#ifdef FIRMWARE_C
#  define CFG_TUD_ECM_RNDIS       1
#  define CFG_TUD_NET_MTU         1514
#else
#  define CFG_TUD_ECM_RNDIS       0
#endif

#define CFG_TUD_MIDI              0
#define CFG_TUD_VENDOR            0

/* ── Debug ───────────────────────────────────────────────────────────────── */
#define CFG_TUSB_DEBUG            0
