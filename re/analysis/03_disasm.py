#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Desassemblage Thumb-2 + traçage leger des registres pour resoudre les ecritures
de registres peripheriques (RCC / GPIO / ADC / SYSCFG / EXTI) du firmware STM32F446.
But : reconstituer la config horloges + le pinout (modes/AF des broches) + le mapping EXTI.
"""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
N = len(data)
def u32(o): return struct.unpack_from("<I", data, o)[0]
def foff(a): return a - BASE

PERI = {0x40020000:"GPIOA",0x40020400:"GPIOB",0x40020800:"GPIOC",0x40020C00:"GPIOD",
0x40021000:"GPIOE",0x40021400:"GPIOF",0x40021800:"GPIOG",0x40021C00:"GPIOH",
0x40023800:"RCC",0x40012000:"ADC1",0x40013C00:"EXTI",0x40013800:"SYSCFG",
0x40005400:"I2C1",0x40015800:"SAI1",0x40015C00:"SAI2",0x40003800:"SPI2",
0x40003C00:"SPI3",0x40013000:"SPI1",0x40007000:"PWR",0x40040000:"USB_HS",0x50000000:"USB_FS"}
GPIO_R={0x00:"MODER",0x04:"OTYPER",0x08:"OSPEEDR",0x0C:"PUPDR",0x10:"IDR",0x14:"ODR",
0x18:"BSRR",0x1C:"LCKR",0x20:"AFRL",0x24:"AFRH"}
RCC_R={0x00:"CR",0x08:"CFGR",0x30:"AHB1ENR",0x34:"AHB2ENR",0x40:"APB1ENR",0x44:"APB2ENR",
0x84:"PLLSAICFGR",0x88:"DCKCFGR",0x8C:"CKGATENR",0x90:"DCKCFGR2"}
SYSCFG_R={0x00:"MEMRMP",0x04:"PMC",0x08:"EXTICR1",0x0C:"EXTICR2",0x10:"EXTICR3",0x14:"EXTICR4"}

AHB1={0:"GPIOA",1:"GPIOB",2:"GPIOC",3:"GPIOD",4:"GPIOE",5:"GPIOF",6:"GPIOG",7:"GPIOH",
12:"CRC",21:"DMA1",22:"DMA2",29:"OTGHS",30:"OTGHSULPI"}
APB1={0:"TIM2",1:"TIM3",2:"TIM4",3:"TIM5",4:"TIM6",5:"TIM7",6:"TIM12",7:"TIM13",8:"TIM14",
11:"WWDG",14:"SPI2",15:"SPI3",16:"SPDIFRX",17:"USART2",18:"USART3",19:"UART4",20:"UART5",
21:"I2C1",22:"I2C2",23:"I2C3",24:"FMPI2C1",25:"CAN1",26:"CAN2",27:"CEC",28:"PWR",29:"DAC"}
APB2={0:"TIM1",1:"TIM8",4:"USART1",5:"USART6",8:"ADC1",9:"ADC2",10:"ADC3",11:"SDIO",
12:"SPI1",13:"SPI4",14:"SYSCFG",16:"TIM9",17:"TIM10",18:"TIM11",20:"SAI1",21:"SAI2"}

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS)
md.detail = True
RN = {}  # reg enum -> index
def ridx(r):
    n = md.reg_name(r)
    if n is None: return None
    return {"sp":13,"lr":14,"pc":15}.get(n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

writes = []   # (addr, base, off, value_or_None, mask_or_None, text)
def regname(base, off):
    nm = PERI.get(base,"?")
    if nm.startswith("GPIO"): return f"{nm}->{GPIO_R.get(off,hex(off))}"
    if nm=="RCC":    return f"RCC->{RCC_R.get(off,hex(off))}"
    if nm=="SYSCFG": return f"SYSCFG->{SYSCFG_R.get(off,hex(off))}"
    return f"{nm}+0x{off:X}"

def analyze(start, end):
    regs=[None]*16
    recent=[]  # (mnemonic, imm)
    code=data[foff(start):foff(end)]
    for ins in md.disasm(code, start):
        regs[15]=ins.address+4
        m=ins.mnemonic; ops=ins.operands
        try:
            if m=="push":
                regs=[None]*16
            elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mem=ops[1].mem; d=ridx(ops[0].reg)
                if md.reg_name(mem.base)=="pc" and d is not None:
                    la=((ins.address+4)&~3)+mem.disp
                    if 0<=foff(la)<=N-4: regs[d]=u32(foff(la))
                elif d is not None: regs[d]=None
            elif m=="movw" and ops[1].type==ARM_OP_IMM:
                d=ridx(ops[0].reg); regs[d]=ops[1].imm & 0xFFFF
            elif m=="movt" and ops[1].type==ARM_OP_IMM:
                d=ridx(ops[0].reg); regs[d]=((regs[d] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            elif m in ("mov","movs","mov.w") and len(ops)>=2:
                d=ridx(ops[0].reg)
                if ops[1].type==ARM_OP_IMM: regs[d]=ops[1].imm
                elif ops[1].type==ARM_OP_REG: regs[d]=regs[ridx(ops[1].reg)]
            elif m.startswith("orr") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                d=ridx(ops[0].reg); s=regs[ridx(ops[1].reg)]
                recent.append(("orr",ops[2].imm)); regs[d]=(s|ops[2].imm) if s is not None else None
            elif m.startswith("bic") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                d=ridx(ops[0].reg); s=regs[ridx(ops[1].reg)]
                recent.append(("bic",ops[2].imm)); regs[d]=(s & ~ops[2].imm) if s is not None else None
            elif m.startswith("add") and len(ops)==3 and ops[2].type==ARM_OP_IMM:
                d=ridx(ops[0].reg); s=regs[ridx(ops[1].reg)]
                regs[d]=(s+ops[2].imm) if s is not None else None
            elif m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mem=ops[1].mem; b=ridx(mem.base); base=regs[b] if b is not None else None
                if base in PERI:
                    rt=ridx(ops[0].reg); val=regs[rt] if rt is not None else None
                    mask=None
                    for mm,im in reversed(recent[-4:]):
                        if mm=="orr": mask=im; break
                    writes.append((ins.address, base, mem.disp, val, mask,
                                   f"{m} {ins.op_str}"))
            if m in ("bl","blx"):
                for k in (0,1,2,3,12): regs[k]=None
            if len(recent)>8: recent[:]=recent[-8:]
        except Exception:
            pass

for s,e in ((0x08000000,0x08009938),(0x08010000,0x0801ACCC)):
    analyze(s,e)

print("="*78); print(f"ECRITURES REGISTRES PERIPHERIQUES RESOLUES ({len(writes)})"); print("="*78)
for a,base,off,val,mask,txt in writes:
    rn=regname(base,off)
    vs = f"val=0x{val:08X}" if val is not None else (f"orrmask=0x{mask:08X}" if mask else "val=?")
    print(f" 0x{a:08X}  {rn:<16} {vs:<22} | {txt}")

# --- Decode RCC enables ---
def decbits(v,d): return ", ".join(d[b] for b in sorted(d) if v>>b & 1)
print("\n"+"="*78); print("HORLOGES RCC (union des masques sur *ENR)"); print("="*78)
acc={"AHB1ENR":0,"APB1ENR":0,"APB2ENR":0,"AHB2ENR":0}
for a,base,off,val,mask,txt in writes:
    if PERI.get(base)=="RCC":
        r=RCC_R.get(off); m=val if val is not None else mask
        if r in acc and m: acc[r]|=m
print(f" AHB1ENR=0x{acc['AHB1ENR']:08X} -> {decbits(acc['AHB1ENR'],AHB1)}")
print(f" APB1ENR=0x{acc['APB1ENR']:08X} -> {decbits(acc['APB1ENR'],APB1)}")
print(f" APB2ENR=0x{acc['APB2ENR']:08X} -> {decbits(acc['APB2ENR'],APB2)}")

# --- Decode SYSCFG EXTICR (EXTI line -> port) ---
print("\n"+"="*78); print("SYSCFG EXTICR (ligne EXTI -> port GPIO)"); print("="*78)
PORT="ABCDEFGH"
for a,base,off,val,mask,txt in writes:
    if PERI.get(base)=="SYSCFG" and off in (0x08,0x0C,0x10,0x14) and val is not None:
        grp=(off-0x08)//4
        for n in range(4):
            sel=(val>>(n*4))&0xF; line=grp*4+n
            if sel<8: print(f" EXTI{line:<2} <- P{PORT[sel]}{line}")

# --- Decode GPIO MODER / AFR / PUPDR when full value known ---
print("\n"+"="*78); print("GPIO config (valeurs pleines connues)"); print("="*78)
MODE=["IN","OUT","AF","ANALOG"]
for a,base,off,val,mask,txt in writes:
    nm=PERI.get(base,"")
    if nm.startswith("GPIO") and val is not None and off in (0x00,0x0C,0x20,0x24):
        if off==0x00:
            pins=", ".join(f"P{nm[4]}{p}:{MODE[(val>>(p*2))&3]}" for p in range(16) if (val>>(p*2))&3)
            print(f" {nm}->MODER=0x{val:08X}  {pins}")
        elif off==0x0C:
            pins=", ".join(f"P{nm[4]}{p}:{['--','PU','PD','?'][(val>>(p*2))&3]}" for p in range(16) if (val>>(p*2))&3)
            print(f" {nm}->PUPDR=0x{val:08X}  {pins}")
        else:
            lo=0 if off==0x20 else 8
            afs=", ".join(f"P{nm[4]}{lo+p}:AF{(val>>(p*4))&0xF}" for p in range(8) if (val>>(p*4))&0xF)
            print(f" {nm}->{GPIO_R[off]}=0x{val:08X}  {afs}")
