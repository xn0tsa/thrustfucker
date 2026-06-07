#!/usr/bin/env python3
"""Read pool constants from FUN_08008944 to identify GPIO ports and peripherals."""
import struct

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
def u32(a): return struct.unpack_from("<I", data, a - BASE)[0]

GPIO_NAMES = {0x40020000:"GPIOA", 0x40020400:"GPIOB", 0x40020800:"GPIOC",
              0x40020C00:"GPIOD", 0x40021000:"GPIOE", 0x40021C00:"GPIOH"}
SPI_NAMES  = {0x40013000:"SPI1", 0x40003800:"SPI2", 0x40003C00:"SPI3"}
I2C_NAMES  = {0x40005400:"I2C1", 0x40005800:"I2C2", 0x40005C00:"I2C3"}
USB_NAMES  = {0x50000000:"USB_OTG_HS", 0x50000000:"USB_OTG_FS"}

# Pool constants from FUN_08008944 area
addrs = {
    "DAT_08008d54": 0x08008d54,
    "DAT_08008d58": 0x08008d58,
    "DAT_08008d5c": 0x08008d5c,
    "DAT_08008d60": 0x08008d60,
    "DAT_08008d64": 0x08008d64,
    "DAT_08008d68": 0x08008d68,
    "DAT_08008d6c": 0x08008d6c,
    "DAT_08008d70": 0x08008d70,
    "DAT_08008d74": 0x08008d74,
    "DAT_08008d78": 0x08008d78,
    "DAT_08008d7c": 0x08008d7c,
    "DAT_08008d80": 0x08008d80,
}

for name, addr in sorted(addrs.items(), key=lambda x: x[1]):
    val = u32(addr)
    desc = GPIO_NAMES.get(val, SPI_NAMES.get(val, I2C_NAMES.get(val, "")))
    if not desc and 0x20000000 <= val <= 0x20020000:
        desc = f"RAM 0x{val:08X}"
    print(f"  {name} @ 0x{addr:08X} = 0x{val:08X}  {desc}")

# Also dump the SPI GPIO init: around lines 196-202 in decompiled
# That's HAL_I2C pin init. Look for SPI AF pin setup
# FUN_080132dc = HAL_RCC_xxx ? Let's check near 0x080132dc
print("\n=== HAL_RCC calls near SPI init (FUN_080132dc/be) ===")
# FUN_080132dc(6, 0xf, 0) → might be RCC_GPIOB or GPIOC enable
# args: (6, 0xf, 0) → enable peripheral at position 6 in APB2?
# STM32 APB2: bit 12 = SPI1
# AHB1: bit 0=GPIOA, 1=GPIOB, 2=GPIOC, 3=GPIOD

# Look at FUN_080132dc disassembly start
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS)
print("FUN_080132dc (20 insns):")
pos = 0x080132dc
for i, ins in enumerate(md.disasm(data[pos-BASE:pos-BASE+80], pos)):
    print(f"  0x{ins.address:08X}  {ins.mnemonic:<10} {ins.op_str}")
    if i > 20: break
