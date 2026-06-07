#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extraction du PINOUT via les appels HAL_GPIO_Init(GPIOx, &GPIO_InitTypeDef).
- desassemblage resilient (saute les pools de donnees)
- traçage registres + modele de pile pour reconstruire la struct d'init
  GPIO_InitTypeDef = { u32 Pin; u32 Mode; u32 Pull; u32 Speed; u32 Alternate }
"""
import struct
from collections import Counter
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

BASE=0x08000000
data=open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin","rb").read()
N=len(data)
def u32(o): return struct.unpack_from("<I",data,o)[0]
def foff(a): return a-BASE
GPIO={0x40020000:"A",0x40020400:"B",0x40020800:"C",0x40020C00:"D",0x40021000:"E",
      0x40021400:"F",0x40021800:"G",0x40021C00:"H"}
md=Cs(CS_ARCH_ARM, CS_MODE_THUMB|CS_MODE_MCLASS); md.detail=True
def rn(r):
    n=md.reg_name(r);
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

def disasm_all(start,end):
    pos=start
    while pos<end:
        dec=False
        for ins in md.disasm(data[foff(pos):foff(end)], pos):
            yield ins; pos=ins.address+ins.size; dec=True
        pos+=2 if not dec else 2  # skip the offending halfword and resync

MODES={0x00:"INPUT",0x01:"OUTPUT_PP",0x11:"OUTPUT_OD",0x02:"AF_PP",0x12:"AF_OD",0x03:"ANALOG",
0x10110000:"IT_RISING",0x10210000:"IT_FALLING",0x10310000:"IT_RIS_FALL",
0x10120000:"EVT_RISING",0x10220000:"EVT_FALLING"}
PULL={0:"none",1:"PU",2:"PD"}
calls=[]      # (addr, port, fields dict)
btargets=Counter()

def run(start,end):
    regs=[None]*16
    stack={}
    recent=[]
    for ins in disasm_all(start,end):
        regs[15]=ins.address+4
        m=ins.mnemonic; ops=ins.operands
        try:
            if m=="push": regs=[None]*16; stack={}
            elif m in ("sub","add") and ops and rn(ops[0].reg)==13: stack={}  # sp change
            elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                d=rn(ops[0].reg); mem=ops[1].mem; bn=md.reg_name(mem.base)
                if bn=="pc":
                    la=((ins.address+4)&~3)+mem.disp
                    regs[d]=u32(foff(la)) if 0<=foff(la)<=N-4 else None
                elif bn=="sp": regs[d]=stack.get(mem.disp)
                else: regs[d]=None
            elif m=="movw" and ops[1].type==ARM_OP_IMM: regs[rn(ops[0].reg)]=ops[1].imm&0xFFFF
            elif m=="movt" and ops[1].type==ARM_OP_IMM:
                d=rn(ops[0].reg); regs[d]=((regs[d] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            elif m in ("mov","movs","mov.w") and len(ops)>=2:
                d=rn(ops[0].reg)
                regs[d]=ops[1].imm if ops[1].type==ARM_OP_IMM else regs[rn(ops[1].reg)]
            elif m.startswith("add") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                d=rn(ops[0].reg); s=ops[1].reg
                if md.reg_name(s)=="sp": regs[d]=("SP",ops[2].imm)
                else:
                    sv=regs[rn(s)]; regs[d]=(sv+ops[2].imm) if isinstance(sv,int) else None
            elif m.startswith("orr") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                recent.append(ops[2].imm); d=rn(ops[0].reg); s=regs[rn(ops[1].reg)]
                regs[d]=(s|ops[2].imm) if isinstance(s,int) else None
            elif m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                d=rn(ops[0].reg); mem=ops[1].mem
                if md.reg_name(mem.base)=="sp":
                    v=regs[d] if d is not None else None
                    if isinstance(v,int): stack[mem.disp]=v
                    else: stack.pop(mem.disp,None)
            if m in ("bl","blx"):
                if ops and ops[0].type==ARM_OP_IMM and isinstance(regs[0],int) and regs[0] in GPIO:
                    btargets[ops[0].imm]+=1
                    port=GPIO[regs[0]]; ptr=regs[1]; f={}
                    base=None
                    if isinstance(ptr,tuple) and ptr[0]=="SP":
                        base=ptr[1]
                        for i,fld in enumerate(("Pin","Mode","Pull","Speed","Alt")):
                            f[fld]=stack.get(base+i*4)
                    elif isinstance(ptr,int) and 0<=foff(ptr)<=N-20:
                        for i,fld in enumerate(("Pin","Mode","Pull","Speed","Alt")):
                            f[fld]=u32(foff(ptr)+i*4)
                    calls.append((ins.address,port,f))
                for k in (0,1,2,3,12): regs[k]=None
            if len(recent)>6: recent[:]=recent[-6:]
        except Exception:
            pass

run(0x08000000,0x08009938)
run(0x08010000,0x0801ACCC)

print("="*78); print(f"APPELS HAL_GPIO_Init detectes : {len(calls)}"); print("="*78)
if btargets:
    t,c=btargets.most_common(1)[0]
    print(f"Cible la plus appelee avec r0=GPIO : 0x{t:08X} (x{c})  => probable HAL_GPIO_Init\n")

pinmap={}  # (port,pin)->list of configs
for addr,port,f in calls:
    pin=f.get("Pin"); mode=f.get("Mode"); pull=f.get("Pull"); alt=f.get("Alt")
    ms=MODES.get(mode, f"0x{mode:08X}" if isinstance(mode,int) else "?")
    ps=PULL.get(pull,"?") if isinstance(pull,int) else "?"
    pins=[i for i in range(16) if isinstance(pin,int) and (pin>>i)&1]
    pinstr=",".join(f"P{port}{i}" for i in pins) if pins else (f"mask=0x{pin:X}" if isinstance(pin,int) else "?")
    print(f" 0x{addr:08X}  GPIO{port}  {pinstr:<22} mode={ms:<10} pull={ps:<4} "
          f"AF={alt if isinstance(alt,int) else '?'}")
    for i in pins:
        pinmap.setdefault((port,i),[]).append((ms,ps,alt))

print("\n"+"="*78); print("PINOUT CONSOLIDE (par broche)"); print("="*78)
for (port,pin) in sorted(pinmap):
    cfgs=pinmap[(port,pin)]
    ms,ps,alt=cfgs[-1]
    afs=f" AF{alt}" if isinstance(alt,int) and alt and ms.startswith("AF") else ""
    print(f"  P{port}{pin:<2}  {ms}{afs}  pull={ps}")
