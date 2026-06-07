#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Localise l'init ADC et dump le code (canaux = axes Hall). ADC1 base 0x40012000."""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_INS_LDR, ARM_INS_BL, ARM_OP_MEM, ARM_OP_IMM, ARM_REG_PC

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read(); N = len(data)
def u32(o): return struct.unpack_from("<I", data, o)[0]
def off(a): return a - BASE
def inb(a): return 0 <= a - BASE < N - 1
md = Cs(CS_ARCH_ARM, CS_MODE_THUMB + CS_MODE_MCLASS); md.detail = True

ADC1, ADC_COM = 0x40012000, 0x40012300
AREG = {0x00:"SR",0x04:"CR1",0x08:"CR2",0x0C:"SMPR1",0x10:"SMPR2",0x2C:"SQR1",
        0x30:"SQR2",0x34:"SQR3",0x38:"JSQR",0x4C:"DR"}
# ADC1 channel -> pin
CH2PIN = {0:"PA0",1:"PA1",2:"PA2",3:"PA3",4:"PA4",5:"PA5",6:"PA6",7:"PA7",8:"PB0",
          9:"PB1",10:"PC0",11:"PC1",12:"PC2",13:"PC3",14:"PC4",15:"PC5",16:"TempSensor",17:"Vref",18:"Vbat"}
REGIONS = [(0x08000000, 0x0800993A), (0x08010000, 0x0801ACCE)]

# function starts
starts = set()
for i in range(1, 16 + 97):
    v = u32(i*4)
    if 0x08000000 <= v < 0x08080000 and v & 1: starts.add(v & ~1)
for s, e in REGIONS:
    for insn in md.disasm(data[off(s):off(e)], s):
        if insn.id == ARM_INS_BL:
            for op in insn.operands:
                if op.type == ARM_OP_IMM and inb(op.imm): starts.add(op.imm & ~1)
def prol(a):
    for i in md.disasm(data[off(a):off(a)+4], a, count=1): return i.mnemonic.startswith(("push","stmdb"))
    return False
starts = sorted(a for a in starts if inb(a) and prol(a))

# fonctions chargeant la base ADC
def func_loads(addr_set):
    res = []
    for i, st in enumerate(starts):
        end = min(starts[i+1] if i+1 < len(starts) else st+0x1000, st+0x1400)
        for insn in md.disasm(data[off(st):off(end)], st):
            if insn.id == ARM_INS_LDR and len(insn.operands) == 2:
                o = insn.operands[1]
                if o.type == ARM_OP_MEM and o.mem.base == ARM_REG_PC:
                    lit = (((insn.address+4) & ~3) + o.mem.disp)
                    if inb(lit) and u32(off(lit)) in addr_set:
                        res.append((st, end, insn.address)); break
    return res

hits = func_loads({ADC1, ADC_COM})
print(f"Fonctions touchant l'ADC : {len(hits)}\n")
for st, end, where in hits:
    print("="*70); print(f"FONCTION 0x{st:08X}  (charge ADC @ 0x{where:08X})"); print("="*70)
    reg = {}
    for insn in md.disasm(data[off(st):off(end)], st):
        ann = ""
        for op in insn.operands:
            if op.type == ARM_OP_MEM and op.mem.disp in AREG:
                ann = f"   ; ADC->{AREG[op.mem.disp]}"
        # annote un eventuel numero de canal (movs rX,#0..18)
        if insn.mnemonic in ("movs","mov") and insn.op_str.endswith(tuple(f"#{c}" for c in range(19))):
            try:
                c = int(insn.op_str.split("#")[1]);
                if c in CH2PIN: ann += f"   ; canal {c}? -> {CH2PIN[c]}"
            except Exception: pass
        print(f"  0x{insn.address:08X}  {insn.mnemonic:<8} {insn.op_str}{ann}")
        if insn.mnemonic.startswith("pop") and "pc" in insn.op_str: break
        if insn.mnemonic == "bx" and insn.op_str.strip() == "lr": break
    print()
