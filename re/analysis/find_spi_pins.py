#!/usr/bin/env python3
"""Find SPI1 pin configuration and GPIO init for SPI."""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
N = len(data)
def u32(o): return struct.unpack_from("<I", data, o)[0]
def foff(a): return a - BASE

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS)
md.detail = True

SPI1_BASE = 0x40013000
GPIO_BASES = {0x40020000:"A", 0x40020400:"B", 0x40020800:"C", 0x40020C00:"D"}
HAL_GPIO_INIT = 0x080117B0  # or wherever it is

CODE_RANGES = [(0x08000000, 0x08009938), (0x08010000, 0x0801ACCC)]

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

# 1. Find all addresses where SPI1_BASE (0x40013000) is loaded
print("=== LDR loading SPI1_BASE (0x40013000) ===")
spi_ldr_addrs = []
for s, e in CODE_RANGES:
    pos = s
    while pos < e:
        for ins in md.disasm(data[foff(pos):foff(e)], pos, count=1):
            if ins.mnemonic.startswith("ldr") and len(ins.operands) >= 2:
                op1 = ins.operands[1]
                if op1.type == ARM_OP_MEM and md.reg_name(op1.mem.base) == "pc":
                    la = ((ins.address+4) & ~3) + op1.mem.disp
                    if 0 <= foff(la) <= N-4 and u32(foff(la)) == SPI1_BASE:
                        print(f"  @ 0x{ins.address:08X}")
                        spi_ldr_addrs.append(ins.address)
            pos += ins.size
            break
        else:
            pos += 2

# 2. Disassemble ±80 instructions around each SPI1_BASE load to find GPIO init context
HAL_GPIO_INIT_CANDIDATES = [0x080117B0, 0x0801186C]  # common addresses for HAL_GPIO_Init

print("\n=== Context around SPI1_BASE loads (GPIO AF configs) ===")
for ldr_addr in spi_ldr_addrs:
    print(f"\n--- Context @ 0x{ldr_addr:08X} ---")
    # Disassemble 200 bytes before
    start = max(0x08000000, ldr_addr - 0x80)
    end   = min(BASE + N, ldr_addr + 0x100)
    regs  = [None] * 16
    for pos in range(start, end, 2):
        for ins in md.disasm(data[foff(pos):foff(end)], pos, count=1):
            ops = ins.operands
            m   = ins.mnemonic
            o0  = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None
            try:
                if m == "push": regs = [None]*16
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mp = ops[1].mem
                    if md.reg_name(mp.base) == "pc":
                        la = ((ins.address+4)&~3)+mp.disp
                        regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
                elif m in ("movw","mov","movs") and ops[1].type==ARM_OP_IMM:
                    if o0 is not None: regs[o0] = ops[1].imm
                elif m == "movt" and ops[1].type==ARM_OP_IMM:
                    if o0 is not None: regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            except: pass

            # Flag interesting instructions
            note = ""
            if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                tgt = ops[0].imm
                r0v, r1v = regs[0], regs[1]
                if isinstance(r0v, int) and r0v in GPIO_BASES:
                    port = GPIO_BASES[r0v]
                    pin_mask = r1v if isinstance(r1v, int) else None
                    pins = [p for p in range(16) if pin_mask and (pin_mask >> p) & 1] if pin_mask else []
                    mode = regs[2] if len(regs)>2 else None
                    note = f"  << HAL_GPIO_Init(GPIO{port}, pins={pins}, mode=0x{mode:02X})" if mode is not None else f"  << HAL_GPIO_Init(GPIO{port}, pins={pins})"
                elif tgt == 0x080117B0 or tgt == 0x0801186C:
                    r0v2 = regs[0]
                    port = GPIO_BASES.get(r0v2, f"?({r0v2!r})")
                    note = f"  << HAL_GPIO_Init(GPIO{port})"

            r0s = f"0x{regs[0]:08X}" if isinstance(regs[0],int) else "?"
            r1s = f"0x{regs[1]:08X}" if isinstance(regs[1],int) else "?"
            r2s = f"0x{regs[2]:08X}" if isinstance(regs[2],int) else "?"
            print(f"  0x{ins.address:08X}  {m:<10} {ins.op_str:<35} r0={r0s} r1={r1s} r2={r2s}{note}")
            break

# 3. Look for HAL_GPIO_Init calls with AF5 (SPI1 default pins: PA5/PA6/PA7, or PB3/PB4/PB5)
print("\n=== HAL_GPIO_Init calls with AF5 (SPI1) or near SPI context ===")
AF5 = 5
for s, e in CODE_RANGES:
    pos = s; regs = [None]*16
    while pos < e:
        for ins in md.disasm(data[foff(pos):foff(e)], pos, count=1):
            ops = ins.operands; m = ins.mnemonic
            o0 = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None
            try:
                if m == "push": regs = [None]*16
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mp = ops[1].mem
                    if md.reg_name(mp.base) == "pc":
                        la = ((ins.address+4)&~3)+mp.disp
                        if o0 is not None: regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
                elif m in ("movw","mov","movs") and ops[1].type==ARM_OP_IMM and o0 is not None:
                    regs[o0] = ops[1].imm
                elif m == "movt" and ops[1].type==ARM_OP_IMM and o0 is not None:
                    regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
                if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                    tgt = ops[0].imm
                    r0v = regs[0] if regs[0] is not None else None
                    port = GPIO_BASES.get(r0v)
                    # Check if this might be GPIO init near SPI context
                    if port and isinstance(regs[1], int):
                        pins = [p for p in range(16) if (regs[1]>>p)&1]
                        print(f"  @ 0x{ins.address:08X} GPIO{port} pins={pins} -> fn 0x{tgt:08X}  r2={regs[2]!r}")
                    for k in (0,1,2,3,12): regs[k] = None
            except: pass
            pos += ins.size; break
        else: pos += 2
