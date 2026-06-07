#!/usr/bin/env python3
"""Scan ENTIRE firmware for AF GPIO_Init calls (Mode=2=AF_PP or Mode=0x12=AF_OD).
Decode struct precisely by tracking both registers AND stack from function starts."""
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
# SPI AF mappings for STM32F446
SPI_AF = {
    5: "SPI1/SPI2/SPI4/SPI5",
    6: "SPI3/SAI1",
}

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

def resolve(regs, op):
    if op.type == ARM_OP_REG:
        v = regs[rn(op.reg)]
        return v
    if op.type == ARM_OP_IMM:
        return op.imm
    return None

regs = [None]*16
stk  = {}
pos  = BASE
done = 0
CODE_END = 0x08009938  # end of first code segment

print(f"{'Address':<12} {'Port':<6} {'Pins':<25} {'Mode':<12} {'Pull':<8} {'Speed':<8} {'AF':<5}")
print("-"*80)

while pos < CODE_END:
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
            regs = [None]*16; stk = {}

        elif m in ("sub","add") and len(ops)>=3 and o0==13:
            stk = {}  # stack frame changed

        elif m.startswith("str") and not m.startswith("strb") and not m.startswith("strh"):
            if len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                if md.reg_name(ops[1].mem.base)=="sp":
                    disp = ops[1].mem.disp
                    sv = resolve(regs, ops[0])
                    stk[disp] = sv

        elif m == "strd" and len(ops)>=3 and ops[2].type==ARM_OP_MEM:
            if md.reg_name(ops[2].mem.base)=="sp":
                d = ops[2].mem.disp
                stk[d]   = resolve(regs, ops[0])
                stk[d+4] = resolve(regs, ops[1])

        elif m.startswith("ldr") and not m.startswith("ldrb") and not m.startswith("ldrh"):
            if len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mp = ops[1].mem
                if md.reg_name(mp.base)=="pc":
                    la = ((ins.address+4)&~3)+mp.disp
                    if o0 is not None:
                        regs[o0] = u32(la) if 0<=foff(la)<=N-4 else None
                elif md.reg_name(mp.base)=="sp":
                    if o0 is not None:
                        regs[o0] = stk.get(mp.disp)
                else:
                    if o0 is not None:
                        regs[o0] = None

        elif m in ("movw","mov","movs") and len(ops)>=2 and ops[1].type==ARM_OP_IMM:
            if o0 is not None: regs[o0] = ops[1].imm

        elif m == "movt" and len(ops)>=2 and ops[1].type==ARM_OP_IMM:
            if o0 is not None:
                regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)

        elif m in ("add","adds") and len(ops)==3:
            if o0 is not None:
                v1 = resolve(regs, ops[1])
                v2 = resolve(regs, ops[2])
                regs[o0] = v1+v2 if isinstance(v1,int) and isinstance(v2,int) else None

        elif m in ("sub","subs") and len(ops)==3 and o0!=13:
            if o0 is not None:
                v1 = resolve(regs, ops[1])
                v2 = resolve(regs, ops[2])
                regs[o0] = v1-v2 if isinstance(v1,int) and isinstance(v2,int) else None

        elif m in ("orr","orrs") and len(ops)==3:
            if o0 is not None:
                v1 = resolve(regs, ops[1])
                v2 = resolve(regs, ops[2])
                if isinstance(v1,int) and isinstance(v2,int): regs[o0] = v1|v2
                elif isinstance(v2,int): regs[o0] = v2
                else: regs[o0] = None

        elif m == "mov" and len(ops)==2 and ops[1].type==ARM_OP_REG:
            if o0 is not None:
                regs[o0] = regs[rn(ops[1].reg)]

        elif m in ("lsls","lsl","lsrs","lsr") and len(ops)==3:
            if o0 is not None:
                v1 = resolve(regs, ops[1])
                v2 = resolve(regs, ops[2])
                if isinstance(v1,int) and isinstance(v2,int):
                    regs[o0] = (v1<<v2)&0xFFFFFFFF if "l" in m else (v1>>v2)
                else: regs[o0] = None

        if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
            tgt = ops[0].imm
            if tgt == HAL_GPIO_INIT:
                r0v = regs[0]
                port = GPIO.get(r0v, f"0x{r0v:08X}" if isinstance(r0v,int) else "?")
                # GPIO_InitTypeDef starts at sp (r1=sp)
                pin_v  = stk.get(0)
                mode_v = stk.get(4)
                pull_v = stk.get(8)
                spd_v  = stk.get(12)
                alt_v  = stk.get(16)
                mode_s = {0:"INPUT",1:"OUT_PP",0x11:"OUT_OD",2:"AF_PP",0x12:"AF_OD",3:"ANALOG"
                          }.get(mode_v, f"0x{mode_v:x}" if isinstance(mode_v,int) else "?")
                pull_s = {0:"NoPull",1:"PU",2:"PD"}.get(pull_v, f"{pull_v!r}")
                pins   = [p for p in range(16) if isinstance(pin_v,int) and (pin_v>>p)&1]
                pin_names = ",".join(f"P{port}{'ABCD'[list(GPIO.values()).index(port)]}{p}"
                                     if port in GPIO.values() else str(p) for p in pins) if port in GPIO.values() else str(pins)
                try:
                    pn = "".join(f"P{port[-1]}{p}/" for p in pins).rstrip("/")
                except: pn = str(pins)
                af_s = f"{alt_v}={SPI_AF.get(alt_v,'AF'+str(alt_v))}" if isinstance(alt_v,int) else str(alt_v)
                # Only print AF lines (mode = AF_PP or AF_OD)
                if mode_v in (2, 0x12):
                    print(f"0x{ins.address:08X}  {port:<6} pins={pins!r:<25} {mode_s:<12} {pull_s:<8} spd={spd_v!r:<6} AF={af_s}")
            # Clear caller-saved
            for k in (0,1,2,3,12): regs[k] = None
    except Exception as ex:
        pass

    pos += ins.size

# Also scan the second code range
print("\n--- second range 0x08010000-0x0801ACCC ---")
pos = 0x08010000
regs = [None]*16; stk = {}
CODE_END2 = 0x0801ACCC
while pos < CODE_END2:
    seg = data[foff(pos):foff(pos)+4]
    gen = list(md.disasm(seg, pos, count=1))
    if not gen:
        pos += 2; continue
    ins = gen[0]
    ops = ins.operands; m = ins.mnemonic
    o0 = rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
    try:
        if m=="push": regs=[None]*16; stk={}
        elif m in ("sub","add") and len(ops)>=3 and o0==13: stk={}
        elif m.startswith("str") and not m.startswith("strb") and not m.startswith("strh"):
            if len(ops)>=2 and ops[1].type==ARM_OP_MEM and md.reg_name(ops[1].mem.base)=="sp":
                stk[ops[1].mem.disp] = resolve(regs, ops[0])
        elif m=="strd" and len(ops)>=3 and ops[2].type==ARM_OP_MEM:
            if md.reg_name(ops[2].mem.base)=="sp":
                d=ops[2].mem.disp; stk[d]=resolve(regs,ops[0]); stk[d+4]=resolve(regs,ops[1])
        elif m.startswith("ldr") and not m.startswith("ldrb") and not m.startswith("ldrh"):
            if len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mp=ops[1].mem
                if md.reg_name(mp.base)=="pc":
                    la=((ins.address+4)&~3)+mp.disp
                    if o0 is not None: regs[o0]=u32(la) if 0<=foff(la)<=N-4 else None
                elif md.reg_name(mp.base)=="sp":
                    if o0 is not None: regs[o0]=stk.get(mp.disp)
                else:
                    if o0 is not None: regs[o0]=None
        elif m in ("movw","mov","movs") and len(ops)>=2 and ops[1].type==ARM_OP_IMM:
            if o0 is not None: regs[o0]=ops[1].imm
        elif m=="movt" and len(ops)>=2 and ops[1].type==ARM_OP_IMM:
            if o0 is not None: regs[o0]=((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
        elif m in ("add","adds") and len(ops)==3:
            v1=resolve(regs,ops[1]); v2=resolve(regs,ops[2])
            if o0 is not None: regs[o0]=v1+v2 if isinstance(v1,int) and isinstance(v2,int) else None
        elif m=="mov" and len(ops)==2 and ops[1].type==ARM_OP_REG:
            if o0 is not None: regs[o0]=regs[rn(ops[1].reg)]
        if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
            if ops[0].imm==HAL_GPIO_INIT:
                r0v=regs[0]; port=GPIO.get(r0v,f"0x{r0v:08X}" if isinstance(r0v,int) else "?")
                mode_v=stk.get(4)
                if mode_v in (2,0x12):
                    alt_v=stk.get(16); pins=[p for p in range(16) if isinstance(stk.get(0),int) and (stk.get(0)>>p)&1]
                    print(f"0x{ins.address:08X}  {port:<6} pins={pins!r:<25} mode=0x{mode_v:x} AF={alt_v}")
            for k in (0,1,2,3,12): regs[k]=None
    except: pass
    pos += ins.size
