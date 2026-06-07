#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Desassemble les helpers GPIO pour en deduire l'ABI (mapping args -> MODER/PUPDR/AFR...)."""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_MEM

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
def off(a): return a - BASE
md = Cs(CS_ARCH_ARM, CS_MODE_THUMB + CS_MODE_MCLASS); md.detail = True

GREG = {0x00:"MODER",0x04:"OTYPER",0x08:"OSPEEDR",0x0C:"PUPDR",0x10:"IDR",
        0x14:"ODR",0x18:"BSRR",0x1C:"LCKR",0x20:"AFRL",0x24:"AFRH"}

for t in (0x080117B0, 0x080119E0, 0x080119F8):
    print("="*64); print(f"FONCTION HELPER  0x{t:08X}"); print("="*64)
    code = data[off(t):off(t) + 0x120]
    cnt = 0
    for insn in md.disasm(code, t):
        ann = ""
        for op in insn.operands:
            if op.type == ARM_OP_MEM and op.mem.disp in GREG and op.mem.base:
                ann = f"   ; GPIO->{GREG[op.mem.disp]}"
        print(f"  0x{insn.address:08X}  {insn.mnemonic:<8} {insn.op_str}{ann}")
        cnt += 1
        if insn.mnemonic.startswith("pop") and "pc" in insn.op_str: break
        if insn.mnemonic == "bx" and insn.op_str.strip() == "lr": break
        if cnt > 70: break
    print()
