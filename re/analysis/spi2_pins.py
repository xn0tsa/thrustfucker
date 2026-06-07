#!/usr/bin/env python3
"""Disassemble FUN near SPI2 init to find GPIO AF configuration."""
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

GPIO_NAMES = {0x40020000:"GPIOA", 0x40020400:"GPIOB", 0x40020800:"GPIOC", 0x40020C00:"GPIOD"}

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

HAL_GPIO_INIT = 0x080117B0

def disasm_tracked(start, count=60):
    """Disasm with register tracking, output annotated instructions."""
    regs = [None]*16
    stk  = {}
    pos  = start
    done = 0
    while done < count and pos < BASE + N:
        for ins in md.disasm(data[foff(pos):foff(pos)+4], pos, count=1):
            ops = ins.operands; m = ins.mnemonic
            o0 = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None
            try:
                if m == "push": regs = [None]*16; stk = {}
                elif m in ("sub","add") and o0 == 13: stk = {}
                elif m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    if md.reg_name(ops[1].mem.base)=="sp":
                        sv = regs[rn(ops[0].reg)] if ops[0].type==ARM_OP_REG else (ops[0].imm if ops[0].type==ARM_OP_IMM else None)
                        stk[ops[1].mem.disp] = sv
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mp = ops[1].mem
                    if md.reg_name(mp.base) == "pc":
                        la = ((ins.address+4)&~3)+mp.disp
                        if o0 is not None: regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
                    elif md.reg_name(mp.base) == "sp":
                        if o0 is not None: regs[o0] = stk.get(mp.disp)
                    else:
                        if o0 is not None: regs[o0] = None
                elif m in ("movw","mov","movs") and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
                    regs[o0] = ops[1].imm
                elif m == "movt" and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
                    regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
                elif m in ("add","adds","sub","subs") and len(ops)==3 and ops[2].type==ARM_OP_IMM and o0 is not None:
                    sv = regs[rn(ops[1].reg)]
                    if isinstance(sv, int): regs[o0] = sv + ops[2].imm if "add" in m else sv - ops[2].imm
                    else: regs[o0] = None
            except: pass
            note = ""
            if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                tgt = ops[0].imm
                if tgt == HAL_GPIO_INIT:
                    r0v = regs[0]; r1v = regs[1]
                    port = GPIO_NAMES.get(r0v, f"0x{r0v:08X}" if isinstance(r0v, int) else "?")
                    # Read struct from stack if r1 is sp-relative
                    if isinstance(r1v, int) and 0x20000000 <= r1v <= 0x20050000:
                        note = f"  GPIO_Init(GPIO{port}, ptr={r1v:#010x})"
                    else:
                        # Try to read from tracked stack
                        pin_val  = stk.get(0, None)   # if struct starts at sp+0
                        mode_val = stk.get(4, None)
                        alt_val  = stk.get(16, None)
                        note = f"  GPIO_Init(GPIO{port}, Pin=0x{pin_val:04X}, Mode=0x{mode_val:X}, AF={alt_val})" if pin_val else f"  GPIO_Init(GPIO{port})"
                else:
                    note = f"  -> fn 0x{tgt:08X}"
            r0s = f"0x{regs[0]:08X}" if isinstance(regs[0],int) else "?"
            r1s = f"0x{regs[1]:08X}" if isinstance(regs[1],int) else "?"
            print(f"  0x{ins.address:08X}  {m:<10} {ins.op_str:<30} r0={r0s} r1={r1s}{note}")
            pos += ins.size; done += 1; break
        else: pos += 2

# The SPI2 GPIO init is likely in FUN_08005328 (called from FUN_08008944 line 43)
# or in the area just before the SPI handle init in FUN_08008944
# The SPI2 handle init is at piVar4[-0x2c] which corresponds to bytes before the
# I2C init (around assembly address 0x08008C00).
# Let's look at the area right before where we see the SPI handle init.
# The decompiled code shows FUN_08015040 called after filling the SPI struct.
# SPI2 handle is at piVar4-0x2c, piVar4 = 0x200026E0, so handle at 0x200026E0-0xB0=0x20002630
# The GPIO for SPI should be configured BEFORE HAL_SPI_Init.

# Let's look at FUN_08005328 (second function called in FUN_08008944)
print("=== FUN_08005328 (GPIO/periph init called from FUN_08008944) ===")
disasm_tracked(0x08005328, 80)

print("\n=== Context around HAL_SPI_Init (FUN_08015040) calls ===")
# Find all BL to HAL_SPI_Init
for s,e in [(0x08000000,0x08009938),(0x08010000,0x0801ACCC)]:
    pos = s
    while pos < e:
        for ins in md.disasm(data[foff(pos):foff(e)], pos, count=1):
            if ins.mnemonic == "bl" and ins.operands and ins.operands[0].type == ARM_OP_IMM:
                if ins.operands[0].imm == 0x08015040:
                    print(f"\n  HAL_SPI_Init called @ 0x{ins.address:08X}")
                    print(f"  === Context 20 insns before 0x{ins.address:08X} ===")
                    disasm_tracked(ins.address - 0x50, 30)
            pos += ins.size; break
        else: pos += 2
