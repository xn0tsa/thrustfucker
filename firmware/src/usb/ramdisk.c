#include "ramdisk.h"
#include <string.h>

/* ── 64 KB RAM disk (128 × 512-byte sectors) ─────────────────────────────────
 * Layout :
 *   Sector 0 : Boot Record (BPB FAT12)
 *   Sector 1 : FAT1
 *   Sector 2 : Root Directory (16 entries × 32 bytes)
 *   Sectors 3–127 : Data (125 × 512 = 62.5 KB)
 */
static uint8_t disk[RAMDISK_SECTOR_COUNT * RAMDISK_SECTOR_SIZE];

void ramdisk_init(const char* label)
{
    memset(disk, 0, sizeof(disk));

    /* ── Boot Record ──────────────────────────────────────────────────────── */
    uint8_t* b = disk;   /* sector 0 */
    b[0] = 0xEB; b[1] = 0x3C; b[2] = 0x90;       /* jmp short + nop         */
    memcpy(b + 3, "FORGE01 ", 8);                  /* OEM name                */
    /* BIOS Parameter Block */
    b[0x0B] = 0x00; b[0x0C] = 0x02;               /* BytesPerSec = 512       */
    b[0x0D] = 0x01;                                /* SecPerClus  = 1         */
    b[0x0E] = 0x01; b[0x0F] = 0x00;               /* RsvdSecCnt  = 1         */
    b[0x10] = 0x01;                                /* NumFATs     = 1         */
    b[0x11] = 0x10; b[0x12] = 0x00;               /* RootEntCnt  = 16        */
    b[0x13] = RAMDISK_SECTOR_COUNT & 0xFF;
    b[0x14] = (RAMDISK_SECTOR_COUNT >> 8) & 0xFF; /* TotSec16    = 128       */
    b[0x15] = 0xF0;                                /* Media       = removable */
    b[0x16] = 0x01; b[0x17] = 0x00;               /* FATSz16     = 1         */
    b[0x18] = 0x04; b[0x19] = 0x00;               /* SecPerTrk   = 4         */
    b[0x1A] = 0x04; b[0x1B] = 0x00;               /* NumHeads    = 4         */
    /* HiddSec=0, TotSec32=0 */
    b[0x24] = 0x00;                                /* DrvNum                  */
    b[0x26] = 0x29;                                /* BootSig                 */
    b[0x27] = 0xDE; b[0x28] = 0xAD;
    b[0x29] = 0xBE; b[0x2A] = 0xEF;               /* VolID                   */
    /* Volume label (11 bytes, space-padded) */
    memset(b + 0x2B, ' ', 11);
    if (label && *label) {
        uint8_t n = 0;
        while (n < 11 && label[n]) { b[0x2B + n] = (uint8_t)label[n]; n++; }
    }
    memcpy(b + 0x36, "FAT12   ", 8);              /* FilSysType              */
    b[510] = 0x55; b[511] = 0xAA;                 /* Boot signature          */

    /* ── FAT1 (sector 1) ─────────────────────────────────────────────────── */
    /* FAT12 : cluster 0 = 0xFF0 (media), cluster 1 = 0xFFF (EOC)
     * Packed in 3 bytes: F0 FF FF                                           */
    uint8_t* fat = disk + 1 * RAMDISK_SECTOR_SIZE;
    fat[0] = 0xF0; fat[1] = 0xFF; fat[2] = 0xFF;

    /* ── Root directory (sector 2) ────────────────────────────────────────── */
    /* First entry = volume label */
    uint8_t* root = disk + 2 * RAMDISK_SECTOR_SIZE;
    memset(root, ' ', 11);
    if (label && *label) {
        uint8_t n = 0;
        while (n < 11 && label[n]) { root[n] = (uint8_t)label[n]; n++; }
    }
    root[11] = 0x08;  /* Attr: ATTR_VOLUME_ID */
}

bool ramdisk_read(uint32_t lba, uint8_t* buf, uint32_t sectors)
{
    if (lba + sectors > RAMDISK_SECTOR_COUNT) return false;
    memcpy(buf, disk + lba * RAMDISK_SECTOR_SIZE, sectors * RAMDISK_SECTOR_SIZE);
    return true;
}

bool ramdisk_write(uint32_t lba, const uint8_t* buf, uint32_t sectors)
{
    if (lba + sectors > RAMDISK_SECTOR_COUNT) return false;
    /* Protect sector 0 (boot) from accidental overwrite */
    uint32_t start = lba > 0 ? lba : 1;
    if (lba == 0 && sectors > 1)
        memcpy(disk + RAMDISK_SECTOR_SIZE, buf + RAMDISK_SECTOR_SIZE,
               (sectors - 1) * RAMDISK_SECTOR_SIZE);
    else if (lba > 0)
        memcpy(disk + lba * RAMDISK_SECTOR_SIZE, buf, sectors * RAMDISK_SECTOR_SIZE);
    (void)start;
    return true;
}
