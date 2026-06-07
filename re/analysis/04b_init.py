#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Decode TOUS les appels HAL_GPIO_Init @0x080117B0 -> pinout complet (mode/AF/analog)."""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM
BASE=0x08000000
data=open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin","rb").read()
N=len(data)
def u32(o): return struct.unpack_from("<I",data,o)[0]
def foff(a): return a-BASE
GPIO={0x40020000:"A",0x40020400:"B",0x40020800:"C",0x40020C00:"D",0x40021000:"E",0x40021400:"F",0x40021800:"G",0x40021C00:"H"}
HAL_INIT=0x080117B0
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
MODES={0x00:"INPUT",0x01:"OUTPUT_PP",0x11:"OUTPUT_OD",0x02:"AF_PP",0x12:"AF_OD",0x03:"ANALOG",
0x10110000:"IT_RIS",0x10210000:"IT_FALL",0x10310000:"IT_RF",0x10120000:"EVT_RIS",0x10220000:"EVT_FALL"}
PULL={0:"none",1:"PU",2:"PD"}
AFHINT={(10,):"USB_FS",(12,):"USB_HS/CAN",(4,):"I2C",(6,):"SAI/SPI3/I2S3",(5,):"SPI1/2/I2S2",(7,):"USART/SPI3",(8,):"UART/SAI2",(0,):"SYS/MCO",(9,):"CAN/TIM"}
def afhint(af):
    for k,v in AFHINT.items():
        if af in k: return v
    return ""
calls=[]
def run(s,e):
    regs=[None]*16; stk={}
    def clr():
        stk.clear()
        for i in range(13):
            if isinstance(regs[i],tuple): regs[i]=None
    for ins in disasm_all(s,e):
        regs[15]=ins.address+4; m=ins.mnemonic; ops=ins.operands
        try:
            o0=rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
            if m=="push": regs=[None]*16; stk.clear()
            elif m.split('.')[0] in ("sub","add","subs","adds") and o0==13: clr()
            elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mem=ops[1].mem; bn=md.reg_name(mem.base)
                if bn=="pc":
                    la=((ins.address+4)&~3)+mem.disp; regs[o0]=u32(foff(la)) if 0<=foff(la)<=N-4 else None
                elif bn=="sp": regs[o0]=stk.get(mem.disp)
                else:
                    bv=regs[rn(mem.base)]; regs[o0]=stk.get(bv[1]+mem.disp) if isinstance(bv,tuple) else None
            elif m=="movw" and ops[1].type==ARM_OP_IMM: regs[o0]=ops[1].imm&0xFFFF
            elif m=="movt" and ops[1].type==ARM_OP_IMM: regs[o0]=((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            elif m.split('.')[0] in ("mov","movs") and len(ops)>=2:
                if ops[1].type==ARM_OP_IMM: regs[o0]=ops[1].imm
                elif md.reg_name(ops[1].reg)=="sp": regs[o0]=("SP",0)
                else: regs[o0]=regs[rn(ops[1].reg)]
            elif m.split('.')[0] in ("add","adds") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                if md.reg_name(ops[1].reg)=="sp": regs[o0]=("SP",ops[2].imm)
                else:
                    sv=regs[rn(ops[1].reg)]; regs[o0]=sv+ops[2].imm if isinstance(sv,int) else None
            elif m.startswith("strd"):
                mem=ops[2].mem; bn=md.reg_name(mem.base); base=0 if bn=="sp" else (regs[rn(mem.base)][1] if isinstance(regs[rn(mem.base)],tuple) else None)
                if bn=="sp" or base is not None:
                    k=mem.disp+(0 if bn=="sp" else base)
                    for j,rr in enumerate((o0,rn(ops[1].reg))):
                        v=regs[rr]; stk[k+4*j]=v if isinstance(v,int) else stk.pop(k+4*j,None)
            elif m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mem=ops[1].mem; bn=md.reg_name(mem.base); v=regs[o0]
                k=mem.disp if bn=="sp" else (regs[rn(mem.base)][1]+mem.disp if isinstance(regs[rn(mem.base)],tuple) else None)
                if k is not None:
                    if isinstance(v,int): stk[k]=v
                    else: stk.pop(k,None)
            if m in ("bl","blx"):
                if ops and ops[0].type==ARM_OP_IMM and ops[0].imm==HAL_INIT and isinstance(regs[0],int) and regs[0] in GPIO:
                    ptr=regs[1]; f={}
                    if isinstance(ptr,tuple):
                        for i,fl in enumerate(("Pin","Mode","Pull","Speed","Alt")): f[fl]=stk.get(ptr[1]+i*4)
                    calls.append((ins.address,GPIO[regs[0]],f))
                for k in (0,1,2,3,12): regs[k]=None
        except Exception: pass
run(0x08000000,0x08009938); run(0x08010000,0x0801ACCC)

print("="*82); print(f"APPELS HAL_GPIO_Init decodes : {len(calls)}"); print("="*82)
pinmap={}
for addr,port,f in calls:
    pin,mode,pull,alt=f.get("Pin"),f.get("Mode"),f.get("Pull"),f.get("Alt")
    ms=MODES.get(mode,f"0x{mode:08X}" if isinstance(mode,int) else "?")
    ps=PULL.get(pull,str(pull)) if isinstance(pull,int) else "?"
    pins=[i for i in range(16) if isinstance(pin,int) and (pin>>i)&1]
    ps_=",".join(f"P{port}{i}" for i in pins) if pins else (f"0x{pin:X}" if isinstance(pin,int) else "?")
    afs=f"AF{alt}({afhint(alt)})" if isinstance(alt,int) and ms.startswith("AF") else ""
    print(f" 0x{addr:08X} GPIO{port:<1} {ps_:<24} {ms:<10} pull={ps:<4} {afs}")
    for i in pins:
        if isinstance(mode,int): pinmap[(port,i)]=(ms,ps,alt if isinstance(alt,int) else None)

print("\n"+"="*82); print("PINOUT CONSOLIDE (HAL_GPIO_Init)"); print("="*82)
for port,pin in sorted(pinmap):
    ms,ps,alt=pinmap[(port,pin)]
    af=f"  AF{alt}({afhint(alt)})" if isinstance(alt,int) and ms.startswith("AF") else ""
    print(f"  P{port}{pin:<2}  {ms:<10} pull={ps}{af}")

print("\n"+"="*82); print(">> AXES ANALOGIQUES (Mode=ANALOG = capteurs Hall)"); print("="*82)
ana=[f"P{p}{i}" for (p,i),(ms,_,_) in sorted(pinmap.items()) if ms=="ANALOG"]
print("  "+", ".join(ana) if ana else "  (aucun trouve en immediat)")
print("\n>> FONCTIONS ALTERNEES")
for (p,i),(ms,_,alt) in sorted(pinmap.items()):
    if ms.startswith("AF"): print(f"  P{p}{i:<2} AF{alt} -> {afhint(alt)}")
