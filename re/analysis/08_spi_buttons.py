#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analyse FUN_08007F34 (lecture boutons SPI) et les fonctions de scrutation GPIO.
Objectif : trouver le pin CS, l'instance SPI, et le mapping bit->bouton physique.
"""
import struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
from capstone.arm import ARM_OP_REG, ARM_OP_IMM, ARM_OP_MEM

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
N = len(data)
def u32(o): return struct.unpack_from("<I", data, o)[0]
def off(a): return a - BASE

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB + CS_MODE_MCLASS)
md.detail = True

GPIO = {0x40020000:"A", 0x40020400:"B", 0x40020800:"C", 0x40020C00:"D"}
SPI_BASES = {0x40013000:"SPI1", 0x40003800:"SPI2", 0x40003C00:"SPI3"}

HAL_GPIO_WRITEPIN = 0x080119F8
HAL_GPIO_READPIN  = 0x080117B0
HAL_SPI_TXRX      = 0x0801525E
HAL_SPI_INIT      = 0x08015040

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

def disasm_func(start, max_len=0x300):
    """Disassemble from start, stop at branch-back or max_len."""
    pos = start
    end = min(start + max_len, BASE + N)
    regs = [None] * 16
    for ins in md.disasm(data[off(start):off(end)], start):
        ops = ins.operands
        m   = ins.mnemonic
        o0  = rn(ops[0].reg) if ops and ops[0].type == ARM_OP_REG else None

        # Track register values
        try:
            if m == "push": regs = [None] * 16
            elif m.startswith("ldr") and len(ops) >= 2 and ops[1].type == ARM_OP_MEM:
                mem = ops[1].mem
                if md.reg_name(mem.base) == "pc":
                    la = ((ins.address + 4) & ~3) + mem.disp
                    regs[o0] = u32(off(la)) if 0 <= off(la) <= N - 4 else None
                else:
                    regs[o0] = None
            elif m in ("movw", "mov", "movs") and len(ops) >= 2 and ops[1].type == ARM_OP_IMM:
                regs[o0] = ops[1].imm
            elif m == "movt" and len(ops) >= 2 and ops[1].type == ARM_OP_IMM:
                regs[o0] = ((regs[o0] or 0) & 0xFFFF) | ((ops[1].imm & 0xFFFF) << 16)
        except Exception:
            pass

        yield ins, regs[:]

        try:
            for k in range(16):
                pass
        except Exception:
            pass

def analyze_spi_func(func_addr, label):
    print(f"\n{'='*72}")
    print(f"Fonction {label} @ 0x{func_addr:08X}")
    print('='*72)
    for ins, regs in disasm_func(func_addr):
        m   = ins.mnemonic
        ops = ins.operands
        line = f"  0x{ins.address:08X}  {m:<10} {ins.op_str}"

        # Annoter les appels importants
        if m in ("bl", "blx") and ops and ops[0].type == ARM_OP_IMM:
            tgt = ops[0].imm
            if tgt == HAL_GPIO_WRITEPIN:
                port = GPIO.get(regs[0], f"0x{regs[0]:08X}" if isinstance(regs[0],int) else "?")
                pin  = regs[1]
                state = regs[2]
                pins = [i for i in range(16) if isinstance(pin,int) and (pin>>i)&1]
                pinstr = ",".join(f"P{port}{p}" for p in pins) if pins else f"mask=0x{pin:X}" if isinstance(pin,int) else "?"
                ststr = "HIGH" if state == 1 else "LOW" if state == 0 else f"r2={state}"
                line += f"  << WritePin(GPIO{port}, {pinstr}, {ststr})"
            elif tgt == HAL_GPIO_READPIN:
                port = GPIO.get(regs[0], f"0x{regs[0]:08X}" if isinstance(regs[0],int) else "?")
                pin  = regs[1]
                pins = [i for i in range(16) if isinstance(pin,int) and (pin>>i)&1]
                pinstr = ",".join(f"P{port}{p}" for p in pins) if pins else f"mask=0x{pin:X}" if isinstance(pin,int) else "?"
                line += f"  << ReadPin(GPIO{port}, {pinstr})"
            elif tgt == HAL_SPI_TXRX:
                size = regs[3]
                r2   = regs[2]
                r0   = regs[0]
                r0s = f"0x{r0:08X}" if isinstance(r0, int) else "?"
                line += f"  << SPI_TXRX(hspi=r0={r0s}, tx=r2, size={size})"
            elif tgt == HAL_SPI_INIT:
                line += f"  << SPI_Init"
        print(line)
        if m == "bx" and ops and ops[0].type == ARM_OP_REG and md.reg_name(ops[0].reg) == "lr":
            break

# Les 3 fonctions d'interet
analyze_spi_func(0x08007F34, "SPI_BUTTON_READ (FUN_08007F34)")

# Aussi regarder la fonction d'init SPI1 (vers 0x08008F00)
# et les fonctions qui appellent FUN_08007F34
print("\n\n=== Fonctions qui appellent 0x08007F34 ===")
target = struct.pack("<I", 0x08007F34)  # ne sert pas directement, chercher BL
# Cherche les BL vers 0x08007F35 (Thumb, bit0=1) ou 0x08007F34
for s, e in [(0x08000000, 0x08009938), (0x08010000, 0x0801ACCC)]:
    for ins in md.disasm(data[off(s):off(e)], s):
        if ins.mnemonic == "bl" and ins.operands:
            tgt = ins.operands[0].imm if ins.operands[0].type == ARM_OP_IMM else None
            if tgt in (0x08007F34, 0x08007F35):
                print(f"  BL vers 0x08007F34 depuis 0x{ins.address:08X}")

# Init SPI1 : chercher autour de 0x08008F48 (où SPI1 base est écrite)
print("\n\n=== Init SPI1 et GPIO SPI1 (autour 0x08008F00) ===")
analyze_spi_func(0x08008EF0, "SPI1_init_region")
