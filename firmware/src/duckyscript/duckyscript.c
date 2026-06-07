#include "duckyscript.h"
#include "usb/hid_app.h"
#include "stm32f4xx_hal.h"
#include "tusb.h"
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

/* ── État interne ─────────────────────────────────────────────────────────── */
static char     s_script[PAYLOAD_MAX_LEN];
static uint16_t s_len       = 0;
static bool     s_running   = false;
static uint16_t s_default_delay = 50;   /* ms entre frappes */
static uint8_t  s_layout    = 0;        /* 0=QWERTY 1=AZERTY */

/* Délai actif : maintient le stack USB vivant pendant l'attente */
static void ducky_delay(uint32_t ms)
{
    uint32_t start = HAL_GetTick();
    while (HAL_GetTick() - start < ms) {
        tud_task();
    }
}

/* ── Tables ASCII → keycode HID QWERTY US ────────────────────────────────── */
typedef struct { uint8_t key; uint8_t mod; } keymap_t;

/* Caractère imprimable ASCII 32..126 → keycode + modifier */
static const keymap_t ascii_map[95] = {
/* ' '  '!'   '"'   '#'   '$'   '%'   '&'   '\'' */
{0x2C,0},{0x1E,2},{0x34,2},{0x20,2},{0x21,2},{0x22,2},{0x24,2},{0x34,0},
/* '('  ')'   '*'   '+'   ','   '-'   '.'   '/' */
{0x26,2},{0x27,2},{0x25,2},{0x2E,2},{0x36,0},{0x2D,0},{0x37,0},{0x38,0},
/* '0'..'9' */
{0x27,0},{0x1E,0},{0x1F,0},{0x20,0},{0x21,0},{0x22,0},{0x23,0},{0x24,0},{0x25,0},{0x26,0},
/* ':'   ';'   '<'   '='   '>'   '?' */
{0x33,2},{0x33,0},{0x36,2},{0x2E,0},{0x37,2},{0x38,2},
/* '@' */
{0x1F,2},
/* 'A'..'Z' */
{0x04,2},{0x05,2},{0x06,2},{0x07,2},{0x08,2},{0x09,2},{0x0A,2},{0x0B,2},{0x0C,2},
{0x0D,2},{0x0E,2},{0x0F,2},{0x10,2},{0x11,2},{0x12,2},{0x13,2},{0x14,2},{0x15,2},
{0x16,2},{0x17,2},{0x18,2},{0x19,2},{0x1A,2},{0x1B,2},{0x1C,2},{0x1D,2},
/* '['   '\\'  ']'   '^'   '_' */
{0x2F,0},{0x31,0},{0x30,0},{0x23,2},{0x2D,2},
/* '`' */
{0x35,0},
/* 'a'..'z' */
{0x04,0},{0x05,0},{0x06,0},{0x07,0},{0x08,0},{0x09,0},{0x0A,0},{0x0B,0},{0x0C,0},
{0x0D,0},{0x0E,0},{0x0F,0},{0x10,0},{0x11,0},{0x12,0},{0x13,0},{0x14,0},{0x15,0},
{0x16,0},{0x17,0},{0x18,0},{0x19,0},{0x1A,0},{0x1B,0},{0x1C,0},{0x1D,0},
/* '{'   '|'   '}'   '~' */
{0x2F,2},{0x31,2},{0x30,2},{0x35,2},
};

/* ── Table AZERTY FR → keycode HID ──────────────────────────────────────── */
/* Différences vs QWERTY: a↔q, w↔z, m→0x33, + nombres sous Shift, ponctuation */
/* 0x40 = RALT (AltGr) */
static const keymap_t ascii_map_azerty[95] = {
/* ' '  '!'      '"'      '#'         '$'      '%'      '&'      '\'' */
{0x2C,0},{0x38,0},{0x20,0},{0x20,0x40},{0x30,0},{0x34,2},{0x1E,0},{0x21,0},
/* '('  ')'      '*'      '+'      ','      '-'      '.'      '/' */
{0x22,0},{0x2D,0},{0x32,0},{0x2E,2},{0x10,0},{0x23,0},{0x36,2},{0x37,2},
/* '0'..'9' — tous sous Shift sur AZERTY */
{0x27,2},{0x1E,2},{0x1F,2},{0x20,2},{0x21,2},{0x22,2},{0x23,2},{0x24,2},{0x25,2},{0x26,2},
/* ':'      ';'      '<'      '='      '>'      '?' */
{0x37,0},{0x36,0},{0x64,0},{0x2E,0},{0x64,2},{0x10,2},
/* '@' */
{0x27,0x40},
/* 'A'..'Z' — positions AZERTY (a=0x14, m=0x33, q=0x04, w=0x1D, z=0x1A) */
{0x14,2},{0x05,2},{0x06,2},{0x07,2},{0x08,2},{0x09,2},{0x0A,2},{0x0B,2},{0x0C,2},
{0x0D,2},{0x0E,2},{0x0F,2},{0x33,2},{0x11,2},{0x12,2},{0x13,2},{0x04,2},{0x15,2},
{0x16,2},{0x17,2},{0x18,2},{0x19,2},{0x1D,2},{0x1B,2},{0x1C,2},{0x1A,2},
/* '['         '\\'        ']'         '^'         '_' */
{0x22,0x40},{0x25,0x40},{0x2D,0x40},{0x26,0x40},{0x25,0},
/* '`' */
{0x24,0x40},
/* 'a'..'z' */
{0x14,0},{0x05,0},{0x06,0},{0x07,0},{0x08,0},{0x09,0},{0x0A,0},{0x0B,0},{0x0C,0},
{0x0D,0},{0x0E,0},{0x0F,0},{0x33,0},{0x11,0},{0x12,0},{0x13,0},{0x04,0},{0x15,0},
{0x16,0},{0x17,0},{0x18,0},{0x19,0},{0x1D,0},{0x1B,0},{0x1C,0},{0x1A,0},
/* '{'         '|'         '}'         '~' */
{0x21,0x40},{0x23,0x40},{0x2E,0x40},{0x1F,0x40},
};

static const keymap_t* cur_map(void) {
    return s_layout ? ascii_map_azerty : ascii_map;
}

static void type_char(char c)
{
    if (c < 32 || c > 126) return;
    keymap_t k = cur_map()[(uint8_t)(c - 32)];
    hid_send_key(k.mod, k.key);
    ducky_delay(s_default_delay / 2);
    hid_release_keys();
    ducky_delay(s_default_delay / 2);
}

static void type_string(const char* s)
{
    while (*s) type_char(*s++);
}

/* ── Parsing d'une ligne DuckyScript ──────────────────────────────────────── */
static void exec_line(const char* line, uint16_t len)
{
    if (len == 0 || line[0] == 'R' && strncmp(line,"REM",3)==0) return;

    /* DELAY <ms> */
    if (strncmp(line,"DELAY ",6)==0) {
        ducky_delay((uint32_t)atoi(line+6));
        return;
    }
    /* DEFAULTDELAY / DEFAULT_DELAY */
    if (strncmp(line,"DEFAULT_DELAY ",14)==0 || strncmp(line,"DEFAULTDELAY ",13)==0) {
        uint8_t off = (line[7]=='_') ? 14 : 13;
        s_default_delay = (uint16_t)atoi(line+off);
        return;
    }
    /* STRING <text> */
    if (strncmp(line,"STRING ",7)==0) {
        type_string(line+7);
        return;
    }
    /* ENTER */
    if (strncmp(line,"ENTER",5)==0) {
        hid_send_key(0, KEY_ENTER); ducky_delay(s_default_delay); hid_release_keys();
        return;
    }
    /* TAB */
    if (strncmp(line,"TAB",3)==0) {
        hid_send_key(0, KEY_TAB); ducky_delay(s_default_delay); hid_release_keys();
        return;
    }
    /* BACKSPACE */
    if (strncmp(line,"BACKSPACE",9)==0 || strncmp(line,"BACK_SPACE",10)==0) {
        hid_send_key(0, KEY_BSPACE); ducky_delay(s_default_delay); hid_release_keys();
        return;
    }
    /* ESCAPE */
    if (strncmp(line,"ESCAPE",6)==0 || strncmp(line,"ESC",3)==0) {
        hid_send_key(0, KEY_ESC); ducky_delay(s_default_delay); hid_release_keys();
        return;
    }
    /* GUI / WINDOWS */
    if (strncmp(line,"GUI",3)==0 || strncmp(line,"WINDOWS",7)==0) {
        const char* arg = NULL;
        if (line[3]==' ') arg = line+4;
        else if (line[7]==' ') arg = line+8;
        if (arg && *arg) {
            keymap_t k = cur_map()[(uint8_t)(tolower(*arg) - 32)];
            /* Phase 1 : Win seul — Windows enregistre le modificateur */
            hid_send_key(MOD_LGUI, 0);
            ducky_delay(30);
            /* Phase 2 : Win + touche — Windows traite le raccourci */
            hid_send_key(MOD_LGUI | k.mod, k.key);
        } else {
            hid_send_key(MOD_LGUI, 0);
        }
        ducky_delay(s_default_delay);
        hid_release_keys();
        return;
    }
    /* CTRL / CONTROL */
    if (strncmp(line,"CTRL",4)==0 || strncmp(line,"CONTROL",7)==0) {
        const char* arg = (line[4]==' ') ? line+5 : line+8;
        keymap_t k = cur_map()[(uint8_t)(tolower(*arg) - 32)];
        hid_send_key(MOD_LCTRL | k.mod, k.key);
        ducky_delay(s_default_delay);
        hid_release_keys();
        return;
    }
    /* ALT */
    if (strncmp(line,"ALT",3)==0 && line[3]==' ') {
        const char* arg = line+4;
        if (strncmp(arg,"F4",2)==0)      { hid_send_key(MOD_LALT, KEY_F4); }
        else if (strncmp(arg,"TAB",3)==0){ hid_send_key(MOD_LALT, KEY_TAB); }
        else { keymap_t k=ascii_map[(uint8_t)(tolower(*arg)-32)]; hid_send_key(MOD_LALT|k.mod,k.key); }
        ducky_delay(s_default_delay);
        hid_release_keys();
        return;
    }
    /* SHIFT */
    if (strncmp(line,"SHIFT",5)==0 && line[5]==' ') {
        const char* arg = line+6;
        if (strncmp(arg,"TAB",3)==0) { hid_send_key(MOD_LSHIFT, KEY_TAB); }
        else { keymap_t k=ascii_map[(uint8_t)(tolower(*arg)-32)]; hid_send_key(MOD_LSHIFT|k.mod,k.key); }
        ducky_delay(s_default_delay);
        hid_release_keys();
        return;
    }
    /* UPARROW / DOWNARROW / LEFTARROW / RIGHTARROW */
    if (strncmp(line,"UPARROW",7)==0   || strncmp(line,"UP",2)==0)    { hid_send_key(0,KEY_UP);    ducky_delay(s_default_delay); hid_release_keys(); return; }
    if (strncmp(line,"DOWNARROW",9)==0 || strncmp(line,"DOWN",4)==0)  { hid_send_key(0,KEY_DOWN);  ducky_delay(s_default_delay); hid_release_keys(); return; }
    if (strncmp(line,"LEFTARROW",9)==0 || strncmp(line,"LEFT",4)==0)  { hid_send_key(0,KEY_LEFT);  ducky_delay(s_default_delay); hid_release_keys(); return; }
    if (strncmp(line,"RIGHTARROW",10)==0|| strncmp(line,"RIGHT",5)==0){ hid_send_key(0,KEY_RIGHT); ducky_delay(s_default_delay); hid_release_keys(); return; }
    /* Fn keys */
    uint8_t fn_keys[] = {KEY_F1,KEY_F2,KEY_F3,KEY_F4,KEY_F5,KEY_F6,KEY_F7,KEY_F8,KEY_F9,KEY_F10,KEY_F11,KEY_F12};
    for (int i=0;i<12;i++) {
        char fn[4]; fn[0]='F'; fn[1]='0'+(i<9?i+1:0); fn[2]=(i>=9)?'0'+(i-9+1):'\0'; fn[3]='\0';
        if (i==9)  { fn[1]='1'; fn[2]='0'; fn[3]='\0'; }
        if (i==10) { fn[1]='1'; fn[2]='1'; fn[3]='\0'; }
        if (i==11) { fn[1]='1'; fn[2]='2'; fn[3]='\0'; }
        if (strncmp(line,fn,strlen(fn))==0) {
            hid_send_key(0,fn_keys[i]); ducky_delay(s_default_delay); hid_release_keys(); return;
        }
    }
}

/* ── API publique ─────────────────────────────────────────────────────────── */

void ducky_load(const char* script, uint16_t len)
{
    uint16_t l = (len < PAYLOAD_MAX_LEN) ? len : PAYLOAD_MAX_LEN - 1;
    memcpy(s_script, script, l);
    s_script[l] = '\0';
    s_len = l;
}

void ducky_run(void)
{
    if (s_running || s_len == 0) return;
    s_running = true;

    /* Exécuter ligne par ligne */
    const char* p   = s_script;
    const char* end = s_script + s_len;

    while (p < end) {
        const char* nl = p;
        while (nl < end && *nl != '\n' && *nl != '\r') nl++;
        uint16_t line_len = (uint16_t)(nl - p);
        /* strip trailing \r */
        while (line_len > 0 && (p[line_len-1] == '\r' || p[line_len-1] == ' ')) line_len--;

        char line_buf[256];
        uint16_t copy_len = (line_len < 255) ? line_len : 255;
        memcpy(line_buf, p, copy_len);
        line_buf[copy_len] = '\0';

        exec_line(line_buf, copy_len);

        /* skip \n / \r\n */
        p = nl;
        while (p < end && (*p == '\n' || *p == '\r')) p++;
    }

    s_running = false;
}

bool ducky_is_running(void) { return s_running; }

void ducky_set_default_delay(uint16_t ms)
{
    if (ms > 0) s_default_delay = ms;
}

void ducky_set_layout(uint8_t layout)
{
    s_layout = layout;
}
