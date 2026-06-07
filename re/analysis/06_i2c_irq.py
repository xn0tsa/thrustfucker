#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
06_i2c_irq.py
- Lit les adresses des handlers I2C1_EV, I2C1_ER depuis la table des vecteurs
- Desassemble le contexte autour de l'appel @0x080003A8
- Cherche les BL + r1 constant dans les fonctions appelant les drivers I2C
"""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

BASE = 0x08000000
data = open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin", "rb").read()
N = len(data)

def u32(o): return struct.unpack_from("<I", data, o)[0]
def foff(a): return a - BASE

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS)
md.detail = True

# STM32F446 vecteur IRQ (position = 16 + IRQ#)
# I2C1_EV = IRQ31 -> offset 0xBC; I2C1_ER = IRQ32 -> offset 0xC0
I2C1_EV_vec = u32(0xBC)
I2C1_ER_vec = u32(0xC0)
I2C1_EV_fn = I2C1_EV_vec & ~1
I2C1_ER_fn = I2C1_ER_vec & ~1

print(f"I2C1_EV handler : 0x{I2C1_EV_fn:08X}  (vec=0x{I2C1_EV_vec:08X})")
print(f"I2C1_ER handler : 0x{I2C1_ER_fn:08X}  (vec=0x{I2C1_ER_vec:08X})")

# Desassembler les IRQ handlers (40 instructions each)
def disasm_range(start, n=40):
    count = 0
    pos = start
    while count < n and pos < BASE + N:
        for ins in md.disasm(data[foff(pos):foff(pos)+4], pos, count=1):
            print(f"  0x{ins.address:08X}  {ins.mnemonic:<10} {ins.op_str}")
            pos += ins.size; count += 1; break
        else:
            pos += 2

print("\n--- I2C1_EV handler ---")
if 0x08000000 <= I2C1_EV_fn < 0x08000000 + N:
    disasm_range(I2C1_EV_fn, 30)
else:
    print("  (adresse hors plage flash)")

print("\n--- I2C1_ER handler ---")
if 0x08000000 <= I2C1_ER_fn < 0x08000000 + N:
    disasm_range(I2C1_ER_fn, 20)
else:
    print("  (adresse hors plage flash)")

# Contexte autour de l'appel @0x080003A8 (30 instructions avant)
print("\n--- Contexte @0x080003A8 (appelant la fn I2C HAL) ---")
disasm_range(0x08000360, 60)

# Scan complet : tous les BL + r1 (potentiel DevAddress)
# On cherche des patterns : movs r1, #val / mov r1, #val avant un BL
print("\n--- BL avec r1 constant 0x10..0xFF (candidats DevAddress I2C) ---")
def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

CODE_RANGES = [(0x08000000, 0x08009938), (0x08010000, 0x0801ACCC)]
regs = [None]*16
found_i2c_candidates = []
for s, e in CODE_RANGES:
    pos = s
    while pos < e:
        for ins in md.disasm(data[foff(pos):foff(e)], pos, count=1):
            m = ins.mnemonic; ops = ins.operands
            try:
                o0 = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None
                if m == "push": regs = [None]*16
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mem = ops[1].mem
                    if md.reg_name(mem.base) == "pc":
                        la = ((ins.address+4)&~3)+mem.disp
                        regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
                elif m in ("movw","movs","mov") and ops[1].type==ARM_OP_IMM:
                    regs[o0] = ops[1].imm
                elif m == "movt" and ops[1].type==ARM_OP_IMM:
                    regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
                if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                    r1 = regs[1]
                    if isinstance(r1, int) and 0x20 <= r1 <= 0xFE and (r1 & 1) == 0:
                        found_i2c_candidates.append((ins.address, ops[0].imm, r1))
                    for k in (0,1,2,3,12): regs[k] = None
            except Exception: pass
            pos += ins.size; break
        else:
            pos += 2

# Grouper par valeur r1
from collections import defaultdict
by_r1 = defaultdict(list)
for a, tgt, r1 in found_i2c_candidates:
    by_r1[r1].append((a, tgt))

print(f"Total BL avec r1 constant pair 0x20-0xFE : {len(found_i2c_candidates)}")
for r1 in sorted(by_r1):
    addrs = by_r1[r1]
    print(f"  r1=0x{r1:02X} (7-bit=0x{r1>>1:02X}) : {len(addrs)} appels -> tgts: {set(f'0x{t:08X}' for _,t in addrs)}")
