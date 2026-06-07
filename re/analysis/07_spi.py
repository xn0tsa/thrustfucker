#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
07_spi.py — Identifier le peripherique SPI : instance (SPI1/2/3), config CR1, donnees transmises
FUN_08015040 = HAL_SPI_Init (identifie par Ghidra)
FUN_0801525E = HAL_SPI_TransmitReceive
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

HAL_SPI_INIT = 0x08015040
HAL_SPI_TXRX = 0x0801525E

SPI_BASES = {
    0x40013000: "SPI1",
    0x40003800: "SPI2",
    0x40003C00: "SPI3",
    0x40013400: "SPI4",
    0x40015000: "SPI5",
    0x40015400: "SPI6",
}

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

# ── 1. Chercher les bases SPI dans le pool de constantes ─────────────────────
print("=== Pool constants pour bases SPI ===")
for base_addr, name in SPI_BASES.items():
    pat = struct.pack("<I", base_addr)
    hits = []
    pos = 0
    while True:
        idx = data.find(pat, pos)
        if idx < 0: break
        hits.append(BASE + idx)
        pos = idx + 1
    if hits:
        print(f"  {name} (0x{base_addr:08X}): {[f'0x{h:08X}' for h in hits]}")
    else:
        print(f"  {name} (0x{base_addr:08X}): ABSENT du pool")

# ── 2. Trouver les appels a HAL_SPI_Init et tracer r0 (handle ptr) ───────────
print(f"\n=== Appels a HAL_SPI_Init (0x{HAL_SPI_INIT:08X}) ===")
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
            elif m in ("add","adds") and len(ops)==3 and ops[2].type==ARM_OP_IMM and o0 is not None:
                sv = regs[rn(ops[1].reg)]
                regs[o0] = sv+ops[2].imm if isinstance(sv,int) else None
            if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                tgt = ops[0].imm
                if tgt == HAL_SPI_INIT:
                    r0v = regs[0]
                    print(f"  @0x{ins.address:08X}: HAL_SPI_Init(hspi=0x{r0v:08X if isinstance(r0v,int) else '?'})")
                    # r0 should be pointer to SPI_HandleTypeDef in RAM
                    # The handle's Instance field was set shortly before with the SPI base
                for k in (0,1,2,3,12): regs[k] = None
        except: pass
        pos += ins.size

# ── 3. Trouver les appels a HAL_SPI_TransmitReceive et voir les donnees (r2) ─
print(f"\n=== Appels a HAL_SPI_TransmitReceive (0x{HAL_SPI_TXRX:08X}) ===")
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
            elif m in ("add","adds") and len(ops)==3 and ops[2].type==ARM_OP_IMM and o0 is not None:
                sv = regs[rn(ops[1].reg)]
                regs[o0] = sv+ops[2].imm if isinstance(sv,int) else None
            if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                tgt = ops[0].imm
                if tgt == HAL_SPI_TXRX:
                    r0v, r1v, r2v, r3v = regs[0], regs[1], regs[2], regs[3]
                    data_str = ""
                    if isinstance(r2v,int) and BASE<=r2v<BASE+N:
                        raw = data[foff(r2v):foff(r2v)+8]
                        data_str = f" TxData=[{' '.join(f'{b:02X}' for b in raw[:8])}...]"
                    print(f"  @0x{ins.address:08X}: TXRX(hspi=r0, pTx=r2={r2v!r}, size={r3v!r}){data_str}")
                for k in (0,1,2,3,12): regs[k] = None
        except: pass
        pos += ins.size

# ── 4. Trouver les STR qui ecrivent une base SPI dans un handle ───────────────
print("\n=== STR d'une base SPI vers RAM (hdma.Instance = SPIx) ===")
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
            if m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                src_r = rn(ops[0].reg) if ops[0].type==ARM_OP_REG else None
                src_v = regs[src_r] if isinstance(src_r,int) else None
                disp  = ops[1].mem.disp
                if src_v in SPI_BASES and disp == 0:
                    base_r = rn(ops[1].mem.base)
                    base_v = regs[base_r] if isinstance(base_r,int) else None
                    spi_name = SPI_BASES[src_v]
                    print(f"  @0x{ins.address:08X}: hspi.Instance = {spi_name} (stored at r{base_r}={base_v!r})")
        except: pass
        pos += ins.size

# ── 5. Decoder HAL_SPI_Init CR1 value to identify device ──────────────────────
# Look inside HAL_SPI_Init body for the computed CR1 value
print(f"\n=== HAL_SPI_Init body (0x{HAL_SPI_INIT:08X}, 80 insns) ===")
pos = HAL_SPI_INIT
count = 0
while count < 80 and pos < BASE+N:
    for ins in md.disasm(data[foff(pos):foff(pos)+4], pos, count=1):
        print(f"  0x{ins.address:08X}  {ins.mnemonic:<10} {ins.op_str}")
        pos += ins.size; count += 1; break
    else:
        pos += 2
