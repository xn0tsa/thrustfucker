# ThrustFucker

Thrustmaster shipped a flight joystick with an STM32F446, RDP Level 0, and no signature verification on the bootloader. We did the responsible thing.

## What is this

Full reverse engineering of the TCA Sidestick X original firmware (512KB dump via ST DfuSe, no case opening), followed by a custom firmware suite that repurposes the joystick as a USB attack platform. An Electron app handles flashing, button mapping, and payload configuration.

The hardware was never opened.

## Firmware modes

| Mode | What it does |
|------|--------------|
| A | HID Keyboard + Mouse. DuckyScript payloads triggered by the physical trigger button. Classic. |
| C | RNDIS network implant. Enumerates as USB ethernet with its own DHCP server and DNS hijacker. |
| D | C2 relay over CDC serial. You type in the launcher, it types on the target. |
| E | USB descriptor fuzzer. Cycles through broken descriptors on each trigger press. |
| F | Audio covert channel. Encodes data as FSK Bell 202 out the 3.5mm headphone jack. |

All modes report full joystick axes (Hall sensors via ADC + DMA) and the complete 21-button layout.

## Hardware

- MCU: STM32F446 (Cortex-M4F, 180 MHz, 512KB flash / 128KB RAM)
- Bootloader: stock ST DfuSe, RDP Level 0, no firmware signature check
- Buttons: 11 GPIO direct + 10 via SPI shift register (CS=PC3, MISO=PC2, SCK=PC7)
- Axes: Hall sensors on PA1 (X) and PA2 (Y), ADC1 + DMA2 circular
- USB: OTG-FS on PA11/PA12, VID 0x1209 / PID 0x5446

## DFU entry, no screwdriver needed

1. Set the back switch to PC mode
2. Hold the Xbox button, plug USB, keep holding 5 seconds, then release
3. Device shows up as 0483:DF11 (ST DfuSe bootloader)

## Flashing

The Electron app does it for you. Or directly via STM32CubeProgrammer:

```powershell
STM32_Programmer_CLI.exe -c port=usb1 -w mode_a01.bin 0x08000000 -v -s
```

To restore the original firmware, same command with your own dump from the device.

## Building the firmware

Requires arm-none-eabi-gcc 14.2, CMake, and Ninja.

```powershell
cd firmware
.\build.ps1 -Mode A01
# also: C01, D01, E01, F01
```

## Running the app

```
npm install
npm run dev
```

Requires Node.js 18+ and Electron.

## Reverse engineering

The `re/` folder has all the static analysis scripts (Python + Capstone, one Ghidra headless script). The original firmware is not included, you need your own dump from the hardware. Key findings are in `re/REVERSE_ENGINEERING.md`.

Short version: the joystick uses SPI1 for the button shift register (not I2C like we thought at first), ADC1 for Hall axes, and GIP (Xbox gamepad protocol) over USB. The DFU entry combo works on every unit we tested.

---

No hardware was opened. No Level 2 RDP was set. Thrustmaster: maybe ship your next product with the bootloader locked.
