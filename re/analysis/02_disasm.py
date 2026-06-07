#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Desassemblage cible (Thumb-2 / Cortex-M4) du firmware TCA Sidestick X.
But : localiser les acces aux bases peripheriques (GPIO/ADC/EXTI/RCC...) via les
literal pools, et afficher des fenetres de desassemblage autour des inits GPIO/ADC
pour decoder le PINOUT (MODER/PUPDR/AFR, canaux ADC).
"""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_INS_LDR, ARM_OP_MEM, ARM_OP_REG, ARM_REG_PC

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
N = len(data)
def u32(o): return struct.unpack_from("<I", data, o)[0]
def off(a): return a - BASE

PERIPH = {0x40020000:"GPIOA",0x40020400:"GPIOB",0x40020800:"GPIOC",0x40020C00:"GPIOD",
0x40021000:"GPIOE",0x40021C00:"GPIOH",0x40023800:"RCC",0x40023C00:"FLASH_IF",
0x40026000:"DMA1",0x40026400:"DMA2",0x40012000:"ADC",0x40012300:"ADC_COMMON",
0x40013000:"SPI1",0x40003800:"SPI2_I2S2",0x40003C00:"SPI3_I2S3",
0x40005400:"I2C1",0x40015800:"SAI1",0x40015C00:"SAI2",0x40007000:"PWR",
0x40013800:"SYSCFG",0x40013C00:"EXTI",0x40040000:"USB_OTG_HS",0x50000000:"USB_OTG_FS"}

# Offsets registres GPIO (STM32F4)
GPIO_REG = {0x00:"MODER",0x04:"OTYPER",0x08:"OSPEEDR",0x0C:"PUPDR",0x10:"IDR",
0x14:"ODR",0x18:"BSRR",0x1C:"LCKR",0x20:"AFRL",0x24:"AFRH"}

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB + CS_MODE_MCLASS)
md.detail = True

REGIONS = [(0x08000000, 0x0800993A), (0x08010000, 0x0801ACCE)]

def lit_load(insn):
    """Retourne (reg_dest, addr_litteral) si insn = ldr rX,[pc,#imm], sinon None."""
    if insn.id != ARM_INS_LDR: return None
    ops = insn.operands
    if len(ops) != 2: return None
    if ops[0].type != ARM_OP_REG: return None
    m = ops[1]
    if m.type != ARM_OP_MEM or m.mem.base != ARM_REG_PC: return None
    lit = (((insn.address + 4) & ~3) + m.mem.disp)
    return (insn.reg_name(ops[0].reg), lit)

# --- Pass 1 : tous les acces aux bases peripheriques ---
print("="*72); print("ACCES AUX BASES PERIPHERIQUES (ldr rX, =base)"); print("="*72)
loads = []   # (addr, periph, base, reg)
for (s, e) in REGIONS:
    code = data[off(s):off(e)]
    for insn in md.disasm(code, s):
        ll = lit_load(insn)
        if ll:
            reg, lit = ll
            lo = off(lit)
            if 0 <= lo <= N - 4:
                val = u32(lo)
                if val in PERIPH:
                    loads.append((insn.address, PERIPH[val], val, reg))
from collections import Counter
by = Counter(p for _, p, _, _ in loads)
for p, c in by.most_common():
    print(f"  {p:<12} x{c}")
print(f"  total: {len(loads)} acces\n")

# --- Pass 2 : fenetres de desassemblage autour des inits GPIO/ADC/EXTI ---
def window(addr, n=22, back=2):
    start = addr - back
    code = data[off(start):off(start) + n*4 + 8]
    out = []
    for insn in md.disasm(code, start):
        if len(out) >= n: break
        out.append(insn)
    return out

TARGETS = ("GPIOA","GPIOB","GPIOC","GPIOD","ADC","ADC_COMMON","EXTI","SYSCFG")
seen = set()
for addr, periph, base, reg in loads:
    if periph not in TARGETS: continue
    key = (periph, addr)
    if addr in seen: continue
    seen.add(addr)
    print("="*72)
    print(f"# {periph} (=0x{base:08X}) charge dans {reg} @ 0x{addr:08X}")
    print("="*72)
    for insn in window(addr):
        ann = ""
        # annote les acces registres GPIO (str/ldr rY,[reg,#off])
        for o2 in insn.operands:
            if o2.type == ARM_OP_MEM and o2.mem.disp in GPIO_REG and periph.startswith("GPIO"):
                ann = f"   <-- {periph}->{GPIO_REG[o2.mem.disp]}"
        print(f"  0x{insn.address:08X}  {insn.mnemonic:<7} {insn.op_str}{ann}")
    print()
