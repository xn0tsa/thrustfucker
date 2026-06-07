#!/usr/bin/env python3
"""Disassemble FUN_0800378c (HAL_SPI_MspInit callback) to find SPI2 GPIO AF config.
Also disassemble FUN_08005328 which is called early in FUN_08008944."""
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
SPI = {0x40013000:"SPI1", 0x40003800:"SPI2", 0x40003C00:"SPI3"}

def rn(r):
    n = md.reg_name(r)
    return {"sp":13,"lr":14,"pc":15,"fp":11,"ip":12}.get(
        n, int(n[1:]) if n and n[0]=="r" and n[1:].isdigit() else None)

def trace_fn(start, count=150, label=""):
    if label: print(f"\n{'='*65}\n{label} @ 0x{start:08X}\n{'='*65}")
    regs = [None]*16; stk = {}; pos = start; done = 0
    while done < count and pos < BASE+N:
        seg = data[foff(pos):foff(pos)+4]
        gen = list(md.disasm(seg, pos, count=1))
        if not gen: pos += 2; continue
        ins = gen[0]; ops = ins.operands; m = ins.mnemonic
        o0 = rn(ops[0].reg) if ops and ops[0].type==ARM_OP_REG else None
        try:
            bname = md.reg_name(ops[1].mem.base) if len(ops)>=2 and ops[1].type==ARM_OP_MEM else ""
            bname2 = md.reg_name(ops[2].mem.base) if len(ops)>=3 and ops[2].type==ARM_OP_MEM else ""

            if m == "push":
                regs=[None]*16; stk={}
            elif (m in ("sub","add") and len(ops)>=3 and o0==13) or \
                 (m.endswith(".w") and "sub" in m and o0==13):
                stk={}
            elif (m.startswith("str") and not m.startswith("strb") and not m.startswith("strh")
                  and len(ops)>=2 and ops[1].type==ARM_OP_MEM and bname=="sp"):
                disp=ops[1].mem.disp
                sv = regs[o0] if o0 is not None else None
                stk[disp] = sv
            elif (m=="strd" and len(ops)>=3 and ops[2].type==ARM_OP_MEM and bname2=="sp"):
                d=ops[2].mem.disp
                v0 = regs[rn(ops[0].reg)] if ops[0].type==ARM_OP_REG else None
                v1 = regs[rn(ops[1].reg)] if ops[1].type==ARM_OP_REG else None
                stk[d]=v0; stk[d+4]=v1
            elif m.startswith("ldr") and not m.startswith("ldrb") and not m.startswith("ldrh") and len(ops)>=2 and ops[1].type==ARM_OP_MEM:
                mp=ops[1].mem
                if md.reg_name(mp.base)=="pc":
                    la=((ins.address+4)&~3)+mp.disp
                    if o0 is not None: regs[o0]=u32(la) if 0<=foff(la)<=N-4 else None
                elif md.reg_name(mp.base)=="sp":
                    if o0 is not None: regs[o0]=stk.get(mp.disp)
                else:
                    # indirect - could be reading from a struct or register
                    bv = regs[rn(mp.base)] if mp.base else None
                    disp = mp.disp
                    if o0 is not None: regs[o0] = None
            elif m.startswith("mov") or m.startswith("movs") or m.startswith("movw"):
                # covers mov, movs, movw, mov.w, movs.w
                if len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
                    regs[o0] = ops[1].imm
                elif len(ops)>=2 and ops[1].type==ARM_OP_REG and o0 is not None:
                    regs[o0] = regs[rn(ops[1].reg)]
            elif m=="movt" and len(ops)>=2 and ops[1].type==ARM_OP_IMM and o0 is not None:
                regs[o0]=((regs[o0] or 0)&0xFFFF)|((ops[1].imm&0xFFFF)<<16)
            elif m in ("add","adds","add.w") and len(ops)==3:
                v1,v2=regs[rn(ops[1].reg)] if ops[1].type==ARM_OP_REG else ops[1].imm, \
                       regs[rn(ops[2].reg)] if ops[2].type==ARM_OP_REG else ops[2].imm
                if o0 is not None: regs[o0]=v1+v2 if isinstance(v1,int) and isinstance(v2,int) else None
            elif m in ("sub","subs","sub.w") and len(ops)==3 and o0!=13:
                v1 = regs[rn(ops[1].reg)] if ops[1].type==ARM_OP_REG else ops[1].imm
                v2 = regs[rn(ops[2].reg)] if ops[2].type==ARM_OP_REG else ops[2].imm
                if o0 is not None: regs[o0]=v1-v2 if isinstance(v1,int) and isinstance(v2,int) else None
            elif m in ("orr","orrs","orr.w") and len(ops)==3:
                v1 = regs[rn(ops[1].reg)] if ops[1].type==ARM_OP_REG else ops[1].imm
                v2 = regs[rn(ops[2].reg)] if ops[2].type==ARM_OP_REG else ops[2].imm
                if o0 is not None:
                    regs[o0]=(v1|v2) if isinstance(v1,int) and isinstance(v2,int) else (v1 if isinstance(v1,int) else v2)
            elif m in ("lsl","lsls","lsl.w") and len(ops)==3:
                v1 = regs[rn(ops[1].reg)] if ops[1].type==ARM_OP_REG else ops[1].imm
                v2 = regs[rn(ops[2].reg)] if ops[2].type==ARM_OP_REG else ops[2].imm
                if o0 is not None: regs[o0]=(v1<<v2)&0xFFFFFFFF if isinstance(v1,int) and isinstance(v2,int) else None
        except: pass

        ann = ""
        if m in ("bl","blx") and ops and ops[0].type==ARM_OP_IMM:
            tgt = ops[0].imm
            r0v = regs[0]; r1v = regs[1]
            if tgt == 0x080117B0:  # HAL_GPIO_Init
                port = GPIO.get(r0v, f"GPIO_0x{r0v:08X}" if isinstance(r0v,int) else "?")
                pin_v  = stk.get(0)
                mode_v = stk.get(4)
                pull_v = stk.get(8)
                alt_v  = stk.get(16)
                pins   = [p for p in range(16) if isinstance(pin_v,int) and (pin_v>>p)&1]
                mode_s = {0:"INPUT",1:"OUT_PP",0x11:"OUT_OD",2:"AF_PP",0x12:"AF_OD"
                         }.get(mode_v, f"0x{mode_v:x}" if isinstance(mode_v,int) else "?")
                pull_s = {0:"NoPull",1:"PU",2:"PD"}.get(pull_v, str(pull_v))
                af_s   = str(alt_v)
                ann = f"  >>> GPIO_Init({port}, pins={pins}, {mode_s}, {pull_s}, AF={af_s})"
            elif tgt == 0x080119F8:  # HAL_GPIO_WritePin
                port = GPIO.get(r0v, f"GPIO_0x{r0v:08X}" if isinstance(r0v,int) else "?")
                ann = f"  >>> WritePin({port}, 0x{r1v:04X}, {regs[2]!r})" if isinstance(r1v,int) else f"  >>> WritePin({port},...)"
            elif tgt == 0x08015040:
                ann = f"  >>> HAL_SPI_Init(r0={r0v!r})"
            elif tgt == 0x08012e0c:
                ann = f"  >>> HAL_I2C_Init"
            else:
                spi_s = SPI.get(r0v,"")
                ann = f"  >>> fn 0x{tgt:08X} (r0={'0x'+hex(r0v)[2:] if isinstance(r0v,int) else '?'})"
            for k in (0,1,2,3,12): regs[k] = None

        r0s = f"0x{regs[0]:08X}" if isinstance(regs[0],int) else "?"
        r4s = f"0x{regs[4]:08X}" if isinstance(regs[4],int) else "?"
        r5s = f"0x{regs[5]:08X}" if isinstance(regs[5],int) else "?"
        stk0s = f"0x{stk.get(0):04X}" if isinstance(stk.get(0),int) else "?"
        stk4s = f"0x{stk.get(4):X}" if isinstance(stk.get(4),int) else "?"
        stk10s= f"0x{stk.get(16):X}" if isinstance(stk.get(16),int) else "?"
        print(f"  0x{ins.address:08X}  {m:<12} {ins.op_str:<32} r0={r0s} r4={r4s}{ann}")
        pos += ins.size; done += 1

trace_fn(0x0800378C, 200, "FUN_0800378c = HAL_SPI_MspInit")
trace_fn(0x08005328, 100, "FUN_08005328 (called early in FUN_08008944)")
