#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
07_dma.py — Identifier le stream DMA2 utilise pour l'ADC
STM32F446: ADC1 -> DMA2 Stream0 Ch0  OU  DMA2 Stream4 Ch0
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

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

# ── 1. DMA2 stream IRQ vectors ───────────────────────────────────────────────
# STM32F446 IRQ: DMA2_Stream0=56, Stream1=57, Stream2=58, Stream3=59,
#                Stream4=60, Stream5=68, Stream6=69, Stream7=70
DEFAULT_HANDLER = u32(foff(BASE + 0x48))  # IRQ0 if not used, typically default handler
DMA2_STREAMS_IRQ = {
    "DMA2_Stream0": 0x120,
    "DMA2_Stream1": 0x124,
    "DMA2_Stream2": 0x128,
    "DMA2_Stream3": 0x12C,
    "DMA2_Stream4": 0x130,
    "DMA2_Stream5": 0x150,
    "DMA2_Stream6": 0x154,
    "DMA2_Stream7": 0x158,
}
# DMA2 stream peripheral base addresses
DMA2_STREAM_BASES = {
    "DMA2_Stream0": 0x40026410,
    "DMA2_Stream1": 0x40026428,
    "DMA2_Stream2": 0x40026440,
    "DMA2_Stream3": 0x40026458,
    "DMA2_Stream4": 0x40026470,
    "DMA2_Stream5": 0x40026488,
    "DMA2_Stream6": 0x400264A0,
    "DMA2_Stream7": 0x400264B8,
}
ADC1_DR  = 0x4001204C  # ADC1 data register
DMA2_BASE = 0x40026400

print("=== IRQ vectors DMA2 ===")
active_streams = []
for name, off in DMA2_STREAMS_IRQ.items():
    vec = u32(off)
    fn = vec & ~1
    is_def = (fn == DEFAULT_HANDLER)
    status = "(default - inactif)" if is_def else "*** ACTIF ***"
    print(f"  {name:20s} vec=0x{vec:08X} fn=0x{fn:08X}  {status}")
    if not is_def:
        active_streams.append((name, fn))

# ── 2. Search pool constants for DMA2 stream bases ──────────────────────────
print("\n=== Pool constants pour bases DMA2_Stream ===")
for name, base_addr in DMA2_STREAM_BASES.items():
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

# ── 3. Search for ADC1_DR as constant ───────────────────────────────────────
print(f"\n=== Pool constant ADC1_DR (0x{ADC1_DR:08X}) ===")
pat_dr = struct.pack("<I", ADC1_DR)
pos = 0
adc1dr_pool = []
while True:
    idx = data.find(pat_dr, pos)
    if idx < 0: break
    pool_addr = BASE + idx
    adc1dr_pool.append(pool_addr)
    print(f"  ADC1_DR trouve @ pool 0x{pool_addr:08X}")
    pos = idx + 1

# ── 4. Disassemble around active stream handler entries ─────────────────────
print("\n=== Disasm des handlers DMA2 actifs (30 insns) ===")
CODE_RANGES = [(0x08000000, 0x08009938), (0x08010000, 0x0801ACCC)]
for name, fn in active_streams:
    print(f"\n--- {name} handler @ 0x{fn:08X} ---")
    pos = fn
    count = 0
    while count < 30 and pos < BASE + N:
        for ins in md.disasm(data[foff(pos):foff(pos)+4], pos, count=1):
            print(f"  0x{ins.address:08X}  {ins.mnemonic:<10} {ins.op_str}")
            pos += ins.size; count += 1; break
        else:
            pos += 2

# ── 5. Scan for store of DMA stream base into handle (hdma.Instance = DMA2_StreamX) ──
print("\n=== Recherche STR de base DMA2_Stream dans handles (init DMA) ===")
for stream_name, stream_base in DMA2_STREAM_BASES.items():
    for s, e in CODE_RANGES:
        pos = s
        regs = [None]*16
        while pos < e:
            chunk = data[foff(pos):foff(e)]
            insns = list(md.disasm(chunk, pos, count=1))
            if not insns:
                pos += 2; continue
            ins = insns[0]
            ops = ins.operands
            m = ins.mnemonic
            o0 = rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
            try:
                if m == "push": regs = [None]*16
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mp = ops[1].mem
                    if md.reg_name(mp.base) == "pc":
                        la = ((ins.address+4)&~3)+mp.disp
                        regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
                elif m in ("movw","movs","mov") and ops[1].type==ARM_OP_IMM:
                    regs[o0] = ops[1].imm
                elif m == "movt" and ops[1].type==ARM_OP_IMM:
                    regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
                # STR rx, [ry, #0] with rx = stream_base -> hdma.Instance
                if m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    src_r = rn(ops[0].reg) if ops[0].type==ARM_OP_REG else None
                    disp = ops[1].mem.disp
                    src_val = regs[src_r] if isinstance(src_r,int) else None
                    if src_val == stream_base and disp == 0:
                        base_r = rn(ops[1].mem.base)
                        base_v = regs[base_r] if isinstance(base_r,int) else None
                        print(f"  0x{ins.address:08X}: hdma.Instance = {stream_name} (STR to r{base_r}={base_v!r})")
            except: pass
            pos += ins.size

# ── 6. Scan for SxCR write with CHSEL bits (bits [27:25]) ───────────────────
# Look for stores to DMA2_Stream0+0 or DMA2_Stream4+0 (SxCR register)
print("\n=== Recherche valeur SxCR ecrite (revele CHSEL = canal ADC) ===")
for stream_name, stream_base in [("DMA2_Stream0",0x40026410),("DMA2_Stream4",0x40026470)]:
    for s, e in CODE_RANGES:
        pos = s
        regs = [None]*16
        while pos < e:
            chunk = data[foff(pos):foff(e)]
            insns = list(md.disasm(chunk, pos, count=1))
            if not insns:
                pos += 2; continue
            ins = insns[0]
            ops = ins.operands
            m = ins.mnemonic
            o0 = rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
            try:
                if m == "push": regs = [None]*16
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mp = ops[1].mem
                    if md.reg_name(mp.base) == "pc":
                        la = ((ins.address+4)&~3)+mp.disp
                        regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
                elif m in ("movw","movs","mov") and ops[1].type==ARM_OP_IMM:
                    regs[o0] = ops[1].imm
                elif m == "movt" and ops[1].type==ARM_OP_IMM:
                    regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
                # STR rx, [ry, #0] where ry holds stream_base -> write SxCR
                if m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    base_r = rn(ops[1].mem.base)
                    disp   = ops[1].mem.disp
                    base_v = regs[base_r] if isinstance(base_r,int) else None
                    src_r  = rn(ops[0].reg) if ops[0].type==ARM_OP_REG else None
                    src_v  = regs[src_r] if isinstance(src_r,int) else None
                    if base_v == stream_base and disp == 0 and isinstance(src_v,int):
                        chsel = (src_v >> 25) & 0x7
                        direction = (src_v >> 6) & 0x3
                        ch_name = {0:"ADC1/ADC3", 1:"TIM", 2:"SPI/ADC3", 3:"SPI/USART",
                                   4:"SPI/TIM", 5:"SPI/TIM", 6:"TIM", 7:"TIM"}.get(chsel,"?")
                        if chsel == 0: ch_name = "ADC1 (Channel 0) *** CONFIRME ***"
                        print(f"  0x{ins.address:08X}: {stream_name}.SxCR = 0x{src_v:08X}")
                        print(f"    CHSEL={chsel} -> {ch_name}")
                        print(f"    DIR={direction} ({'P->M' if direction==0 else 'M->P' if direction==1 else 'M->M'})")
                        print(f"    CIRC={(src_v>>8)&1}, MINC={(src_v>>10)&1}, PINC={(src_v>>9)&1}")
                        print(f"    PSIZE={(src_v>>11)&3}, MSIZE={(src_v>>13)&3}")
                        print(f"    PL={(src_v>>16)&3}")
            except: pass
            pos += ins.size
