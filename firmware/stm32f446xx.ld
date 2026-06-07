/* STM32F446xx — 512KB flash, 128KB RAM */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
}

/* Payload/config zone : 64KB offset = 0x08010000
   Réservé par le launcher pour patcher la config JSON */
_config_start = 0x08010000;
_config_size  = 0x4000;   /* 16KB */

SECTIONS
{
  .isr_vector : {
    . = ALIGN(4);
    KEEP(*(.isr_vector))
    . = ALIGN(4);
  } > FLASH

  .text : {
    . = ALIGN(4);
    *(.text .text.*)
    *(.rodata .rodata.*)
    . = ALIGN(4);
    _etext = .;
  } > FLASH

  .ARM.extab : { *(.ARM.extab .ARM.extab.*) } > FLASH
  .ARM       : { *(.ARM.exidx .ARM.exidx.*) } > FLASH

  /* LMA de .data = adresse en FLASH après .text */
  _sidata = LOADADDR(.data);

  .data : {
    . = ALIGN(4);
    _sdata = .;       /* début en RAM */
    *(.data .data.*)
    . = ALIGN(4);
    _edata = .;       /* fin en RAM   */
  } > RAM AT > FLASH

  .bss : {
    . = ALIGN(4);
    _sbss = .;
    *(.bss .bss.*)
    *(COMMON)
    . = ALIGN(4);
    _ebss = .;
  } > RAM

  .heap : {
    . = ALIGN(8);
    _heap_start = .;
    end = .;           /* alias requis par _sbrk de nosys.a */
    . += 8K;
    _heap_end = .;
  } > RAM

  .stack : {
    . = ALIGN(8);
    . += 16K;
    _stack_top = .;   /* utilisé comme SP initial dans le vecteur Reset */
  } > RAM
}
