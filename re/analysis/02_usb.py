#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Decode complet des descripteurs USB du firmware TCA Sidestick X."""
import struct
BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
N = len(data)
def u16(o): return struct.unpack_from("<H", data, o)[0]

def hexs(o, n): return " ".join(f"{data[o+i]:02X}" for i in range(n))

# --- 1) Device descriptors plausibles (filtre strict) ---
print("="*70); print("DEVICE DESCRIPTORS (bLength=0x12, type=0x01, sanity-checked)"); print("="*70)
for o in range(N-18):
    if data[o]==0x12 and data[o+1]==0x01:
        bcd=u16(o+2); mps=data[o+7]; ncfg=data[o+17]; vid=u16(o+8)
        if bcd in (0x0100,0x0110,0x0200,0x0210) and mps in (8,16,32,64) and 1<=ncfg<=2:
            print(f" @0x{BASE+o:08X} bcdUSB=0x{bcd:04X} class=0x{data[o+4]:02X} sub=0x{data[o+5]:02X} "
                  f"proto=0x{data[o+6]:02X} mps0={mps} VID=0x{vid:04X} PID=0x{u16(o+10):04X} "
                  f"bcdDev=0x{u16(o+12):04X} nCfg={ncfg}")
            print(f"        [{hexs(o,18)}]")

# --- 2) Walk complet du config descriptor @0x080098C5 ---
CFG = 0x98C5
total = u16(CFG+2)
print("\n"+"="*70); print(f"CONFIG DESCRIPTOR @0x{BASE+CFG:08X}  (wTotalLength={total})"); print("="*70)
DT={1:"DEVICE",2:"CONFIG",3:"STRING",4:"INTERFACE",5:"ENDPOINT",6:"DEV_QUAL",
    7:"OTHER_SPEED",8:"INT_POWER",0x0B:"IAD",0x21:"HID",0x22:"HID_REPORT",
    0x24:"CS_INTERFACE",0x25:"CS_ENDPOINT"}
CLS={0x00:"(see iface)",0x01:"Audio",0x02:"CDC-ctrl",0x03:"HID",0x08:"MassStorage",
     0x0A:"CDC-data",0x0E:"Video",0xEF:"Misc/IAD",0xFF:"Vendor"}
o=CFG; end=CFG+total
while o<end:
    blen=data[o]; bt=data[o+1]
    if blen==0: break
    nm=DT.get(bt,f"0x{bt:02X}")
    s=f" @0x{BASE+o:08X} L{blen:<3} {nm:<12}"
    if   bt==0x02: s+=f"nIf={data[o+4]} cfgVal={data[o+5]} attr=0x{data[o+7]:02X} {data[o+8]*2}mA"
    elif bt==0x0B: s+=f"firstIf={data[o+2]} cnt={data[o+3]} class=0x{data[o+4]:02X}({CLS.get(data[o+4],'?')}) sub=0x{data[o+5]:02X} proto=0x{data[o+6]:02X}"
    elif bt==0x04: s+=f"if#{data[o+2]} alt={data[o+3]} nEP={data[o+4]} class=0x{data[o+5]:02X}({CLS.get(data[o+5],'?')}) sub=0x{data[o+6]:02X} proto=0x{data[o+7]:02X} iIf={data[o+8]}"
    elif bt==0x05:
        a=data[o+2]; at=data[o+3]; mps=u16(o+4)
        s+=f"EP{a&0xf} {'IN' if a&0x80 else 'OUT'} {['Ctrl','Iso','Bulk','Int'][at&3]} mps={mps} intv={data[o+6]}"
    elif bt==0x21: s+=f"bcdHID=0x{u16(o+2):04X} nDesc={data[o+5]} type=0x{data[o+6]:02X} reportLen={u16(o+7)}"
    print(s); print(f"        [{hexs(o,blen)}]")
    o+=blen

# --- 3) Regions mysterieuses ---
print("\n"+"="*70); print("REGIONS ISOLEES"); print("="*70)
print(f" @0x0800E000 (596 o) premiers 48 o :\n   {hexs(0xE000,48)}")
print(f" @0x0803FFFC (4 o) : {hexs(0x3FFFC,4)}")
