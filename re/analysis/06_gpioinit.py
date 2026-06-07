#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reconstruit les structs GPIO_InitTypeDef construites sur la PILE et passees a
HAL_GPIO_Init (0x080117B0). Revele les pins AF (USB/I2C/SAI/SPI) et ANALOG (ADC/Hall).
"""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import (ARM_INS_LDR, ARM_INS_STR, ARM_INS_STRD, ARM_INS_MOV, ARM_INS_MOVS,
    ARM_INS_MOVW, ARM_INS_MOVT, ARM_INS_ADD, ARM_INS_BL, ARM_OP_MEM, ARM_OP_REG, ARM_OP_IMM,
    ARM_REG_PC, ARM_REG_SP)

BASE = 0x08000000
HAL_GPIO_INIT = 0x080117B0
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read(); N = len(data)
def u32(o): return struct.unpack_from("<I", data, o)[0]
def off(a): return a - BASE
def inb(a): return 0 <= a - BASE < N - 1
md = Cs(CS_ARCH_ARM, CS_MODE_THUMB + CS_MODE_MCLASS); md.detail = True

GPIO = {0x40020000:"A",0x40020400:"B",0x40020800:"C",0x40020C00:"D",0x40021000:"E",0x40021C00:"H"}
MODE = {0:"INPUT",1:"OUTPUT_PP",0x11:"OUTPUT_OD",2:"AF_PP",0x12:"AF_OD",3:"ANALOG",
        0x10110000:"IT_RISING",0x10210000:"IT_FALLING",0x10310000:"IT_RISING_FALLING"}
PULL = {0:"none",1:"PU",2:"PD"}
# pins AF connues utiles sur F446 (AF, port, pin) -> fonction
AFMAP = {("B",14,12):"OTG_HS_DM",("B",15,12):"OTG_HS_DP",("A",11,10):"OTG_FS_DM",("A",12,10):"OTG_FS_DP",
    ("B",6,4):"I2C1_SCL",("B",7,4):"I2C1_SDA",("B",8,4):"I2C1_SCL",("B",9,4):"I2C1_SDA",
    ("B",10,4):"I2C2_SCL",("B",3,4):"I2C2_SDA",
    ("A",8,0):"MCO1",("A",4,6):"SAI1_FS_B",("B",2,6):"SAI1_SD_A"}

def pins(mask): return [p for p in range(16) if mask & (1 << p)]

# ---- function starts ----
starts = set()
for i in range(1, 16 + 97):
    v = u32(i*4)
    if 0x08000000 <= v < 0x08080000 and v & 1: starts.add(v & ~1)
for s, e in [(0x08000000, 0x0800993A), (0x08010000, 0x0801ACCE)]:
    for insn in md.disasm(data[off(s):off(e)], s):
        if insn.id == ARM_INS_BL:
            for op in insn.operands:
                if op.type == ARM_OP_IMM and inb(op.imm): starts.add(op.imm & ~1)
def prol(a):
    for i in md.disasm(data[off(a):off(a)+4], a, count=1): return i.mnemonic.startswith(("push","stmdb"))
    return False
starts = sorted(a for a in starts if inb(a) and prol(a))

results = []  # (call_addr, port, {fields})
for i, st in enumerate(starts):
    end = min(starts[i+1] if i+1 < len(starts) else st+0x1400, st+0x1A00)
    reg = {}      # name -> int | ('sp', k)
    stk = {}      # stack offset -> int | None
    for insn in md.disasm(data[off(st):off(end)], st):
        ops = insn.operands
        try: _, wr = insn.regs_access()
        except Exception: wr = ()
        rn = lambda r: insn.reg_name(r)

        # --- appel HAL_GPIO_Init ? ---
        if insn.id == ARM_INS_BL and ops and ops[0].type == ARM_OP_IMM and (ops[0].imm & ~1) == HAL_GPIO_INIT:
            r0 = reg.get("r0"); r1 = reg.get("r1")
            if r0 in GPIO and isinstance(r1, tuple) and r1[0] == "sp":
                k = r1[1]
                f = {n: stk.get(k + d) for n, d in (("Pin",0),("Mode",4),("Pull",8),("Speed",12),("Alt",16))}
                results.append((insn.address, GPIO[r0], f))

        # --- maj etats ---
        new = {}
        if insn.id == ARM_INS_LDR and len(ops) == 2 and ops[1].type == ARM_OP_MEM and ops[1].mem.base == ARM_REG_PC:
            lit = (((insn.address+4) & ~3) + ops[1].mem.disp)
            if inb(lit): new[rn(ops[0].reg)] = u32(off(lit))
        elif insn.id in (ARM_INS_MOV, ARM_INS_MOVS, ARM_INS_MOVW) and len(ops) == 2 and ops[1].type == ARM_OP_IMM:
            new[rn(ops[0].reg)] = ops[1].imm
        elif insn.id == ARM_INS_MOVT and len(ops) == 2 and ops[1].type == ARM_OP_IMM:
            r = rn(ops[0].reg); cur = reg.get(r, 0); cur = cur if isinstance(cur, int) else 0
            new[r] = (cur & 0xFFFF) | ((ops[1].imm & 0xFFFF) << 16)
        elif insn.id == ARM_INS_MOV and len(ops) == 2 and ops[1].type == ARM_OP_REG:
            src = ops[1].reg
            new[rn(ops[0].reg)] = ("sp", 0) if src == ARM_REG_SP else reg.get(rn(src))
        elif insn.id == ARM_INS_ADD and len(ops) == 3 and ops[1].type == ARM_OP_REG and ops[1].reg == ARM_REG_SP and ops[2].type == ARM_OP_IMM:
            new[rn(ops[0].reg)] = ("sp", ops[2].imm)
        # --- stores vers la pile ---
        if insn.id == ARM_INS_STR and len(ops) == 2 and ops[1].type == ARM_OP_MEM:
            b = ops[1].mem.base; d = ops[1].mem.disp
            base_is_sp = (b == ARM_REG_SP)
            k = d if base_is_sp else (reg.get(rn(b))[1] + d if isinstance(reg.get(rn(b)), tuple) else None)
            if k is not None:
                v = reg.get(rn(ops[0].reg)); stk[k] = v if isinstance(v, int) else None
        elif insn.id == ARM_INS_STRD and len(ops) == 3 and ops[2].type == ARM_OP_MEM:
            b = ops[2].mem.base; d = ops[2].mem.disp
            base_is_sp = (b == ARM_REG_SP)
            k = d if base_is_sp else (reg.get(rn(b))[1] + d if isinstance(reg.get(rn(b)), tuple) else None)
            if k is not None:
                for j, opi in enumerate(ops[:2]):
                    v = reg.get(rn(opi.reg)); stk[k + 4*j] = v if isinstance(v, int) else None

        for r in wr:
            nm = md.reg_name(r)
            if nm not in new: reg.pop(nm, None)
        reg.update(new)

print(f"Appels HAL_GPIO_Init avec struct reconstruite : {len(results)}\n")
print("="*78)
for a, port, f in sorted(results):
    Pin, Mode, Pull, Speed, Alt = (f["Pin"], f["Mode"], f["Pull"], f["Speed"], f["Alt"])
    if Pin is None:
        print(f"  @0x{a:08X} GPIO{port}: <Pin non resolu>"); continue
    pl = pins(Pin)
    md_s = MODE.get(Mode, f"0x{Mode:08X}" if isinstance(Mode,int) else "?")
    pu_s = PULL.get(Pull, str(Pull))
    af_s = f"AF{Alt}" if isinstance(Alt,int) else "?"
    tags = []
    for p in pl:
        t = AFMAP.get((port, p, Alt))
        if t: tags.append(f"P{port}{p}={t}")
    extra = ("  >> " + ", ".join(tags)) if tags else ""
    print(f"  @0x{a:08X} GPIO{port} P{port}{pl}  mode={md_s} pull={pu_s} {af_s}{extra}")
