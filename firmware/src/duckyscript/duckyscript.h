#pragma once
#include <stdint.h>
#include <stdbool.h>
#include "config.h"

void ducky_load             (const char* script, uint16_t len);
void ducky_run              (void);
bool ducky_is_running       (void);
void ducky_set_default_delay(uint16_t ms);
void ducky_set_layout       (uint8_t layout);   /* 0=QWERTY 1=AZERTY */
