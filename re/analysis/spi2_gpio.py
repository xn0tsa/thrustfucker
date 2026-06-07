#!/usr/bin/env python3
"""Find SPI2 AF GPIO configuration by disassembling calls near 0x08003802 and similar."""
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

def dis(start, n=40, label=""):
    if label: print(f"\n{'='*60}\n{label} @ 0x{start:08X}\n{'='*60}")
    regs = [None]*16; stk = {}; pos = start; done = 0
    while done < n and pos < BASE+N:
        for ins in md.disasm(data[foff(pos):foff(pos)+4], pos, count=1):
            ops = ins.operands; m = ins.mnemonic
            o0 = rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
            try:
                if m == "push": regs=[None]*16; stk={}
                elif m in ("sub","add") and o0==13: stk={}
                elif m.startswith("str") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    if md.reg_name(ops[1].mem.base)=="sp":
                        sv = regs[rn(ops[0].reg)] if ops[0].type==ARM_OP_REG else (ops[0].imm if ops[0].type==ARM_OP_IMM else None)
                        stk[ops[1].mem.disp] = sv
                elif m.startswith("ldr") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                    mp = ops[1].mem
                    if md.reg_name(mp.base)=="pc":
                        la = ((ins.address+4)&~3)+mp.disp
                        if o0 is not None: regs[o0] = u32(foff(la)) if 0<=foff(la)<=N-4 else None
                    elif md.reg_name(mp.base)=="sp":
                        if o0 is not None: regs[o0] = stk.get(mp.disp)
                    else:
                        if o0 is not None: regs[o0] = None
                elif m in ("movw","mov","movs") and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
                    regs[o0] = ops[1].imm
                elif m == "movt" and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
                    regs[o0] = ((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
                elif m in ("add","adds") and len(ops)==3 and ops[2].type==ARM_OP_IMM and o0 is not None:
                    sv=regs[rn(ops[1].reg)]; regs[o0]=sv+ops[2].imm if isinstance(sv,int) else None
            except: pass
            ann = ""
            if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
                tgt = ops[0].imm
                r0v = regs[0]; r1v = regs[1]
                port = GPIO.get(r0v)
                if tgt == 0x080117B0:
                    if port:
                        # Try to read GPIO struct from stack
                        pin_v  = stk.get(0) or (r1v if r1v and r1v < 0x10000 else None)
                        mode_v = stk.get(4)
                        pull_v = stk.get(8)
                        alt_v  = stk.get(16)
                        pins   = [p for p in range(16) if isinstance(pin_v,int) and (pin_v>>p)&1]
                        mode_s = {0:"INPUT",1:"OUT_PP",0x11:"OUT_OD",2:"AF_PP",0x12:"AF_OD",3:"ANALOG"}.get(mode_v, f"mode={mode_v}")
                        pull_s = {0:"no-pull",1:"PU",2:"PD"}.get(pull_v,"?")
                        ann = f"  GPIO_Init(GPIO{port}, pins={pins}, {mode_s}, {pull_s}, AF={alt_v})"
                    else:
                        ann = f"  GPIO_Init(0x{r0v:08X})" if isinstance(r0v,int) else "  GPIO_Init(?)"
                else:
                    ann = f"  fn 0x{tgt:08X}"
            r0s = f"0x{regs[0]:08X}" if isinstance(regs[0],int) else "?"
            r1s = f"0x{regs[1]:08X}" if isinstance(regs[1],int) else "?"
            r2s = f"0x{regs[2]:08X}" if isinstance(regs[2],int) else "?"
            r3s = f"0x{regs[3]:08X}" if isinstance(regs[3],int) else "?"
            print(f"  0x{ins.address:08X}  {m:<10} {ins.op_str:<30} r0={r0s} r2={r2s}{ann}")
            pos += ins.size; done += 1; break
        else: pos += 2

# Show context of GPIOC init at 0x08003802 — might be SPI2 MISO on PC2
dis(0x080037C0, 50, "GPIOC init context (near 0x08003802)")

# Show context of GPIOB init at 0x080032A0 and 0x08003376
dis(0x08003260, 50, "GPIOB init context (near 0x080032A0)")
dis(0x08003330, 50, "GPIOB init context (near 0x08003376)")

# Also check the SPI GPIO init that should happen right before SPI2 Init
# Find function containing 0x08008D00 (HAL_SPI_Init call)
# SPI2 GPIO should be configured in FUN_08008944 before this call
# Let's look 200 insns before 0x08008D00
dis(0x08008A00, 100, "Before first HAL_SPI_Init (0x08008D00)")
