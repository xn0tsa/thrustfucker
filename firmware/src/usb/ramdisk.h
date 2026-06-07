#pragma once
#include <stdint.h>
#include <stdbool.h>

void ramdisk_init  (const char* label);
bool ramdisk_read  (uint32_t lba, uint8_t* buf,       uint32_t sectors);
bool ramdisk_write (uint32_t lba, const uint8_t* buf, uint32_t sectors);

#define RAMDISK_SECTOR_COUNT  128u
#define RAMDISK_SECTOR_SIZE   512u
