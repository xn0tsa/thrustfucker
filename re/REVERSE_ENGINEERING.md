# TCA Sidestick X - Static Firmware Analysis (STM32F446, 512KB dump)

Static analysis of the original firmware via Python scripts (`analysis/`) using binary parsing and
Thumb-2 disassembly (Capstone) with lightweight register tracing, then Ghidra headless for
decompilation of key functions.

---

## Memory map

| Region | Size | Content |
|---|---|---|
| `0x08000000-0x08009937` | ~39KB | Vector table + handlers + drivers (USB, I2C, SPI) + USB descriptors + GIP metadata |
| `0x0800E000-0x0800E253` | 596B | Factory axis calibration (16-bit value tables) |
| `0x08010000-0x0801ACCB` | ~44KB | Main application (Reset -> `0x080101F1`), GIP stack (`XGIP10`) |
| `0x0803FFFC` | 4B | `1B 01 00 00` - version/CRC marker at end of first 256KB block |

Vector table @ `0x08000000`: SP=`0x2000EDD0`, Reset=`0x080101F1`, default handler=`0x0801020B`.

Active IRQs: `EXTI0`, `I2C1_EV`, `I2C1_ER`, `EXTI15_10`, `OTG_FS_WKUP`, `DMA2_Stream0/1/4`, USB OTG (IRQ 67 & 77).

---

## Peripherals

| Peripheral | Role |
|---|---|
| GPIO A/B/C/D | I/O (E-H unused) |
| ADC1 + DMA2 Stream0/Ch0 | Hall sensors - PA1=X (IN1), PA2=Y (IN2), 2 channels only |
| EXTI0 + EXTI15_10 | Button interrupts |
| I2C1 (PB6/PB7, AF4) | IO expander, 7-bit addr 0x20 (PCF8574 or MCP23017) |
| USB OTG-FS (PA11/PA12, AF10) | Main USB device (HID GIP) |
| USB OTG-HS (PB14/PB15, AF12) | Second USB core |
| SAI1 + SAI2 + I2S3 | Headphone jack audio |
| SPI2 + SPI3 | Audio codec (initialized alongside SAI2) |
| **SPI1 (0x40013000)** | **Button shift register** - FUN_08007F34 reads 2 bytes + inverts bits |
| DMA2 Stream4/Ch1 | SAI1_A audio DMA |

### On the I2C device

The original firmware does have a real I2C device at addr 0x20 - `FUN_0801310C` (HAL_I2C_Master_Transmit)
is called 6 times with `r1=0x40` (8-bit address). However the **button cluster shift register runs on SPI1**
(FUN_08007F34), not I2C. The I2C device serves a different purpose (likely LED driver or secondary expander).

Our custom firmware reimplements the button shift register on **SPI2** (PC2=MISO, PC7=SCK, PC3=CS) since
SPI1 pins overlap with other functions in our pinout.

---

## USB

- VID `0x044F` / PID `0x040E`
- Descriptors are assembled at runtime (no valid static blob in flash)
- Protocol: Xbox GIP (`Microsoft.Xbox.Input.FlightStick`, `XGIP10`)
- Two roles: Pilot and Copilot

---

## GPIO HAL functions (identified by call signature)

| Address | Function | Evidence |
|---|---|---|
| `0x080117B0` | `HAL_GPIO_Init` | r0=GPIOx, r1=->GPIO_InitTypeDef, writes MODER/AFR |
| `0x080119F8` | `HAL_GPIO_WritePin` | 59 calls, args (port, pin_mask, state) |
| `0x08010A68` | `HAL_ADC_ConfigChannel` | writes SQR3/SQR2/SQR1, SMPR1/SMPR2 |
| `0x08010C34` | `HAL_ADC_Init` | writes ADC_CR1/CR2/SQR1, accesses ADC_Common |
| `0x08008944` | main init + game loop | sz=2064, calls ADC/I2C/GPIO/USB init |
| `0x08012334` | `HAL_PCD_Init` (USB) | reads USB_OTG_CID at offset 0x3C |
| `0x0801525E` | `HAL_SPI_TransmitReceive` | probes SPI_SR (+0x08), writes SPI_DR (+0x0C) |
| `0x08015040` | `HAL_SPI_Init` | writes SPI_CR1 (+0x00), SPI_CR2 (+0x04) |
| `0x08012564` | `I2C1_EV_IRQHandler` | sz=2716, full state machine |
| `0x08012410` | `I2C1_ER_IRQHandler` | sz=334 |

---

## Pinout (decoded from 46 HAL_GPIO_Init calls)

### Alternate function pins (reliable)
| Pins | AF | Function |
|---|---|---|
| PA11, PA12 | AF10 | USB OTG-FS (D-/D+) |
| PB14, PB15 | AF12 | USB OTG-HS (D-/D+) |
| PB6, PB7 | AF4 OD | I2C1 (SCL/SDA) |
| PA3, PA9, PB2, PB10, PC10, PC11, PC12 | AF6 | Audio (SAI/I2S3) |

### Button inputs (INPUT PULLUP)
`PA0, PA4, PA5(EXTI), PA10, PB0, PB3, PB4, PC0, PC1, PC4, PC5, PC14, PC15`

### Outputs (CS / reset / LED / enable)
`PA6, PB5, PB8, PB11, PB12, PB13, PC3, PC6, PC11, PC12, PC13, PD2`

### Hall axes (confirmed by Ghidra)
```c
// In FUN_08008944 (main init):
HAL_ADC_ConfigChannel(hadc, {Channel=1, Rank=1});  // PA1 = X axis
HAL_ADC_ConfigChannel(hadc, {Channel=2, Rank=2});  // PA2 = Y axis
// NbrOfConversions=2 - only 2 ADC axes, no twist or throttle
```

---

## Factory calibration data @ 0x0800E000

74 records x 8 bytes: `{ flag:u8=0x00, type_id:u8, v0:u16LE, v1:u16LE, v2:u16LE }`

3 axis triplets (type sequence 0x00->0x06->0x1E):

| | center | max deflection | output max |
|---|---|---|---|
| X | ~440 counts | ~3280 counts | 2047 |
| Y | ~439 counts | ~3280 counts | 2047 |

Hall sensors are 12-bit ADC (0-4095). Center ~440 counts (~0.36V), mechanical stop ~3280 counts (~2.68V).
Output range mapped to [-2047, +2047] for GIP reporting.

---

## Analysis scripts

| Script | Purpose |
|---|---|
| `01_structure.py` | Memory map, vectors, peripherals, strings |
| `02_usb.py` | USB descriptor decoding (revealed runtime-built descriptors) |
| `03_disasm.py` / `03b_debug.py` | Register writes (revealed HAL pattern) |
| `03c/03d_gpio.py` | Pinout extraction via GPIO call sites |
| `04b_init.py` | Decodes all 46 GPIO_InitTypeDef structs -> full pinout |
| `05_i2c.py` | I2C device address scan (found addr 0x20) |
| `07_spi.py` / `08_spi_buttons.py` | SPI1 button read function analysis |
| `ExtractPeripherals.java` | Ghidra headless decompilation of ADC/SPI/USB functions |
