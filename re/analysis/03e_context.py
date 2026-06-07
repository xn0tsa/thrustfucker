#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_IMM
BASE=0x08000000
data=open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin","rb").read()
def foff(a): return a-BASE
md=Cs(CS_ARCH_ARM, CS_MODE_THUMB|CS_MODE_MCLASS); md.detail=True
def disasm_all(s,e):
    pos=s
    while pos<e:
        dec=False
        for ins in md.disasm(data[foff(pos):foff(e)],pos):
            yield ins; pos=ins.address+ins.size; dec=True
        pos+=2
HAL=0x080119F8
win=[]; shown=0
for ins in disasm_all(0x08000000,0x08009938):
    win.append(ins)
    if len(win)>18: win.pop(0)
    if ins.mnemonic in ("bl","blx") and ins.operands and ins.operands[0].type==ARM_OP_IMM and ins.operands[0].imm==HAL:
        print("="*64, f"\ncall HAL_GPIO_Init @0x{ins.address:08X}")
        for w in win: print(f"  0x{w.address:08X}  {w.mnemonic:<8} {w.op_str}")
        shown+=1
        if shown>=8: break
