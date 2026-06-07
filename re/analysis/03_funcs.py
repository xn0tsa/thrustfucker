#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v2 : decouverte de fonctions par cibles BL (filtre prologue) + propagation de
constantes intra-fonction, pour cracker le PINOUT.
Nouveaute : si un helper est appele facon HAL `init(GPIOx, &cfg)`, on lit la
struct GPIO_InitTypeDef pointee EN FLASH -> pinout direct.
"""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import (ARM_INS_LDR, ARM_INS_MOV, ARM_INS_MOVS, ARM_INS_MOVW,
    ARM_INS_MOVT, ARM_INS_BL, ARM_OP_MEM, ARM_OP_REG, ARM_OP_IMM, ARM_REG_PC)

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read(); N = len(data)
def u32(o): return struct.unpack_from("<I", data, o)[0]
def off(a): return a - BASE
def inflash(a): return 0x08000000 <= a < 0x08080000 and off(a) < N - 3
def inb(a): return 0 <= a - BASE < N - 1

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB + CS_MODE_MCLASS); md.detail = True
GPIO = {0x40020000:"A",0x40020400:"B",0x40020800:"C",0x40020C00:"D",0x40021000:"E",0x40021C00:"H"}
GREG = {0x00:"MODER",0x04:"OTYPER",0x08:"OSPEEDR",0x0C:"PUPDR",0x14:"ODR",0x18:"BSRR",0x20:"AFRL",0x24:"AFRH"}
REGIONS = [(0x08000000, 0x0800993A), (0x08010000, 0x0801ACCE)]

# ---- 1) starts = vecteurs + cibles BL, filtres prologue ----
starts = set()
for i in range(1, 16 + 97):
    v = u32(i * 4)
    if inflash(v) and (v & 1): starts.add(v & ~1)
for s, e in REGIONS:
    for insn in md.disasm(data[off(s):off(e)], s):
        if insn.id == ARM_INS_BL:
            for op in insn.operands:
                if op.type == ARM_OP_IMM and inflash(op.imm): starts.add(op.imm & ~1)
def is_prologue(a):
    for insn in md.disasm(data[off(a):off(a)+4], a, count=1):
        return insn.mnemonic.startswith("push") or insn.mnemonic.startswith("stmdb")
    return False
starts = sorted(a for a in starts if inb(a) and is_prologue(a))
print(f"Fonctions (prologue) : {len(starts)}")

# ---- 2) analyse par fonction ----
def hal_mode(m):
    return {0:"INPUT",1:"OUTPUT_PP",0x11:"OUTPUT_OD",2:"AF_PP",0x12:"AF_OD",3:"ANALOG",
        0x10110000:"IT_RISING",0x10210000:"IT_FALLING",0x10310000:"IT_RISING_FALLING",
        0x10120000:"EVT_RISING"}.get(m, f"0x{m:08X}")
def pins_of(mask): return ",".join(str(p) for p in range(16) if mask & (1 << p))

gpio_writes = []; helper_calls = []; structs = []
for i, start in enumerate(starts):
    end = min(starts[i+1] if i+1 < len(starts) else start+0x1200, start+0x1800)
    fn = list(md.disasm(data[off(start):off(end)], start))
    reg = {}
    for insn in fn:
        ops = insn.operands
        try: _, wr = insn.regs_access()
        except Exception: wr = ()
        # acces GPIO direct
        for op in ops:
            if op.type == ARM_OP_MEM and op.mem.base:
                bn = insn.reg_name(op.mem.base); bv = reg.get(bn)
                if bv in GPIO and op.mem.disp in GREG:
                    val = None
                    if not insn.mnemonic.startswith("ldr"):
                        for o2 in ops:
                            if o2.type == ARM_OP_REG and insn.reg_name(o2.reg) != bn:
                                val = reg.get(insn.reg_name(o2.reg)); break
                    gpio_writes.append((insn.address, GPIO[bv], GREG[op.mem.disp], insn.mnemonic,
                                        f"0x{val:08X}" if isinstance(val, int) else "?"))
        # appel helper avec base GPIO en arg
        if insn.id == ARM_INS_BL and ops and ops[0].type == ARM_OP_IMM:
            a = {r: reg.get(r) for r in ("r0","r1","r2","r3") if isinstance(reg.get(r), int)}
            if any(v in GPIO for v in a.values()):
                helper_calls.append((insn.address, ops[0].imm & ~1, dict(a)))
                # si un autre arg pointe en flash -> struct GPIO_InitTypeDef ?
                base = next(v for v in a.values() if v in GPIO)
                for r, v in a.items():
                    if inflash(v) and v not in GPIO.keys():
                        o = off(v)
                        try:
                            Pin, Mode, Pull, Speed, Alt = u32(o), u32(o+4), u32(o+8), u32(o+12), u32(o+16)
                        except Exception: continue
                        if 0 < Pin <= 0xFFFF and Mode <= 0x10310000 and Pull <= 3 and Speed <= 3 and Alt <= 15:
                            structs.append((insn.address, GPIO[base], v, Pin, Mode, Pull, Speed, Alt))
        # maj constantes
        new = {}
        if insn.id == ARM_INS_LDR and len(ops) == 2 and ops[1].type == ARM_OP_MEM and ops[1].mem.base == ARM_REG_PC:
            lit = (((insn.address+4) & ~3) + ops[1].mem.disp)
            if inb(lit): new[insn.reg_name(ops[0].reg)] = u32(off(lit))
        elif insn.id in (ARM_INS_MOV, ARM_INS_MOVS, ARM_INS_MOVW) and len(ops) == 2 and ops[1].type == ARM_OP_IMM:
            new[insn.reg_name(ops[0].reg)] = ops[1].imm
        elif insn.id == ARM_INS_MOVT and len(ops) == 2 and ops[1].type == ARM_OP_IMM:
            rn = insn.reg_name(ops[0].reg); new[rn] = (reg.get(rn,0) & 0xFFFF) | ((ops[1].imm & 0xFFFF) << 16)
        elif insn.id == ARM_INS_MOV and len(ops) == 2 and ops[1].type == ARM_OP_REG:
            new[insn.reg_name(ops[0].reg)] = reg.get(insn.reg_name(ops[1].reg))
        for r in wr:
            rn = md.reg_name(r)
            if rn not in new: reg.pop(rn, None)
        reg.update(new)

print(f"Ecritures GPIO directes : {len(gpio_writes)} | appels helper(GPIO) : {len(helper_calls)} | structs init : {len(structs)}\n")

if structs:
    print("="*72); print("STRUCTS GPIO_InitTypeDef EN FLASH (pinout HAL)"); print("="*72)
    for a, port, p, Pin, Mode, Pull, Speed, Alt in structs:
        print(f"  @0x{a:08X} init(GPIO{port}, 0x{p:08X}) -> pins[{pins_of(Pin)}] "
              f"mode={hal_mode(Mode)} pull={['NO','UP','DOWN'][Pull] if Pull<3 else Pull} "
              f"speed={Speed} AF={Alt}")
    print()

print("="*72); print("APPELS HELPER (args resolus)"); print("="*72)
seen = set()
for a, t, args in sorted(helper_calls):
    astr = " ".join(f"{r}=0x{v:08X}" for r, v in sorted(args.items()))
    print(f"  0x{a:08X} bl 0x{t:08X}  [{astr}]")

if gpio_writes:
    print("\n" + "="*72); print("ECRITURES GPIO DIRECTES"); print("="*72)
    for a, port, rg, mn, vs in sorted(gpio_writes):
        print(f"  0x{a:08X} GPIO{port}->{rg:<7} {mn:<6} val={vs}")
