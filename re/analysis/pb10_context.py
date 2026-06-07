#!/usr/bin/env python3
"""Disassemble the function containing 0x08003664 (GPIOB PB2+PB10 init)."""
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

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

def resolve(regs, op):
    if op.type == ARM_OP_REG: return regs[rn(op.reg)]
    if op.type == ARM_OP_IMM: return op.imm
    return None

# Find function start before 0x08003664 by scanning backward for "push"
# Walk backward by 2 bytes looking for push instruction
target = 0x08003664
fn_start = target
for addr in range(target - 2, target - 300, -2):
    seg = data[foff(addr):foff(addr)+4]
    gen = list(md.disasm(seg, addr, count=1))
    if gen and gen[0].mnemonic in ("push", "push.w"):
        fn_start = addr
        break

print(f"=== Function containing 0x08003664 (starts ~0x{fn_start:08X}) ===")
# Disassemble 200 instructions starting from fn_start
regs = [None]*16; stk = {}; pos = fn_start; done = 0
while done < 200 and pos < BASE+N:
    seg = data[foff(pos):foff(pos)+4]
    gen = list(md.disasm(seg, pos, count=1))
    if not gen: pos+=2; continue
    ins=gen[0]; ops=ins.operands; m=ins.mnemonic
    o0=rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
    try:
        if m in ("push","push.w"): regs=[None]*16; stk={}
        elif m in ("sub","sub.w") and o0==13: stk={}
        elif (m.startswith("str") and not m.startswith("strb") and not m.startswith("strh")
              and len(ops)>=2 and ops[1].type==ARM_OP_MEM
              and md.reg_name(ops[1].mem.base)=="sp"):
            stk[ops[1].mem.disp] = regs[o0] if o0 is not None else None
        elif (m.startswith("strd") and len(ops)>=3 and ops[2].type==ARM_OP_MEM
              and md.reg_name(ops[2].mem.base)=="sp"):
            d=ops[2].mem.disp
            stk[d]=regs[rn(ops[0].reg)] if ops[0].type==ARM_OP_REG else None
            stk[d+4]=regs[rn(ops[1].reg)] if ops[1].type==ARM_OP_REG else None
        elif m.startswith("ldr") and not m.startswith("ldrb") and not m.startswith("ldrh") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
            mp=ops[1].mem
            if md.reg_name(mp.base)=="pc":
                la=((ins.address+4)&~3)+mp.disp
                if o0 is not None: regs[o0]=u32(la) if 0<=foff(la)<=N-4 else None
            elif md.reg_name(mp.base)=="sp":
                if o0 is not None: regs[o0]=stk.get(mp.disp)
            else:
                if o0 is not None: regs[o0]=None
        elif m.startswith("mov") and len(ops)>=2:
            if ops[1].type==ARM_OP_IMM and o0 is not None: regs[o0]=ops[1].imm
            elif ops[1].type==ARM_OP_REG and o0 is not None: regs[o0]=regs[rn(ops[1].reg)]
        elif m=="movt" and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
            regs[o0]=((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
        elif m in ("orr","orr.w","orrs") and len(ops)==3:
            v1=resolve(regs,ops[1]); v2=resolve(regs,ops[2])
            if o0 is not None: regs[o0]=(v1|v2) if isinstance(v1,int) and isinstance(v2,int) else None
        elif m in ("add","add.w","adds") and len(ops)==3:
            v1=resolve(regs,ops[1]); v2=resolve(regs,ops[2])
            if o0 is not None: regs[o0]=v1+v2 if isinstance(v1,int) and isinstance(v2,int) else None
        elif m in ("lsl","lsls","lsl.w") and len(ops)==3:
            v1=resolve(regs,ops[1]); v2=resolve(regs,ops[2])
            if o0 is not None: regs[o0]=(v1<<v2)&0xFFFFFFFF if isinstance(v1,int) and isinstance(v2,int) else None
        elif m in ("sub","subs","sub.w") and len(ops)==3 and o0!=13:
            v1=resolve(regs,ops[1]); v2=resolve(regs,ops[2])
            if o0 is not None: regs[o0]=v1-v2 if isinstance(v1,int) and isinstance(v2,int) else None
    except: pass
    ann=""
    if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
        tgt=ops[0].imm
        r0v=regs[0]
        if tgt==0x080117B0:
            port=GPIO.get(r0v,f"0x{r0v:08X}" if isinstance(r0v,int) else "?")
            pin_v=stk.get(0); mode_v=stk.get(4); alt_v=stk.get(16)
            pins=[p for p in range(16) if isinstance(pin_v,int) and (pin_v>>p)&1]
            mode_s={0:"INPUT",1:"OUT_PP",0x11:"OUT_OD",2:"AF_PP",0x12:"AF_OD",3:"ANALOG"}.get(mode_v,str(mode_v))
            ann=f"  >>> GPIO_Init({port}, pins={pins}, mode={mode_s}, AF={alt_v})"
        else:
            ann=f"  >>> fn 0x{tgt:08X}"
        for k in (0,1,2,3,12): regs[k]=None
    r0s=f"0x{regs[0]:08X}" if isinstance(regs[0],int) else "?"
    r4s=f"0x{regs[4]:08X}" if isinstance(regs[4],int) else "?"
    stk0s=f"0x{stk.get(0):04X}" if isinstance(stk.get(0),int) else "?"
    stk4s=f"0x{stk.get(4):02X}" if isinstance(stk.get(4),int) else "?"
    stk10s=f"0x{stk.get(16):X}" if isinstance(stk.get(16),int) else "?"
    mark = " <<<<" if ins.address == target else ""
    print(f"  0x{ins.address:08X}  {m:<12} {ins.op_str:<30} r0={r0s} stk[0]={stk0s} stk[4]={stk4s} AF={stk10s}{ann}{mark}")
    pos+=ins.size; done+=1
    if m in ("pop","pop.w","bx") and "pc" in ins.op_str and pos > target+20:
        print("  (function return)")
        break
