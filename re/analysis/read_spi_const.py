#!/usr/bin/env python3
"""Read all pool constants from FUN_08008944 area."""
import struct

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
def u32(a): return struct.unpack_from("<I", data, a - BASE)[0]

GPIO = {0x40020000:"GPIOA", 0x40020400:"GPIOB", 0x40020800:"GPIOC",
        0x40020C00:"GPIOD", 0x40021000:"GPIOE", 0x40021C00:"GPIOH"}
SPI  = {0x40013000:"SPI1", 0x40003800:"SPI2", 0x40003C00:"SPI3",
        0x40013400:"SPI4", 0x40015000:"SPI5", 0x40015400:"SPI6"}
I2C  = {0x40005400:"I2C1", 0x40005800:"I2C2", 0x40005C00:"I2C3"}
SAI  = {0x40015800:"SAI1", 0x40015A00:"SAI2"}
ADC  = {0x40012000:"ADC1", 0x40012100:"ADC2", 0x40012200:"ADC3"}
USART = {0x40011000:"USART1", 0x40004400:"USART2", 0x40004800:"USART3",
         0x40004C00:"UART4",  0x40005000:"UART5",  0x40011400:"USART6"}
I2S  = {0x40003800:"SPI2/I2S2", 0x40003C00:"SPI3/I2S3"}
ALL  = {**GPIO, **SPI, **I2C, **SAI, **ADC, **USART}

print("=== Constants from 0x08008D84 to 0x08008DA0 ===")
for offset in range(0x8D84, 0x8DA8, 4):
    addr = BASE + offset
    val = u32(addr)
    desc = ALL.get(val, "")
    if not desc:
        if 0x20000000 <= val <= 0x20050000: desc = f"RAM"
        elif 0x08000000 <= val <= 0x08080000: desc = f"FLASH"
        elif 0x40000000 <= val <= 0x60000000: desc = f"Periph 0x{val:08X}"
    print(f"  0x{addr:08X} = 0x{val:08X}  {desc}")

# Also check what SPI pins are used (look for AF5 in MODER/AFRL registers at GPIO bases)
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS); md.detail = True
def foff(a): return a - BASE
def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

# Scan for HAL_GPIO_Init calls with AF=5 (SPI1)
HAL_GPIO_INIT = 0x080117B0
print("\n=== GPIO Init calls with AF=5 (SPI1) anywhere in firmware ===")
CODE_RANGES = [(0x08000000, 0x08009938), (0x08010000, 0x0801ACCC)]
for s, e in CODE_RANGES:
    pos = s
    regs = [None]*16
    stack = {}
    while pos < e:
        for ins in md.disasm(data[foff(pos):foff(e)], pos, count=1):
            ops = ins.operands; m = ins.mnemonic
            o0 = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None
            try:
                if m == "push": regs = [None]*16; stack = {}
                elif m in ("sub","add") and o0 == 13: stack = {}
                elif m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    if md.reg_name(ops[1].mem.base)=="sp":
                        sv = regs[rn(ops[0].reg)] if ops[0].type==ARM_OP_REG else None
                        stack[ops[1].mem.disp] = sv
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mp = ops[1].mem
                    if md.reg_name(mp.base) == "pc":
                        la = ((ins.address+4)&~3)+mp.disp
                        if o0 is not None: regs[o0] = struct.unpack_from("<I",data,foff(la))[0] if 0<=foff(la)<=len(data)-4 else None
                    elif md.reg_name(mp.base) == "sp":
                        if o0 is not None: regs[o0] = stack.get(mp.disp)
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
                if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                    tgt = ops[0].imm
                    if tgt == HAL_GPIO_INIT:
                        r0v = regs[0]
                        port = GPIO.get(r0v, f"0x{r0v:08X}" if isinstance(r0v, int) else "?")
                        # Try to get AF from stack or r2 area (Alternate is at offset 16 in struct)
                        r1v = regs[1]  # pointer to struct
                        # If struct is on stack, try to read Alternate (offset 16 from struct pointer)
                        # But we'd need to know the struct base...
                        print(f"  HAL_GPIO_Init(GPIO{port}) @ 0x{ins.address:08X}  r1={r1v!r}")
                    for k in (0,1,2,3,12): regs[k] = None
            except: pass
            pos += ins.size; break
        else: pos += 2
