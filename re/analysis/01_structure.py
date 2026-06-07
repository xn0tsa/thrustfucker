#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analyse structurelle (sans desassemblage) du dump firmware TCA Sidestick X (STM32F446).
- Carte de remplissage (regions non-0xFF)
- Table des vecteurs : SP, exceptions coeur, IRQ actives -> peripheriques
- Scan des adresses de base de peripheriques STM32F446 (literal pools)
- Recherche d'une 2e table de vecteurs (relocation VTOR)
- Descripteurs USB (device/config) + strings avec adresses flash
"""
import struct

BASE = 0x08000000
PATH = r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin"
data = open(PATH, "rb").read()
N = len(data)
def u16(o): return struct.unpack_from("<H", data, o)[0]
def u32(o): return struct.unpack_from("<I", data, o)[0]

print(f"Fichier : {PATH}")
print(f"Taille  : {N} octets (0x{N:X})  |  base 0x{BASE:08X}\n")

# ----------------------------------------------------------------------------
print("="*70); print("1) CARTE DE REMPLISSAGE (regions non-0xFF, gaps<128 fusionnes)"); print("="*70)
GAP = 128
regions = []; in_run=False; start=0; last=0
for i in range(N):
    if data[i] != 0xFF:
        if not in_run: start=i; in_run=True
        last=i
    elif in_run and (i-last) > GAP:
        regions.append((start,last)); in_run=False
if in_run: regions.append((start,last))
total = 0
for s,e in regions:
    sz=e-s+1; total+=sz
    print(f"  0x{BASE+s:08X} - 0x{BASE+e:08X}   {sz:>7} o")
print(f"  -> {len(regions)} region(s), {total} o de contenu reel\n")

# ----------------------------------------------------------------------------
print("="*70); print("2) TABLE DES VECTEURS @ 0x08000000"); print("="*70)
sp = u32(0); reset = u32(4)
print(f"  Initial SP   : 0x{sp:08X}")
print(f"  Reset        : 0x{reset:08X}")
exc = ["", "Reset","NMI","HardFault","MemManage","BusFault","UsageFault",
       "Rsvd","Rsvd","Rsvd","Rsvd","SVCall","DebugMon","Rsvd","PendSV","SysTick"]
for idx in range(2,16):
    v=u32(idx*4)
    if v: print(f"  exc[{idx:2}] {exc[idx]:<10}: 0x{v:08X}")

# STM32F446 IRQ map (RM0390, best-effort)
IRQ = {0:"WWDG",1:"PVD",2:"TAMP_STAMP",3:"RTC_WKUP",4:"FLASH",5:"RCC",
6:"EXTI0",7:"EXTI1",8:"EXTI2",9:"EXTI3",10:"EXTI4",
11:"DMA1_Str0",12:"DMA1_Str1",13:"DMA1_Str2",14:"DMA1_Str3",15:"DMA1_Str4",
16:"DMA1_Str5",17:"DMA1_Str6",18:"ADC",19:"CAN1_TX",20:"CAN1_RX0",21:"CAN1_RX1",
22:"CAN1_SCE",23:"EXTI9_5",24:"TIM1_BRK_TIM9",25:"TIM1_UP_TIM10",
26:"TIM1_TRG_COM_TIM11",27:"TIM1_CC",28:"TIM2",29:"TIM3",30:"TIM4",
31:"I2C1_EV",32:"I2C1_ER",33:"I2C2_EV",34:"I2C2_ER",35:"SPI1",36:"SPI2",
37:"USART1",38:"USART2",39:"USART3",40:"EXTI15_10",41:"RTC_Alarm",42:"OTG_FS_WKUP",
43:"TIM8_BRK_TIM12",44:"TIM8_UP_TIM13",45:"TIM8_TRG_COM_TIM14",46:"TIM8_CC",
47:"DMA1_Str7",48:"FMC",49:"SDMMC",50:"TIM5",51:"SPI3",52:"UART4",53:"UART5",
54:"TIM6_DAC",55:"TIM7",56:"DMA2_Str0",57:"DMA2_Str1",58:"DMA2_Str2",59:"DMA2_Str3",
60:"DMA2_Str4",65:"CAN2_TX",66:"CAN2_RX0",67:"CAN2_RX1",68:"CAN2_SCE",69:"OTG_FS",
70:"DMA2_Str5",71:"DMA2_Str6",72:"DMA2_Str7",73:"USART6",74:"I2C3_EV",75:"I2C3_ER",
76:"OTG_HS_EP1_OUT",77:"OTG_HS_EP1_IN",78:"OTG_HS_WKUP",79:"OTG_HS",80:"DCMI",
83:"FPU",84:"SPI4",87:"SAI1",91:"SAI2",92:"QUADSPI",93:"HDMI_CEC",94:"SPDIF_RX",
95:"FMPI2C1_EV",96:"FMPI2C1_ER"}
# detect the default/dummy handler = the value that repeats most among IRQ slots
from collections import Counter
NIRQ = 97
irqvals = [u32((16+k)*4) for k in range(NIRQ)]
cnt = Counter(v for v in irqvals if v)
default = cnt.most_common(1)[0][0] if cnt else 0
print(f"\n  Handler par defaut (le plus repandu) : 0x{default:08X} (x{cnt[default]})")
print("  --- IRQ ACTIVES (handler != defaut) ---")
active=0
for k in range(NIRQ):
    v=irqvals[k]
    if v and v!=default:
        active+=1
        print(f"   IRQ{k:<3} 0x{v:08X}  {IRQ.get(k,'?')}")
print(f"  -> {active} IRQ peripheriques actives\n")

# ----------------------------------------------------------------------------
print("="*70); print("3) 2e TABLE DE VECTEURS ? (relocation VTOR)"); print("="*70)
for off in (0x4000,0x8000,0xC000,0x10000,0x20000):
    if off+8<=N:
        s=u32(off); r=u32(off+4)
        if 0x20000000<=s<=0x20020000 and 0x08000000<=r<0x08080000:
            print(f"  Possible vtable @ 0x{BASE+off:08X}: SP=0x{s:08X} Reset=0x{r:08X}")
print()

# ----------------------------------------------------------------------------
print("="*70); print("4) PERIPHERIQUES REFERENCES (scan des bases en literal)"); print("="*70)
P = {0x40020000:"GPIOA",0x40020400:"GPIOB",0x40020800:"GPIOC",0x40020C00:"GPIOD",
0x40021000:"GPIOE",0x40021400:"GPIOF",0x40021800:"GPIOG",0x40021C00:"GPIOH",
0x40023800:"RCC",0x40023C00:"FLASH_IF",0x40023000:"CRC",0x40026000:"DMA1",0x40026400:"DMA2",
0x40012000:"ADC",0x40013000:"SPI1",0x40013400:"SPI4",0x40003800:"SPI2/I2S2",0x40003C00:"SPI3/I2S3",
0x40005400:"I2C1",0x40005800:"I2C2",0x40005C00:"I2C3",0x40006000:"FMPI2C1",
0x40011000:"USART1",0x40004400:"USART2",0x40004800:"USART3",0x40011400:"USART6",
0x40000000:"TIM2",0x40000400:"TIM3",0x40000800:"TIM4",0x40000C00:"TIM5",0x40010000:"TIM1",0x40010400:"TIM8",
0x40014000:"TIM9",0x40014400:"TIM10",0x40014800:"TIM11",0x40007000:"PWR",0x40007400:"DAC",
0x40015800:"SAI1",0x40015C00:"SAI2",0x40004000:"SPDIF_RX",0x40013800:"SYSCFG",0x40013C00:"EXTI",
0x40040000:"USB_OTG_HS",0x50000000:"USB_OTG_FS",0xE000E000:"SCS/NVIC/SysTick",0xE0042000:"DBGMCU"}
hits={}
for o in range(0, N-3, 1):
    w=u32(o)
    if w in P: hits[w]=hits.get(w,0)+1
for base in sorted(hits, key=lambda b:-hits[b]):
    print(f"  {P[base]:<16} 0x{base:08X}  x{hits[base]}")
print()

# ----------------------------------------------------------------------------
print("="*70); print("5) DESCRIPTEURS USB"); print("="*70)
for o in range(0, N-18):
    if data[o]==0x12 and data[o+1]==0x01:           # device descriptor
        vid=u16(o+8); pid=u16(o+10)
        if vid==0x044F:
            bcd=u16(o+2); dev=u16(o+12)
            print(f"  DEVICE   @0x{BASE+o:08X}: USB {bcd>>8}.{bcd&0xff:02x}  VID=0x{vid:04X} PID=0x{pid:04X} "
                  f"bcdDevice=0x{dev:04X} class={data[o+4]:02X} mps0={data[o+7]} nCfg={data[o+17]}")
for o in range(0, N-9):
    if data[o]==0x09 and data[o+1]==0x02:           # config descriptor
        tot=u16(o+2); nif=data[o+4]
        if 18<=tot<=4096 and 1<=nif<=16:
            print(f"  CONFIG   @0x{BASE+o:08X}: wTotalLen={tot} nInterfaces={nif} "
                  f"cfgVal={data[o+5]} attr=0x{data[o+7]:02X} maxPower={data[o+8]*2}mA")
print()

# ----------------------------------------------------------------------------
print("="*70); print("6) STRINGS (ASCII >=5) avec adresse flash"); print("="*70)
import re
for m in re.finditer(rb"[\x20-\x7e]{5,}", data):
    s=m.group().decode("latin1")
    print(f"  0x{BASE+m.start():08X}  {s}")
