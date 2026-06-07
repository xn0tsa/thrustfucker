#!/usr/bin/env python3
"""Check if PB10 (SPI2_SCK AF5) is configured anywhere, and disassemble FUN_08013224."""
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

# Print pool constants near MspInit (0x08003870-0x08003890) to confirm what's loaded
print("=== Pool constants in MspInit area ===")
for addr in range(0x08003870, 0x080038A0, 4):
    v = u32(addr)
    desc = {0x40020000:"GPIOA",0x40020400:"GPIOB",0x40020800:"GPIOC",0x40020C00:"GPIOD",
            0x40003800:"SPI2",0x40003C00:"SPI3",0x40013000:"SPI1",
            0x40023800:"RCC",0x40023830:"RCC_AHB1ENR",0x40023840:"RCC_APB1ENR",
            0x40023844:"RCC_APB2ENR"}.get(v, "")
    print(f"  0x{addr:08X} = 0x{v:08X}  {desc}")

# Also dump the raw bytes around the function end/start (pool area)
print("\n=== Pool values near GPIOB init in earlier functions ===")
for addr in range(0x08003290, 0x080032B0, 4):
    v = u32(addr)
    desc = {0x40020000:"GPIOA",0x40020400:"GPIOB",0x40020800:"GPIOC",0x40020C00:"GPIOD",
            0x40003800:"SPI2",0x40003C00:"SPI3",0x40013000:"SPI1",
            0x40023800:"RCC",0x40023830:"RCC_AHB1ENR",0x40023840:"RCC_APB1ENR",
            0x40023844:"RCC_APB2ENR"}.get(v, "")
    print(f"  0x{addr:08X} = 0x{v:08X}  {desc}")

# Now look for any GPIO_Init calls with GPIOB that configure pin 10 (0x400)
print("\n=== Scanning for GPIOB GPIO_Init with pin 0x400 (PB10) ===")
HAL_GPIO_INIT = 0x080117B0
CODE_RANGES = [(0x08000000, 0x08009938), (0x08010000, 0x0801ACCC)]
regs = [None]*16; stk = {}
def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

for s, e in CODE_RANGES:
    pos = s
    while pos < e:
        seg = data[foff(pos):foff(e)]; gen = list(md.disasm(seg, pos, count=1))
        if not gen: pos+=2; continue
        ins=gen[0]; ops=ins.operands; m=ins.mnemonic
        o0=rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
        try:
            if m=="push": regs=[None]*16; stk={}
            elif (m in ("sub","add") and len(ops)>=3 and o0==13): stk={}
            elif m.startswith("str") and not m.startswith("strb") and len(ops)>=2 and ops[1].type==ARM_OP_MEM and md.reg_name(ops[1].mem.base)=="sp":
                stk[ops[1].mem.disp] = regs[o0] if o0 is not None else None
            elif m=="strd" and len(ops)>=3 and ops[2].type==ARM_OP_MEM and md.reg_name(ops[2].mem.base)=="sp":
                d=ops[2].mem.disp
                stk[d]=regs[rn(ops[0].reg)] if ops[0].type==ARM_OP_REG else None
                stk[d+4]=regs[rn(ops[1].reg)] if ops[1].type==ARM_OP_REG else None
            elif m.startswith("ldr") and not m.startswith("ldrb") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mp=ops[1].mem
                if md.reg_name(mp.base)=="pc":
                    la=((ins.address+4)&~3)+mp.disp
                    if o0 is not None: regs[o0]=u32(la) if 0<=foff(la)<=N-4 else None
                elif md.reg_name(mp.base)=="sp":
                    if o0 is not None: regs[o0]=stk.get(mp.disp)
                else:
                    if o0 is not None: regs[o0]=None
            elif m.startswith("mov") and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
                regs[o0]=ops[1].imm
            elif m=="movt" and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
                regs[o0]=((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            elif m=="mov" and len(ops)==2 and ops[1].type==ARM_OP_REG and o0 is not None:
                regs[o0]=regs[rn(ops[1].reg)]
            if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM and ops[0].imm==HAL_GPIO_INIT:
                r0v=regs[0]; pin_v=stk.get(0); alt_v=stk.get(16); mode_v=stk.get(4)
                port=GPIO.get(r0v,"?")
                pins=[p for p in range(16) if isinstance(pin_v,int) and (pin_v>>p)&1]
                if port=="GPIOB" and 10 in pins:
                    print(f"  FOUND! GPIO_Init(GPIOB, pins={pins}, mode={mode_v}, AF={alt_v}) @ 0x{ins.address:08X}")
                elif isinstance(pin_v,int) and (pin_v >> 10)&1:
                    print(f"  GPIO_Init({port}, pin includes PB10, mode={mode_v}, AF={alt_v}) @ 0x{ins.address:08X}")
                for k in (0,1,2,3,12): regs[k]=None
        except: pass
        pos+=ins.size

print("\n=== FUN_08013224 disassembly (first 60 insns) ===")
pos = 0x08013224; cnt = 0; regs=[None]*16; stk={}
while cnt < 60 and pos < BASE+N:
    seg=data[foff(pos):foff(pos)+4]; gen=list(md.disasm(seg, pos, count=1))
    if not gen: pos+=2; continue
    ins=gen[0]; ops=ins.operands; m=ins.mnemonic
    o0=rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
    try:
        if m.startswith("ldr") and not m.startswith("ldrb") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
            mp=ops[1].mem
            if md.reg_name(mp.base)=="pc":
                la=((ins.address+4)&~3)+mp.disp
                if o0 is not None: regs[o0]=u32(la) if 0<=foff(la)<=N-4 else None
        elif m.startswith("mov") and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
            regs[o0]=ops[1].imm
        elif m=="movt" and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
            regs[o0]=((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
        elif m=="mov" and len(ops)==2 and ops[1].type==ARM_OP_REG and o0 is not None:
            regs[o0]=regs[rn(ops[1].reg)]
        elif m=="push": regs=[None]*16; stk={}
        ann=""
        if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
            tgt=ops[0].imm
            r0v=regs[0]
            if tgt==HAL_GPIO_INIT:
                port=GPIO.get(r0v,"?"); pin_v=stk.get(0); mode_v=stk.get(4); alt_v=stk.get(16)
                pins=[p for p in range(16) if isinstance(pin_v,int) and (pin_v>>p)&1]
                ann=f"  >>> GPIO_Init({port}, pins={pins}, mode={mode_v}, AF={alt_v})"
            else:
                ann=f"  >>> fn 0x{tgt:08X}"
            for k in (0,1,2,3,12): regs[k]=None
    except: pass
    r0s=f"0x{regs[0]:08X}" if isinstance(regs[0],int) else "?"
    print(f"  0x{ins.address:08X}  {m:<12} {ins.op_str:<32} r0={r0s}{ann}")
    pos+=ins.size; cnt+=1

# Check what the ldr at 0x0800379C reads (the SPI handle Instance)
# Also verify: what constant is at the pool address 0x08003878 (r2 in MspInit)
print("\n=== Key pool addresses in MspInit ===")
# r2 pool: ldr r2, [pc, #0xc4] at 0x080037B2
# PC = 0x080037B2+4 = 0x080037B6, aligned = 0x080037B4
# Pool = 0x080037B4 + 0xC4 = 0x08003878
v = u32(0x08003878)
print(f"  r2 pool (0x08003878) = 0x{v:08X}  (RCC APB1ENR = 0x40023840? RCC APB2ENR = 0x40023844?)")
# r0 pool: ldr r0, [pc, #0xc4] at 0x080037B4
# PC = 0x080037B4+4 = 0x080037B8, aligned = 0x080037B8
# Pool = 0x080037B8 + 0xC4 = 0x0800387C
v2 = u32(0x0800387C)
print(f"  r0 pool (0x0800387C) = 0x{v2:08X}  GPIO = {GPIO.get(v2,'unknown')}")
# r1 pool: ldr r1, [pc, #0xd0] at 0x080037A0
# PC = 0x080037A0+4 = 0x080037A4, aligned = 0x080037A4
# Pool = 0x080037A4 + 0xD0 = 0x08003874
v3 = u32(0x08003874)
print(f"  r1 pool (0x08003874) = 0x{v3:08X}  (RCC_AHB1ENR = 0x40023830?)")
# SPI1 path: ldr r0, [pc, #0x74] at 0x0800380A
# PC = 0x0800380A+4 = 0x0800380E, aligned = 0x0800380C (wait, 0x0800380E & ~3 = 0x0800380C)
# Pool = 0x0800380C + 0x74 = 0x08003880
v4 = u32(0x08003880)
print(f"  SPI1 r0 pool (0x08003880) = 0x{v4:08X}")
# SPI1 path: ldr r0, [pc, #0x4c] at 0x08003834
# PC = 0x08003834+4 = 0x08003838, aligned = 0x08003838
# Pool = 0x08003838 + 0x4c = 0x08003884
v5 = u32(0x08003884)
print(f"  SPI1 GPIOA pool (0x08003884) = 0x{v5:08X}  GPIO = {GPIO.get(v5,'unknown')}")
