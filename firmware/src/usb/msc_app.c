#include "tusb.h"
#include "ramdisk.h"
#include <string.h>

/* ── TinyUSB MSC callbacks — LUN 0 = RAM disk ───────────────────────────────
 * Compilé uniquement pour Firmware B (voir CMakeLists.txt).
 */

void tud_msc_inquiry_cb(uint8_t lun,
                        uint8_t vendor_id[8],
                        uint8_t product_id[16],
                        uint8_t product_rev[4])
{
    (void)lun;
    memcpy(vendor_id,   "FORGE   ", 8);
    memcpy(product_id,  "SideStick USB   ", 16);
    memcpy(product_rev, "1.0 ", 4);
}

bool tud_msc_test_unit_ready_cb(uint8_t lun)
{
    (void)lun;
    return true;
}

void tud_msc_capacity_cb(uint8_t lun, uint32_t* block_count, uint16_t* block_size)
{
    (void)lun;
    *block_count = RAMDISK_SECTOR_COUNT;
    *block_size  = RAMDISK_SECTOR_SIZE;
}

bool tud_msc_start_stop_cb(uint8_t lun, uint8_t power_condition,
                            bool start, bool load_eject)
{
    (void)lun; (void)power_condition; (void)start; (void)load_eject;
    return true;
}

bool tud_msc_is_writable_cb(uint8_t lun)
{
    (void)lun;
    return true;
}

int32_t tud_msc_read10_cb(uint8_t lun, uint32_t lba, uint32_t offset,
                           void* buffer, uint32_t bufsize)
{
    (void)lun; (void)offset;
    uint32_t sectors = bufsize / RAMDISK_SECTOR_SIZE;
    return ramdisk_read(lba, (uint8_t*)buffer, sectors) ? (int32_t)bufsize : -1;
}

int32_t tud_msc_write10_cb(uint8_t lun, uint32_t lba, uint32_t offset,
                            uint8_t* buffer, uint32_t bufsize)
{
    (void)lun; (void)offset;
    uint32_t sectors = bufsize / RAMDISK_SECTOR_SIZE;
    return ramdisk_write(lba, buffer, sectors) ? (int32_t)bufsize : -1;
}

/* Handle unrecognised SCSI commands (return -1 = stall) */
int32_t tud_msc_scsi_cb(uint8_t lun, uint8_t const scsi_cmd[16],
                         void* buffer, uint16_t bufsize)
{
    (void)lun; (void)scsi_cmd; (void)buffer; (void)bufsize;
    return -1;
}
