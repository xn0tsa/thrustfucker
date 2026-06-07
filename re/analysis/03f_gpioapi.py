#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Classe les fonctions GPIO par signature d'appel (r0=port, r1, r2) -> WritePin vs Init."""
import struct
from collections import defaultdict, Counter
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM
BASE=0x08000000
data=open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin","rb").read()
N=len(data)
def u32(o): return struct.unpack_from("<I",data,o)[0]
def foff(a): return a-BASE
GPIO={0x40020000:"A",0x40020400:"B",0x40020800:"C",0x40020C00:"D",0x40021000:"E",0x40021400:"F",0x40021800:"G",0x40021C00:"H"}
md=Cs(CS_ARCH_ARM, CS_MODE_THUMB|CS_MODE_MCLASS); md.detail=True
def rn(r):
    n=md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12,"sb":9,"sl":10}.get(n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)
def disasm_all(s,e):
    pos=s
    while pos<e:
        dec=False
        for ins in md.disasm(data[foff(pos):foff(e)],pos):
            yield ins; pos=ins.address+ins.size; dec=True
        pos+=2
bytarget=defaultdict(list)   # target -> list of (addr, port, r1, r2)
def run(s,e):
    regs=[None]*16
    for ins in disasm_all(s,e):
        regs[15]=ins.address+4; m=ins.mnemonic; ops=ins.operands
        try:
            o0=rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
            if m=="push": regs=[None]*16
            elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mem=ops[1].mem
                if md.reg_name(mem.base)=="pc":
                    la=((ins.address+4)&~3)+mem.disp; regs[o0]=u32(foff(la)) if 0<=foff(la)<=N-4 else None
                else: regs[o0]=None
            elif m=="movw" and ops[1].type==ARM_OP_IMM: regs[o0]=ops[1].imm&0xFFFF
            elif m=="movt" and ops[1].type==ARM_OP_IMM: regs[o0]=((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            elif m.split('.')[0] in ("mov","movs") and len(ops)>=2:
                regs[o0]=ops[1].imm if ops[1].type==ARM_OP_IMM else regs[rn(ops[1].reg)]
            elif m.split('.')[0] in ("lsl","lsls") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                s2=regs[rn(ops[1].reg)]; regs[o0]=(s2<<ops[2].imm)&0xFFFFFFFF if isinstance(s2,int) else None
            elif m.split('.')[0] in ("add","adds") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                s2=regs[rn(ops[1].reg)]; regs[o0]=s2+ops[2].imm if isinstance(s2,int) else None
            if m in ("bl","blx"):
                if ops and ops[0].type==ARM_OP_IMM and isinstance(regs[0],int) and regs[0] in GPIO:
                    bytarget[ops[0].imm].append((ins.address,GPIO[regs[0]],regs[1],regs[2]))
                for k in (0,1,2,3,12): regs[k]=None
        except Exception: pass
run(0x08000000,0x08009938); run(0x08010000,0x0801ACCC)

print("="*78); print("FONCTIONS GPIO appelees avec r0=port (classees par frequence)"); print("="*78)
def pinstr(port,mask):
    if not isinstance(mask,int): return "r1=?"
    bits=[i for i in range(16) if (mask>>i)&1]
    return ",".join(f"P{port}{b}" for b in bits) if bits else f"0x{mask:X}"
for tgt in sorted(bytarget, key=lambda t:-len(bytarget[t])):
    calls=bytarget[tgt]
    r1kinds=Counter(("ptr" if isinstance(c[2],int) and c[2]>=0x08000000 else
                     ("bit" if isinstance(c[2],int) and c[2] and (c[2]&(c[2]-1))==0 else
                      ("imm" if isinstance(c[2],int) else "?"))) for c in calls)
    print(f"\n fn 0x{tgt:08X}  ({len(calls)} appels)  r1: {dict(r1kinds)}")
    for a,port,r1,r2 in calls[:8]:
        r1s=f"0x{r1:X}" if isinstance(r1,int) else "?"
        r2s=f"0x{r2:X}" if isinstance(r2,int) else "?"
        print(f"    0x{a:08X} GPIO{port} r1={r1s:<8} r2={r2s:<6} -> {pinstr(port,r1)}")

print("\n"+"="*78); print("BROCHES DE SORTIE PILOTEES (via la fn dominante = WritePin probable)"); print("="*78)
dom=max(bytarget, key=lambda t:len(bytarget[t]))
outs=defaultdict(set)
for a,port,r1,r2 in bytarget[dom]:
    if isinstance(r1,int):
        for b in range(16):
            if (r1>>b)&1: outs[port].add(b)
for port in sorted(outs):
    print(f"  GPIO{port}: "+", ".join(f"P{port}{b}" for b in sorted(outs[port])))
