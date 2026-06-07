#!/usr/bin/env python3
"""Scan firmware for HAL_GPIO_Init calls with AF=5 (SPI) - full register tracker from FUN start."""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
N = len(data)
def u32(a): return struct.unpack_from("<I", data, a - BASE)[0]
def foff(a): return a - BASE
md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS); md.detail = True

GPIO = {0x40020000:"GPIOA", 0x40020400:"GPIOB", 0x40020800:"GPIOC", 0x40020C00:"GPIOD"}
HAL_GPIO_INIT = 0x080117B0
HAL_SPI_INIT  = 0x08015040

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

def resolve_reg(regs, op):
    if op.type == ARM_OP_REG:
        return regs[rn(op.reg)]
    if op.type == ARM_OP_IMM:
        return op.imm
    return None

def full_trace(start, count=1000, stop_at=None):
    """Full register+stack tracker. Returns list of annotated BL calls."""
    regs  = [None]*16
    stk   = {}
    pos   = start
    done  = 0
    calls = []

    while done < count and pos < BASE+N:
        if stop_at and pos >= stop_at:
            break
        seg = data[foff(pos):foff(pos)+4]
        gen = list(md.disasm(seg, pos, count=1))
        if not gen:
            pos += 2; continue
        ins = gen[0]
        ops = ins.operands
        m   = ins.mnemonic
        o0  = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None

        try:
            if m == "push":
                # Reset caller-saved (not r4-r11)
                for k in (0,1,2,3,12): regs[k] = None
                stk = {}

            elif m.startswith("str") and not m.startswith("strb"):
                if len(ops) >= 2 and ops[1].type == ARM_OP_MEM:
                    base_r = rn(ops[1].mem.base)
                    disp   = ops[1].mem.disp
                    if md.reg_name(ops[1].mem.base) == "sp":
                        sv = resolve_reg(regs, ops[0])
                        stk[disp] = sv

            elif m.startswith("ldr") and not m.startswith("ldrb"):
                if len(ops) >= 2 and ops[1].type == ARM_OP_MEM:
                    mp = ops[1].mem
                    if md.reg_name(mp.base) == "pc":
                        la = ((ins.address+4)&~3)+mp.disp
                        if o0 is not None:
                            regs[o0] = u32(la) if 0 <= foff(la) <= N-4 else None
                    elif md.reg_name(mp.base) == "sp":
                        if o0 is not None:
                            regs[o0] = stk.get(mp.disp)
                    else:
                        if o0 is not None:
                            inner = regs[rn(mp.base)] if mp.base else None
                            regs[o0] = None  # indirect load, can't track

            elif m in ("movw", "mov", "movs") and len(ops) >= 2 and ops[1].type == ARM_OP_IMM:
                if o0 is not None: regs[o0] = ops[1].imm

            elif m == "movt" and len(ops) >= 2 and ops[1].type == ARM_OP_IMM:
                if o0 is not None:
                    base = regs[o0] or 0
                    regs[o0] = (base & 0xFFFF) | ((ops[1].imm & 0xFFFF) << 16)

            elif m in ("orr","orrs") and len(ops) == 3:
                if o0 is not None:
                    v1 = resolve_reg(regs, ops[1])
                    v2 = resolve_reg(regs, ops[2])
                    regs[o0] = (v1 or 0) | (v2 or 0) if v1 is not None or v2 is not None else None

            elif m in ("add","adds") and len(ops) == 3:
                if o0 is not None:
                    v1 = resolve_reg(regs, ops[1])
                    v2 = resolve_reg(regs, ops[2])
                    regs[o0] = v1 + v2 if isinstance(v1,int) and isinstance(v2,int) else None

            elif m in ("sub","subs") and len(ops) == 3 and o0 != 13:
                if o0 is not None:
                    v1 = resolve_reg(regs, ops[1])
                    v2 = resolve_reg(regs, ops[2])
                    regs[o0] = v1 - v2 if isinstance(v1,int) and isinstance(v2,int) else None

            elif m in ("lsls","lsl") and len(ops) == 3:
                if o0 is not None:
                    v1 = resolve_reg(regs, ops[1])
                    v2 = resolve_reg(regs, ops[2])
                    regs[o0] = (v1 << v2) & 0xFFFFFFFF if isinstance(v1,int) and isinstance(v2,int) else None

            elif m == "strd" and len(ops) >= 3 and ops[2].type == ARM_OP_MEM:
                if md.reg_name(ops[2].mem.base) == "sp":
                    disp = ops[2].mem.disp
                    stk[disp]   = resolve_reg(regs, ops[0])
                    stk[disp+4] = resolve_reg(regs, ops[1])

            elif m == "mov" and len(ops) == 2 and ops[1].type == ARM_OP_REG:
                if o0 is not None:
                    src = rn(ops[1].reg)
                    regs[o0] = regs[src] if src is not None else None

            if m in ("bl","blx") and ops and ops[0].type == ARM_OP_IMM:
                tgt = ops[0].imm
                r0v = regs[0]; r1v = regs[1]
                calls.append((ins.address, tgt, regs[:], dict(stk)))
                if tgt == HAL_GPIO_INIT:
                    port = GPIO.get(r0v, f"0x{r0v:08X}" if isinstance(r0v,int) else "?")
                    # struct at sp, so fields are at stk offsets 0,4,8,12,16
                    pin_v  = stk.get(0)
                    mode_v = stk.get(4)
                    pull_v = stk.get(8)
                    spd_v  = stk.get(12)
                    alt_v  = stk.get(16)
                    pins   = [p for p in range(16) if isinstance(pin_v,int) and (pin_v>>p)&1]
                    mode_s = {0:"INPUT",1:"OUT_PP",0x11:"OUT_OD",2:"AF_PP",0x12:"AF_OD",
                              3:"ANALOG",0x10110000:"IT_RISING"}.get(mode_v, f"mode=0x{mode_v:X}" if isinstance(mode_v,int) else "?")
                    pull_s = {0:"nopull",1:"PU",2:"PD"}.get(pull_v, f"pull={pull_v!r}")
                    print(f"  GPIO_Init(GPIO{port}, pins={pins}, {mode_s}, {pull_s}, AF={alt_v})  @ 0x{ins.address:08X}")
                elif tgt == HAL_SPI_INIT:
                    print(f"\n  >>> HAL_SPI_Init @ 0x{ins.address:08X} <<<\n")
                # Clear caller-saved
                for k in (0,1,2,3,12): regs[k] = None
        except Exception as ex:
            pass

        pos += ins.size
        done += 1

    return calls

# Trace the GPIO init section of FUN_08008944 from start to first HAL_SPI_Init
print("=== FUN_08008944 GPIO inits (tracking all regs from function start) ===")
print("=== GPIO Mode: 2=AF_PP, 1=OUT_PP, 0=INPUT, AF=5 means SPI ===\n")
full_trace(0x08008944, count=1500, stop_at=0x08008D10)
