#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
05_i2c.py — Trouve les fonctions I2C HAL et extrait l'adresse du device (r1)
Stratégie :
  1. Localise toutes les occurrences de 0x40005400 (I2C1) dans le pool de constantes
  2. Trouve les LDR qui chargent ces valeurs → fonctions HAL I2C
  3. Remonte aux appelants → trace r1 = DevAddress au moment de l'appel
  4. Affiche aussi les données envoyées (r2 si c'est un pointeur en flash)
"""
import struct
from collections import defaultdict
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

BASE = 0x08000000
data = open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin", "rb").read()
N = len(data)

def u32(o): return struct.unpack_from("<I", data, o)[0]
def foff(a): return a - BASE

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS)
md.detail = True

I2C_BASES = {0x40005400: "I2C1", 0x40005800: "I2C2"}

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12,"sb":9,"sl":10}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

CODE_RANGES = [(0x08000000, 0x08009938), (0x08010000, 0x0801ACCC)]

def iter_insns(s, e):
    pos = s
    while pos < e:
        for ins in md.disasm(data[foff(pos):foff(e)], pos, count=1):
            yield ins; pos += ins.size; break
        else:
            pos += 2

# ─── Étape 1 : trouver les adresses des LDR qui chargent I2C1 ─────────────────
i2c_ldr_addrs = set()  # adresses des instructions LDR chargeant la base I2C
for s, e in CODE_RANGES:
    for ins in iter_insns(s, e):
        if ins.mnemonic.startswith("ldr") and len(ins.operands) >= 2:
            op1 = ins.operands[1]
            if op1.type == ARM_OP_MEM and md.reg_name(op1.mem.base) == "pc":
                la = ((ins.address + 4) & ~3) + op1.mem.disp
                if 0 <= foff(la) <= N - 4 and u32(foff(la)) in I2C_BASES:
                    i2c_ldr_addrs.add(ins.address)

print(f"LDR chargeant une base I2C : {len(i2c_ldr_addrs)}")
for a in sorted(i2c_ldr_addrs):
    la = ((a + 4) & ~3) + 0  # reconstituons l'offset
    print(f"  0x{a:08X}")

# ─── Étape 2 : identifier les fonctions HAL I2C (contiennent un de ces LDR) ───
# Heuristique : la fonction commence au PUSH précédant le LDR
def find_func_start(addr):
    """Remonte jusqu'au dernier PUSH {... lr} avant addr dans la même plage."""
    best = None
    for s, e in CODE_RANGES:
        if not (s <= addr < e): continue
        pos = s
        while pos < addr:
            for ins in md.disasm(data[foff(pos):foff(e)], pos, count=1):
                if ins.mnemonic == "push":
                    best = ins.address
                pos += ins.size if ins else 2
                break
            else:
                pos += 2
    return best

# Plage des fonctions HAL I2C (simple : utiliser les fonctions identifiées par Ghidra)
# FUN_08010C34 (sz=360) référence I2C1 → adresses 0x08010C34 à 0x08010C34+360-1
I2C_FUNCS = {0x08010C34: 0x08010C34 + 360}  # adresse → fin

# Mais cherchons aussi d'autres fonctions avec des LDR I2C non vus
# On va scanner une fenêtre autour de chaque LDR
i2c_func_ranges = {}
for ldr_addr in i2c_ldr_addrs:
    # Trouver quelle plage contient ce LDR
    for s, e in CODE_RANGES:
        if s <= ldr_addr < e:
            # Chercher le PUSH précédent
            func_start = None
            pos = s
            last_push = None
            while pos <= ldr_addr:
                for ins in md.disasm(data[foff(pos):foff(e)], pos, count=1):
                    if ins.mnemonic == "push":
                        last_push = ins.address
                    pos += ins.size
                    break
                else:
                    pos += 2
            if last_push:
                i2c_func_ranges[last_push] = ldr_addr + 200  # approximation
            break

print(f"\nFonctions HAL I2C détectées : {sorted(i2c_func_ranges.keys())}")
for fs in sorted(i2c_func_ranges):
    print(f"  ~0x{fs:08X}")

# ─── Étape 3 : trouver tous les appels BL/BLX vers ces fonctions ──────────────
i2c_func_addrs = set(i2c_func_ranges.keys())
call_sites = []  # (call_addr, target)

for s, e in CODE_RANGES:
    regs = [None] * 16
    for ins in iter_insns(s, e):
        regs[15] = ins.address + 4
        m = ins.mnemonic; ops = ins.operands
        try:
            o0 = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None
            if m == "push":
                regs = [None] * 16
            elif m.startswith("ldr") and len(ops) >= 2 and ops[1].type == ARM_OP_MEM:
                mem = ops[1].mem
                if md.reg_name(mem.base) == "pc":
                    la = ((ins.address + 4) & ~3) + mem.disp
                    regs[o0] = u32(foff(la)) if 0 <= foff(la) <= N - 4 else None
            elif m == "movw" and ops[1].type == ARM_OP_IMM:
                regs[o0] = ops[1].imm & 0xFFFF
            elif m == "movt" and ops[1].type == ARM_OP_IMM:
                regs[o0] = ((regs[o0] or 0) & 0xFFFF) | ((ops[1].imm & 0xFFFF) << 16)
            elif m.split(".")[0] in ("mov","movs") and len(ops) >= 2:
                regs[o0] = ops[1].imm if ops[1].type == ARM_OP_IMM else regs[rn(ops[1].reg)]
            elif m.split(".")[0] in ("add","adds") and len(ops) == 3 and ops[2].type == ARM_OP_IMM:
                sv = regs[rn(ops[1].reg)]
                regs[o0] = sv + ops[2].imm if isinstance(sv, int) else None
            elif m.split(".")[0] in ("lsl","lsls") and len(ops) == 3 and ops[2].type == ARM_OP_IMM:
                sv = regs[rn(ops[1].reg)]
                regs[o0] = (sv << ops[2].imm) & 0xFFFFFFFF if isinstance(sv, int) else None
            if m in ("bl","blx") and ops and ops[0].type == ARM_OP_IMM:
                tgt = ops[0].imm
                if tgt in i2c_func_addrs:
                    call_sites.append((ins.address, tgt, regs[0], regs[1], regs[2], regs[3]))
                for k in (0,1,2,3,12): regs[k] = None
        except Exception: pass

print(f"\nAppels vers fonctions HAL I2C : {len(call_sites)}")
print("="*80)
for addr, tgt, r0, r1, r2, r3 in call_sites:
    r1_str = f"0x{r1:04X} ({r1>>1:#04x} 7-bit)" if isinstance(r1, int) else "?"
    r2_str = f"0x{r2:08X}" if isinstance(r2, int) else "?"
    # Si r2 pointe dans le flash, montrer les bytes
    data_str = ""
    if isinstance(r2, int) and 0x08000000 <= r2 < 0x08000000 + N:
        raw = data[foff(r2):foff(r2)+16]
        data_str = " → " + " ".join(f"{b:02X}" for b in raw[:8])
    print(f"  @0x{addr:08X} -> fn 0x{tgt:08X}  r0={r0!r:<14} r1={r1_str:<20} r2={r2_str}{data_str}")

# ─── Étape 4 : vue séparée — adresses de device vues ─────────────────────────
print("\n>>> ADRESSES I2C DEVICE trouvées (r1 = DevAddress << 1) :")
seen_devaddr = set()
for addr, tgt, r0, r1, r2, r3 in call_sites:
    if isinstance(r1, int) and 0 < r1 < 0x200:
        dev7 = r1 >> 1
        if dev7 not in seen_devaddr:
            seen_devaddr.add(dev7)
            print(f"  r1=0x{r1:02X} → 7-bit addr = 0x{dev7:02X} ({dev7})")

if not seen_devaddr:
    print("  (aucune trouvée directement — cherche dans toutes les fonctions...)")
    # Scan plus large : tous les BL où r1 est petit
    for s, e in CODE_RANGES:
        regs = [None] * 16
        for ins in iter_insns(s, e):
            regs[15] = ins.address + 4
            m = ins.mnemonic; ops = ins.operands
            try:
                o0 = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None
                if m == "push": regs = [None] * 16
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mem=ops[1].mem
                    if md.reg_name(mem.base)=="pc":
                        la=((ins.address+4)&~3)+mem.disp
                        regs[o0]=u32(foff(la)) if 0<=foff(la)<=N-4 else None
                elif m=="movw" and ops[1].type==ARM_OP_IMM: regs[o0]=ops[1].imm&0xFFFF
                elif m=="movt" and ops[1].type==ARM_OP_IMM: regs[o0]=((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
                elif m.split(".")[0] in ("mov","movs") and len(ops)>=2:
                    regs[o0]=ops[1].imm if ops[1].type==ARM_OP_IMM else regs[rn(ops[1].reg)]
                elif m.split(".")[0] in ("add","adds") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                    sv=regs[rn(ops[1].reg)]; regs[o0]=sv+ops[2].imm if isinstance(sv,int) else None
                if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                    tgt=ops[0].imm
                    if tgt in i2c_ldr_addrs: # LDR addr != func addr, skip
                        pass
                    r1v=regs[1]
                    if isinstance(r1v,int) and 0x20 <= r1v <= 0xFF and (r1v & 1) == 0:
                        # valeur paire entre 0x20 et 0xFF = adresse I2C probable
                        print(f"  Candidat I2C @0x{ins.address:08X} → fn 0x{tgt:08X}: r1=0x{r1v:02X} = addr 7-bit 0x{r1v>>1:02X}")
                    for k in (0,1,2,3,12): regs[k]=None
            except Exception: pass
