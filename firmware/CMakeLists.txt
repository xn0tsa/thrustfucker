cmake_minimum_required(VERSION 3.20)

# ── Toolchain (arm-none-eabi-gcc) ─────────────────────────────────────────────
set(CMAKE_SYSTEM_NAME  Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)

find_program(CROSS_GCC      arm-none-eabi-gcc      REQUIRED)
find_program(CMAKE_OBJCOPY  arm-none-eabi-objcopy  REQUIRED)
find_program(CMAKE_SIZE     arm-none-eabi-size     REQUIRED)
# Sur Windows find_program retourne le chemin complet avec .exe ;
# on dérive le compilateur C/C++ directement depuis CROSS_GCC.
get_filename_component(CROSS_ROOT ${CROSS_GCC} DIRECTORY)
get_filename_component(GCC_EXT    ${CROSS_GCC} EXT)
set(CMAKE_C_COMPILER   "${CROSS_GCC}")
set(CMAKE_CXX_COMPILER "${CROSS_ROOT}/arm-none-eabi-g++${GCC_EXT}")

project(thrustfucker C ASM)

# ── Build mode (set via -DMODE=A01 etc.) ──────────────────────────────────────
if(NOT DEFINED MODE)
  set(MODE "A01")
endif()

# Derive firmware class letter (A/B/C/D/E/F) from the first char of MODE
string(REGEX MATCH "^[A-Za-z]" FIRMWARE_CLASS "${MODE}")
string(TOUPPER "${FIRMWARE_CLASS}" FIRMWARE_CLASS)
message(STATUS "MODE=${MODE}  FIRMWARE_CLASS=${FIRMWARE_CLASS}")

# ── MCU flags ─────────────────────────────────────────────────────────────────
set(MCU_FLAGS "-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard")
set(CMAKE_C_FLAGS   "${MCU_FLAGS} -Wall -Wextra -fdata-sections -ffunction-sections -std=c11")
set(CMAKE_ASM_FLAGS "${MCU_FLAGS}")
set(CMAKE_EXE_LINKER_FLAGS "${MCU_FLAGS} -T${CMAKE_SOURCE_DIR}/stm32f446xx.ld -Wl,--gc-sections -specs=nano.specs -specs=nosys.specs")

# ── Sources communs à tous les firmware ───────────────────────────────────────
set(COMMON_SOURCES
  src/startup_stm32f446xx.s
  src/system_stm32f4xx.c
  src/drivers/adc.c
  src/drivers/gpio.c
  src/duckyscript/duckyscript.c
)

# ── Sources spécifiques par classe firmware ───────────────────────────────────
if(FIRMWARE_CLASS STREQUAL "A")
  # Firmware A = HID + MSC (ramdisk FAT12 always present)
  set(CLASS_SOURCES
    src/main.c
    src/usb/hid_app.c
    src/usb/usb_descriptors.c
    src/usb/msc_app.c
    src/usb/ramdisk.c
  )
  add_compile_definitions(HAS_MSC)
elseif(FIRMWARE_CLASS STREQUAL "C")
  set(CLASS_SOURCES
    src/main_c.c
    src/usb/hid_app.c
    src/usb/usb_descriptors.c
    src/net/net_app.c
  )
elseif(FIRMWARE_CLASS STREQUAL "D")
  set(CLASS_SOURCES
    src/main_d.c
    src/usb/hid_app.c
    src/usb/usb_descriptors.c
  )
elseif(FIRMWARE_CLASS STREQUAL "E")
  set(CLASS_SOURCES
    src/main_e.c
    src/usb/hid_app.c
    src/usb/usb_descriptors.c
  )
elseif(FIRMWARE_CLASS STREQUAL "F")
  set(CLASS_SOURCES
    src/main_f.c
    src/usb/hid_app.c
    src/usb/usb_descriptors.c
  )
else()
  message(FATAL_ERROR "Firmware class inconnue: ${FIRMWARE_CLASS} (MODE=${MODE})")
endif()

set(SOURCES ${COMMON_SOURCES} ${CLASS_SOURCES})

# ── Include dirs (STM32CubeF4 HAL expected at ../Drivers/) ────────────────────
include_directories(
  src
  src/usb
  src/net
  src/drivers
  src/duckyscript
  ../Drivers/CMSIS/Include
  ../Drivers/CMSIS/Device/ST/STM32F4xx/Include
  ../Drivers/STM32F4xx_HAL_Driver/Inc
)

# ── HAL driver sources ────────────────────────────────────────────────────────
file(GLOB HAL_SOURCES
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_tim.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_tim_ex.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_cortex.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_rcc.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_rcc_ex.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_gpio.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_adc.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_adc_ex.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_dma.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_pcd.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_pcd_ex.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_pwr.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_pwr_ex.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_hal_spi.c
  ../Drivers/STM32F4xx_HAL_Driver/Src/stm32f4xx_ll_usb.c
)

# ── TinyUSB (clone at ../tinyusb/) ────────────────────────────────────────────
set(TINYUSB_DIR ${CMAKE_SOURCE_DIR}/../tinyusb)
if(EXISTS ${TINYUSB_DIR})
  file(GLOB_RECURSE TINYUSB_SOURCES
    ${TINYUSB_DIR}/src/tusb.c
    ${TINYUSB_DIR}/src/common/*.c
    ${TINYUSB_DIR}/src/device/*.c
    ${TINYUSB_DIR}/src/class/hid/*.c
    ${TINYUSB_DIR}/src/class/cdc/*.c
    ${TINYUSB_DIR}/src/class/msc/*.c
    ${TINYUSB_DIR}/src/portable/synopsys/dwc2/*.c
  )
  include_directories(${TINYUSB_DIR}/src ${TINYUSB_DIR}/hw/bsp)
  add_compile_definitions(CFG_TUSB_MCU=OPT_MCU_STM32F4)
  # Sources réseau RNDIS/ECM (Firmware C uniquement)
  if(FIRMWARE_CLASS STREQUAL "C")
    list(APPEND TINYUSB_SOURCES ${TINYUSB_DIR}/src/class/net/ecm_rndis_device.c)
    include_directories(${TINYUSB_DIR}/lib/networking)
  endif()
else()
  message(WARNING "TinyUSB non trouvé à ${TINYUSB_DIR} — USB désactivé")
  set(TINYUSB_SOURCES "")
endif()

# ── Mode definition ───────────────────────────────────────────────────────────
add_compile_definitions(
  STM32F446xx
  USE_HAL_DRIVER
  MODE_${MODE}
  FIRMWARE_${FIRMWARE_CLASS}
  HSE_VALUE=8000000U
)

# ── Target ────────────────────────────────────────────────────────────────────
add_executable(firmware_${MODE}.elf ${SOURCES} ${HAL_SOURCES} ${TINYUSB_SOURCES})

add_custom_command(TARGET firmware_${MODE}.elf POST_BUILD
  COMMAND ${CMAKE_OBJCOPY} -O binary firmware_${MODE}.elf firmware_${MODE}.bin
  COMMAND ${CMAKE_SIZE} firmware_${MODE}.elf
  COMMENT "Generating firmware_${MODE}.bin"
)
