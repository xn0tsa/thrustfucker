#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
07_i2c_device.py — Retrouver l'adresse du device I2C
Strategie:
  1. Desassembler FUN_08008944 autour de 0x08008C62 (I2C1 LDR)
     pour voir l'init I2C et les transactions avec DevAddress
  2. Scanner les BL dans la zone init I2C avec r1 dans 0x20-0xFE
  3. Disasm FUN_08007F34 (identifie comme "fonction I2C" par 05_i2c.py)
"""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

BASE = 0x08000000
data = open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin","rb").read()
N = len(data)
def u32(o): return struct.unpack_from("<I", data, o)[0]
def foff(a): return a - BASE

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS)
md.detail = True

I2C1_BASE = 0x40005400

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

def disasm_tracked(start, n_insns):
    result = []
    regs = [None]*16
    pos = start
    count = 0
    while count < n_insns and pos < BASE + N:
        chunk = data[foff(pos):foff(pos)+4]
        insns = list(md.disasm(chunk, pos, count=1))
        if not insns: pos += 2; continue
        ins = insns[0]
        ops = ins.operands
        m   = ins.mnemonic
        o0 = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None
        try:
            if m == "push": regs = [None]*16
            elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mp = ops[1].mem
                if md.reg_name(mp.base) == "pc":
                    la = ((ins.address+4)&~3)+mp.disp
                    regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
            elif m in ("movw","movs","mov") and ops[1].type==ARM_OP_IMM and o0 is not None:
                regs[o0] = ops[1].imm
            elif m == "movt" and ops[1].type==ARM_OP_IMM and o0 is not None:
                regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            elif m in ("add","adds") and len(ops)==3 and ops[2].type==ARM_OP_IMM and o0 is not None:
                sv = regs[rn(ops[1].reg)]
                regs[o0] = sv + ops[2].imm if isinstance(sv,int) else None
        except: pass
        result.append((ins, list(regs)))
        pos += ins.size
        count += 1
    return result

def show(tracked, title="", highlight_i2c=True):
    if title: print(f"\n{'='*70}\n{title}\n{'='*70}")
    for ins, regs in tracked:
        r0v, r1v = regs[0], regs[1]
        flags = []
        if ins.mnemonic in ("bl","blx") and ins.operands and ins.operands[0].type==ARM_OP_IMM:
            tgt = ins.operands[0].imm
            if highlight_i2c and isinstance(r1v,int) and 0x20<=r1v<=0xFE and (r1v&1)==0:
                flags.append(f"*** I2C DevAddr r1=0x{r1v:02X} (7-bit=0x{r1v>>1:02X}) -> tgt=0x{tgt:08X}")
            else:
                flags.append(f"BL->0x{tgt:08X}")
        # flag LDR that loads I2C1 base
        if ins.mnemonic.startswith("ldr") and ins.operands:
            try:
                op1 = ins.operands[1]
                if op1.type==ARM_OP_MEM and md.reg_name(op1.mem.base)=="pc":
                    la = ((ins.address+4)&~3)+op1.mem.disp
                    if u32(foff(la)) == I2C1_BASE:
                        flags.append("<-- LDR I2C1_BASE!")
            except: pass
        r0s = f"0x{r0v:08X}" if isinstance(r0v,int) else "?"
        r1s = f"0x{r1v:08X}" if isinstance(r1v,int) else "?"
        flag_str = "  " + " | ".join(flags) if flags else ""
        print(f"  0x{ins.address:08X}  {ins.mnemonic:<8} {ins.op_str:<35} r0={r0s} r1={r1s}{flag_str}")

# ── 1. FUN_08008944 region contenant le LDR I2C1 @ 0x08008C62 ───────────────
# Start 40 instructions BEFORE 0x08008C62 to get context
# 0x08008C62 - 40*4 = 0x08008BC2 (approx, using 2-byte insn estimate / 20)
# Let's go 80 bytes before (approx 30 thumb2 insns)
show(disasm_tracked(0x08008C00, 120),
     "FUN_08008944 autour du LDR I2C1_BASE @ 0x08008C62 (120 insns depuis 0x8C00)")

# ── 2. FUN_08007F34 (identifie comme init wrapper par 05_i2c.py) ─────────────
show(disasm_tracked(0x08007F34, 80),
     "FUN_08007F34 (80 insns) - verif si lien avec I2C")

# ── 3. Context du call @0x080003A8 → fn 0x08007F34 ───────────────────────────
show(disasm_tracked(0x08000360, 80),
     "Contexte autour du call @0x080003A8 (depuis 0x08000360, 80 insns)")

# ── 4. Scan ALL BL in code with r1 in I2C address range ──────────────────────
print("\n=== Scan global: BL avec r1 = adresse I2C valide (0x20-0xFE pair) ===")
CODE_RANGES = [(0x08000000,0x08009938),(0x08010000,0x0801ACCC)]
for s, e in CODE_RANGES:
    pos = s
    regs = [None]*16
    while pos < e:
        chunk = data[foff(pos):foff(e)]
        insns = list(md.disasm(chunk, pos, count=1))
        if not insns: pos += 2; continue
        ins = insns[0]
        ops = ins.operands
        m   = ins.mnemonic
        o0 = rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
        try:
            if m == "push": regs = [None]*16
            elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mp = ops[1].mem
                if md.reg_name(mp.base) == "pc":
                    la = ((ins.address+4)&~3)+mp.disp
                    regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
            elif m in ("movw","movs","mov") and ops[1].type==ARM_OP_IMM and o0 is not None:
                regs[o0] = ops[1].imm
            elif m == "movt" and ops[1].type==ARM_OP_IMM and o0 is not None:
                regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                tgt = ops[0].imm
                r1v = regs[1]
                if isinstance(r1v,int) and 0x20<=r1v<=0xFE and (r1v&1)==0:
                    print(f"  @0x{ins.address:08X} -> 0x{tgt:08X}  r1=0x{r1v:02X} (7-bit=0x{r1v>>1:02X})")
                for k in (0,1,2,3,12): regs[k] = None
        except: pass
        pos += ins.size
