# TCA Sidestick X - Reverse Engineering & Custom Firmware

Recon methodology and results for the Thrustmaster TCA Sidestick X.
Goal: flash custom firmware without opening the case.

**Status: done.** Firmware dumped, reversed, custom firmware written and running across 5 modes.

---

## TL;DR

| Check | Result |
|---|---|
| No case opening needed | Yes - button combo triggers DFU |
| Bootloader | Stock ST DfuSe, no signature check |
| RDP (readout protection) | Level 0 - full read/write access |
| Write protection | None (nWRP0..7 inactive, PCROP off) |
| MCU | STM32F446 (Cortex-M4F, 180 MHz, 512KB flash / 128KB RAM, USB OTG FS+HS) |
| Original firmware | Dumped and validated (512KB) |

The Xbox authentication is a runtime handshake with a Microsoft security chip. It has nothing to do with the flash - a plain HID firmware ignores it completely.

---

## DFU entry (model X only)

1. Unplug the joystick
2. Back switch to PC mode
3. Hold the Xbox button
4. Plug USB while holding
5. Keep holding ~5 seconds, then release

Device shows up as `VID_0483 / PID_DF11` (Guillemot STM DFU Device), ST DfuSe bootloader v2.2.

No driver swap needed - STM32CubeProgrammer connects even with the Guillemot driver attached.

---

## Quick reference

```powershell
# Detect joystick in normal mode
Get-PnpDevice -PresentOnly | Where-Object InstanceId -like '*VID_044F*' | Format-List FriendlyName,InstanceId

# Detect DFU mode
Get-PnpDevice -PresentOnly | Where-Object InstanceId -match 'VID_0483' | Format-List FriendlyName,InstanceId

# Read memory map without driver swap
.\scripts\Read-DfuDescriptors.ps1

$cli = "C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe"

# Get MCU identity + RDP level
& $cli -l usb
& $cli -c port=usb1 -ob displ

# Dump full flash (512KB)
& $cli -c port=usb1 -u 0x08000000 0x80000 "tca_sidestick_x_fw_ORIGINAL_512k.bin"

# Flash custom firmware
& $cli -c port=usb1 -w "mode_a01.bin" 0x08000000 -v -s

# Restore original
& $cli -c port=usb1 -w "tca_sidestick_x_fw_ORIGINAL_512k.bin" 0x08000000 -v -s
```

---

## Hardware findings

- **Device ID 0x421** -> STM32F446xx confirmed via CubeProgrammer
- **RDP 0xAA** (Level 0, no protection)
- Memory map: `4x16KB + 1x64KB + 3x128KB` = 512KB, canonical STM32F4 layout
- Option bytes @ `0x1FFFC000`, OTP @ `0x1FFF7800` - F2/F4 signature

```
Device ID   : 0x421
Device name : STM32F446xx
NVM size    : 512 KBytes
Device CPU  : Cortex-M4
DFU protocol: 1.1   |   USB speed: Full Speed (12 MBit/s)
Bootloader  : v0x011a
```

```
RDP        : 0xAA (Level 0, no protection)
PCROP      : disabled
nWRP0..7   : write protection NOT active
```

---

## Strings found in original firmware

```
Thrustmaster
TCA Sidestick X
TCA Sidestick X Pilot
TCA Sidestick X Copilot
Microsoft.Xbox.Input.FlightStick
Windows.Xbox.Input.NavigationController
Windows.Xbox.Input.Headset      <- explains the MEDIA USB interface (headphone jack)
MSFT100                         <- Microsoft OS String Descriptor
```

---

## What NOT to do

Never run `-ob rdp=0xCC`. That sets RDP Level 2 which permanently disables the bootloader and debug interface. The device becomes a brick with no recovery path.
