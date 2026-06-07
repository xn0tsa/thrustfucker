#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM
BASE=0x08000000
data=open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin","rb").read()
def u32(o): return struct.unpack_from("<I",data,o)[0]
def foff(a): return a-BASE
PERI={0x40020000:"GPIOA",0x40020400:"GPIOB",0x40020800:"GPIOC",0x40020C00:"GPIOD",
0x40023800:"RCC",0x40012000:"ADC1",0x40013C00:"EXTI",0x40013800:"SYSCFG"}
md=Cs(CS_ARCH_ARM, CS_MODE_THUMB|CS_MODE_MCLASS); md.detail=True

for (name,s,e) in (("A",0x08000000,0x08009938),("C",0x08010000,0x0801ACCC)):
    code=data[foff(s):foff(e)]
    n=ldrlit=strs=0; perils=[]; sstr=[]
    for ins in md.disasm(code,s):
        n+=1
        ops=ins.operands
        if ins.mnemonic.startswith("ldr") and ops and ops[-1].type==ARM_OP_MEM:
            mem=ops[-1].mem
            if md.reg_name(mem.base)=="pc":
                la=((ins.address+4)&~3)+mem.disp
                if 0<=foff(la)<=len(data)-4:
                    v=u32(foff(la)); ldrlit+=1
                    if v in PERI and len(perils)<20:
                        perils.append((ins.address, md.reg_name(ops[0].reg), PERI[v]))
        if ins.mnemonic.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
            strs+=1
            if len(sstr)<15: sstr.append((ins.address, ins.mnemonic, ins.op_str))
    print(f"=== Region {name}: instrs={n} ldr-literal={ldrlit} str-to-mem={strs} ===")
    print(" -- PERI base loads --")
    for a,r,p in perils: print(f"   0x{a:08X}  {r} <- {p}")
    print(" -- sample STR --")
    for a,m,o in sstr: print(f"   0x{a:08X}  {m} {o}")
    print()
