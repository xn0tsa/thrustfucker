#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
07_calibration.py — Decode calibration region 0x0800E000-0x0800E253 (596 bytes)
"""
import struct

BASE = 0x08000000
data = open(r"C:\Users\Sam\TCA-Sidestick-X-Reverse\firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin","rb").read()
N = len(data)

CAL_START = 0x0800E000
CAL_SIZE  = 596
region = data[CAL_START - BASE : CAL_START - BASE + CAL_SIZE]

# ── 1. Parse as 8-byte records: [0x00, type_id, u16, u16, u16] ──────────────
print("=== Records 8 octets (flag=0x00, type_id, v0/1/2 uint16 LE) ===")
records = []
for i in range(0, (len(region)//8)*8, 8):
    blk = region[i:i+8]
    flag, tid = blk[0], blk[1]
    v0, v1, v2 = struct.unpack_from("<HHH", blk, 2)
    records.append((i, flag, tid, v0, v1, v2))
    marker = ""
    if tid == 0x00:  marker = "  <-- AXIS CAL"
    elif tid == 0x06: marker = "  <-- CAL param"
    elif tid == 0x1E: marker = "  <-- CAL limit"
    print(f"  +{i:03X} ({CAL_START+i:08X})  flag={flag:02X} id=0x{tid:02X}  "
          f"v0={v0:5d}(0x{v0:04X})  v1={v1:5d}(0x{v1:04X})  v2={v2:5d}(0x{v2:04X}){marker}")

# Partial last record if any
rem = len(region) % 8
if rem:
    blk = region[len(region)-rem:]
    print(f"  +{len(region)-rem:03X} PARTIAL {len(rem)*2 if False else rem} bytes: {blk.hex()}")

# ── 2. Identify type distribution ───────────────────────────────────────────
from collections import Counter
type_counts = Counter(r[2] for r in records)
print("\n=== Distribution des type_id ===")
for tid, cnt in sorted(type_counts.items()):
    print(f"  0x{tid:02X} ({tid:3d}): {cnt} records")

# ── 3. Extract axis calibration triplets (id=0x00 / 0x06 / 0x1E) ────────────
print("\n=== Triplets de calibration d'axe (id=0x00 -> 0x06 -> 0x1E) ===")
triplets = []
for idx in range(len(records)-2):
    r0, r1, r2 = records[idx], records[idx+1], records[idx+2]
    if r0[2]==0x00 and r1[2]==0x06 and r2[2]==0x1E:
        triplets.append((r0, r1, r2))
        print(f"  Triplet @+{r0[0]:03X}:")
        print(f"    id=0x00: v0={r0[3]:5d}, v1={r0[4]:5d}, v2={r0[5]:5d}  (probables: point1/2/3 ADC brut)")
        print(f"    id=0x06: v0={r1[3]:5d}, v1={r1[4]:5d}, v2={r1[5]:5d}")
        print(f"    id=0x1E: v0={r2[3]:5d}, v1={r2[4]:5d}, v2={r2[5]:5d}")
        # Interpretation: v0/v1/v2 of id=0x00 as (lower_bound, upper_bound, center)
        lo, hi, center = r0[3], r0[4], r0[5]
        if hi > lo and lo < center < hi:
            pct = (center - lo) / (hi - lo) * 100
            print(f"    --> ADC range [{lo}, {hi}], center={center} ({pct:.0f}% du range)")

print(f"\n{len(triplets)} triplets de calibration trouves")
if len(triplets) >= 2:
    print("  -> Probablement: Axe X, Axe Y (+ eventuellement un 3e axe ou trigger)")

# ── 4. Pointer hypothesis: are v0/v1/v2 flash addresses (lower 16-bit)? ─────
print("\n=== Test: v0/v1/v2 sont-ils des adresses flash (0x0800xxxx)? ===")
ptr_count = 0
for off, flag, tid, v0, v1, v2 in records:
    for label, v in [("v0",v0),("v1",v1),("v2",v2)]:
        full = 0x08000000 | v
        if 0x08000000 <= full < 0x0801ACCC:
            ptr_count += 1
print(f"  {ptr_count}/{len(records)*3} valeurs ressemblent a des adresses flash")

# ── 5. Find code references to CAL_START ────────────────────────────────────
print("\n=== References code vers 0x0800E000 ===")
pat = struct.pack("<I", CAL_START)
pos = 0
found_refs = []
while True:
    idx = data.find(pat, pos)
    if idx < 0: break
    pool_addr = BASE + idx
    if not (CAL_START <= pool_addr < CAL_START + CAL_SIZE):
        found_refs.append(pool_addr)
        print(f"  Pool @ 0x{pool_addr:08X}")
    pos = idx + 1

# Also search for nearby addresses
for probe in [CAL_START+0x20, CAL_START+0x40, CAL_START+0x80, CAL_START+0x100, CAL_START+0x188]:
    pat2 = struct.pack("<I", probe)
    idx = data.find(pat2)
    if idx >= 0:
        pa = BASE + idx
        if not (CAL_START <= pa < CAL_START + CAL_SIZE):
            print(f"  Pool @0x{pa:08X} references 0x{probe:08X}")
