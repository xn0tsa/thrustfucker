    .syntax unified
    .cpu    cortex-m4
    .fpu    softvfp
    .thumb

    .global g_pfnVectors
    .global Default_Handler

/* ── Symboles du linker script ──────────────────────────────────────────────── */
    .extern _sidata, _sdata, _edata, _sbss, _ebss, _stack_top

/* ── Reset Handler ─────────────────────────────────────────────────────────── */
    .section .text.Reset_Handler
    .weak   Reset_Handler
    .type   Reset_Handler, %function
Reset_Handler:
    ldr     sp, =_stack_top

    /* Activer le FPU (CPACR : bits CP10/CP11 = full access) */
    ldr     r0, =0xE000ED88
    ldr     r1, [r0]
    orr     r1, r1, #(0xF << 20)
    str     r1, [r0]
    dsb
    isb

    /* Copier .data de FLASH → RAM */
    ldr     r0, =_sidata
    ldr     r1, =_sdata
    ldr     r2, =_edata
    b       .Lcopy_check
.Lcopy_loop:
    ldr     r3, [r0], #4
    str     r3, [r1], #4
.Lcopy_check:
    cmp     r1, r2
    bcc     .Lcopy_loop

    /* Zéroiser .bss */
    ldr     r0, =_sbss
    ldr     r1, =_ebss
    movs    r2, #0
    b       .Lbss_check
.Lbss_loop:
    str     r2, [r0], #4
.Lbss_check:
    cmp     r0, r1
    bcc     .Lbss_loop

    /* SystemInit (active le PLL, configure VTOR) */
    bl      SystemInit

    /* main */
    bl      main

.Lforever:
    b       .Lforever

    .size Reset_Handler, . - Reset_Handler

/* ── Default Handler ────────────────────────────────────────────────────────── */
    .section .text.Default_Handler
    .weak   Default_Handler
    .type   Default_Handler, %function
Default_Handler:
    b       Default_Handler
    .size Default_Handler, . - Default_Handler

/* ── Macro alias IRQ → Default_Handler ─────────────────────────────────────── */
    .macro WEAK_IRQ name
    .weak   \name
    .thumb_set \name, Default_Handler
    .endm

    WEAK_IRQ NMI_Handler
    WEAK_IRQ HardFault_Handler
    WEAK_IRQ MemManage_Handler
    WEAK_IRQ BusFault_Handler
    WEAK_IRQ UsageFault_Handler
    WEAK_IRQ SVC_Handler
    WEAK_IRQ DebugMon_Handler
    WEAK_IRQ PendSV_Handler
    WEAK_IRQ SysTick_Handler

    /* Peripheral IRQs */
    WEAK_IRQ WWDG_IRQHandler
    WEAK_IRQ PVD_IRQHandler
    WEAK_IRQ TAMP_STAMP_IRQHandler
    WEAK_IRQ RTC_WKUP_IRQHandler
    WEAK_IRQ FLASH_IRQHandler
    WEAK_IRQ RCC_IRQHandler
    WEAK_IRQ EXTI0_IRQHandler
    WEAK_IRQ EXTI1_IRQHandler
    WEAK_IRQ EXTI2_IRQHandler
    WEAK_IRQ EXTI3_IRQHandler
    WEAK_IRQ EXTI4_IRQHandler
    WEAK_IRQ DMA1_Stream0_IRQHandler
    WEAK_IRQ DMA1_Stream1_IRQHandler
    WEAK_IRQ DMA1_Stream2_IRQHandler
    WEAK_IRQ DMA1_Stream3_IRQHandler
    WEAK_IRQ DMA1_Stream4_IRQHandler
    WEAK_IRQ DMA1_Stream5_IRQHandler
    WEAK_IRQ DMA1_Stream6_IRQHandler
    WEAK_IRQ ADC_IRQHandler
    WEAK_IRQ CAN1_TX_IRQHandler
    WEAK_IRQ CAN1_RX0_IRQHandler
    WEAK_IRQ CAN1_RX1_IRQHandler
    WEAK_IRQ CAN1_SCE_IRQHandler
    WEAK_IRQ EXTI9_5_IRQHandler
    WEAK_IRQ TIM1_BRK_TIM9_IRQHandler
    WEAK_IRQ TIM1_UP_TIM10_IRQHandler
    WEAK_IRQ TIM1_TRG_COM_TIM11_IRQHandler
    WEAK_IRQ TIM1_CC_IRQHandler
    WEAK_IRQ TIM2_IRQHandler
    WEAK_IRQ TIM3_IRQHandler
    WEAK_IRQ TIM4_IRQHandler
    WEAK_IRQ I2C1_EV_IRQHandler
    WEAK_IRQ I2C1_ER_IRQHandler
    WEAK_IRQ I2C2_EV_IRQHandler
    WEAK_IRQ I2C2_ER_IRQHandler
    WEAK_IRQ SPI1_IRQHandler
    WEAK_IRQ SPI2_IRQHandler
    WEAK_IRQ USART1_IRQHandler
    WEAK_IRQ USART2_IRQHandler
    WEAK_IRQ USART3_IRQHandler
    WEAK_IRQ EXTI15_10_IRQHandler
    WEAK_IRQ RTC_Alarm_IRQHandler
    WEAK_IRQ OTG_FS_WKUP_IRQHandler
    WEAK_IRQ TIM8_BRK_TIM12_IRQHandler
    WEAK_IRQ TIM8_UP_TIM13_IRQHandler
    WEAK_IRQ TIM8_TRG_COM_TIM14_IRQHandler
    WEAK_IRQ TIM8_CC_IRQHandler
    WEAK_IRQ DMA1_Stream7_IRQHandler
    WEAK_IRQ FMC_IRQHandler
    WEAK_IRQ SDIO_IRQHandler
    WEAK_IRQ TIM5_IRQHandler
    WEAK_IRQ SPI3_IRQHandler
    WEAK_IRQ UART4_IRQHandler
    WEAK_IRQ UART5_IRQHandler
    WEAK_IRQ TIM6_DAC_IRQHandler
    WEAK_IRQ TIM7_IRQHandler
    WEAK_IRQ DMA2_Stream0_IRQHandler
    WEAK_IRQ DMA2_Stream1_IRQHandler
    WEAK_IRQ DMA2_Stream2_IRQHandler
    WEAK_IRQ DMA2_Stream3_IRQHandler
    WEAK_IRQ DMA2_Stream4_IRQHandler
    WEAK_IRQ ETH_IRQHandler
    WEAK_IRQ ETH_WKUP_IRQHandler
    WEAK_IRQ CAN2_TX_IRQHandler
    WEAK_IRQ CAN2_RX0_IRQHandler
    WEAK_IRQ CAN2_RX1_IRQHandler
    WEAK_IRQ CAN2_SCE_IRQHandler
    WEAK_IRQ OTG_FS_IRQHandler        /* IRQ67 — overridé dans main.c */
    WEAK_IRQ DMA2_Stream5_IRQHandler
    WEAK_IRQ DMA2_Stream6_IRQHandler
    WEAK_IRQ DMA2_Stream7_IRQHandler
    WEAK_IRQ USART6_IRQHandler
    WEAK_IRQ I2C3_EV_IRQHandler
    WEAK_IRQ I2C3_ER_IRQHandler
    WEAK_IRQ OTG_HS_EP1_OUT_IRQHandler
    WEAK_IRQ OTG_HS_EP1_IN_IRQHandler
    WEAK_IRQ OTG_HS_WKUP_IRQHandler
    WEAK_IRQ OTG_HS_IRQHandler        /* IRQ77 */
    WEAK_IRQ DCMI_IRQHandler
    WEAK_IRQ FPU_IRQHandler
    WEAK_IRQ UART7_IRQHandler
    WEAK_IRQ UART8_IRQHandler
    WEAK_IRQ SPI4_IRQHandler
    WEAK_IRQ SAI1_IRQHandler
    WEAK_IRQ SAI2_IRQHandler
    WEAK_IRQ QUADSPI_IRQHandler
    WEAK_IRQ FMPI2C1_EV_IRQHandler
    WEAK_IRQ FMPI2C1_ER_IRQHandler

/* ── Table des vecteurs ─────────────────────────────────────────────────────── */
    .section .isr_vector, "a", %progbits
    .type g_pfnVectors, %object
g_pfnVectors:
    /* Core exceptions */
    .word _stack_top               /* 0x00 Initial SP */
    .word Reset_Handler            /* 0x04 Reset */
    .word NMI_Handler              /* 0x08 NMI */
    .word HardFault_Handler        /* 0x0C HardFault */
    .word MemManage_Handler        /* 0x10 MemManage */
    .word BusFault_Handler         /* 0x14 BusFault */
    .word UsageFault_Handler       /* 0x18 UsageFault */
    .word 0                        /* 0x1C Reserved */
    .word 0                        /* 0x20 Reserved */
    .word 0                        /* 0x24 Reserved */
    .word 0                        /* 0x28 Reserved */
    .word SVC_Handler              /* 0x2C SVCall */
    .word DebugMon_Handler         /* 0x30 DebugMonitor */
    .word 0                        /* 0x34 Reserved */
    .word PendSV_Handler           /* 0x38 PendSV */
    .word SysTick_Handler          /* 0x3C SysTick */
    /* Peripheral IRQs (IRQ0–IRQ96) */
    .word WWDG_IRQHandler          /* IRQ0  */
    .word PVD_IRQHandler           /* IRQ1  */
    .word TAMP_STAMP_IRQHandler    /* IRQ2  */
    .word RTC_WKUP_IRQHandler      /* IRQ3  */
    .word FLASH_IRQHandler         /* IRQ4  */
    .word RCC_IRQHandler           /* IRQ5  */
    .word EXTI0_IRQHandler         /* IRQ6  */
    .word EXTI1_IRQHandler         /* IRQ7  */
    .word EXTI2_IRQHandler         /* IRQ8  */
    .word EXTI3_IRQHandler         /* IRQ9  */
    .word EXTI4_IRQHandler         /* IRQ10 */
    .word DMA1_Stream0_IRQHandler  /* IRQ11 */
    .word DMA1_Stream1_IRQHandler  /* IRQ12 */
    .word DMA1_Stream2_IRQHandler  /* IRQ13 */
    .word DMA1_Stream3_IRQHandler  /* IRQ14 */
    .word DMA1_Stream4_IRQHandler  /* IRQ15 */
    .word DMA1_Stream5_IRQHandler  /* IRQ16 */
    .word DMA1_Stream6_IRQHandler  /* IRQ17 */
    .word ADC_IRQHandler           /* IRQ18 */
    .word CAN1_TX_IRQHandler       /* IRQ19 */
    .word CAN1_RX0_IRQHandler      /* IRQ20 */
    .word CAN1_RX1_IRQHandler      /* IRQ21 */
    .word CAN1_SCE_IRQHandler      /* IRQ22 */
    .word EXTI9_5_IRQHandler       /* IRQ23 */
    .word TIM1_BRK_TIM9_IRQHandler /* IRQ24 */
    .word TIM1_UP_TIM10_IRQHandler /* IRQ25 */
    .word TIM1_TRG_COM_TIM11_IRQHandler /* IRQ26 */
    .word TIM1_CC_IRQHandler       /* IRQ27 */
    .word TIM2_IRQHandler          /* IRQ28 */
    .word TIM3_IRQHandler          /* IRQ29 */
    .word TIM4_IRQHandler          /* IRQ30 */
    .word I2C1_EV_IRQHandler       /* IRQ31 */
    .word I2C1_ER_IRQHandler       /* IRQ32 */
    .word I2C2_EV_IRQHandler       /* IRQ33 */
    .word I2C2_ER_IRQHandler       /* IRQ34 */
    .word SPI1_IRQHandler          /* IRQ35 */
    .word SPI2_IRQHandler          /* IRQ36 */
    .word USART1_IRQHandler        /* IRQ37 */
    .word USART2_IRQHandler        /* IRQ38 */
    .word USART3_IRQHandler        /* IRQ39 */
    .word EXTI15_10_IRQHandler     /* IRQ40 */
    .word RTC_Alarm_IRQHandler     /* IRQ41 */
    .word OTG_FS_WKUP_IRQHandler   /* IRQ42 */
    .word TIM8_BRK_TIM12_IRQHandler/* IRQ43 */
    .word TIM8_UP_TIM13_IRQHandler /* IRQ44 */
    .word TIM8_TRG_COM_TIM14_IRQHandler /* IRQ45 */
    .word TIM8_CC_IRQHandler       /* IRQ46 */
    .word DMA1_Stream7_IRQHandler  /* IRQ47 */
    .word FMC_IRQHandler           /* IRQ48 */
    .word SDIO_IRQHandler          /* IRQ49 */
    .word TIM5_IRQHandler          /* IRQ50 */
    .word SPI3_IRQHandler          /* IRQ51 */
    .word UART4_IRQHandler         /* IRQ52 */
    .word UART5_IRQHandler         /* IRQ53 */
    .word TIM6_DAC_IRQHandler      /* IRQ54 */
    .word TIM7_IRQHandler          /* IRQ55 */
    .word DMA2_Stream0_IRQHandler  /* IRQ56 */
    .word DMA2_Stream1_IRQHandler  /* IRQ57 */
    .word DMA2_Stream2_IRQHandler  /* IRQ58 */
    .word DMA2_Stream3_IRQHandler  /* IRQ59 */
    .word DMA2_Stream4_IRQHandler  /* IRQ60 */
    .word ETH_IRQHandler           /* IRQ61 */
    .word ETH_WKUP_IRQHandler      /* IRQ62 */
    .word CAN2_TX_IRQHandler       /* IRQ63 */
    .word CAN2_RX0_IRQHandler      /* IRQ64 */
    .word CAN2_RX1_IRQHandler      /* IRQ65 */
    .word CAN2_SCE_IRQHandler      /* IRQ66 */
    .word OTG_FS_IRQHandler        /* IRQ67 ← USB OTG FS */
    .word DMA2_Stream5_IRQHandler  /* IRQ68 */
    .word DMA2_Stream6_IRQHandler  /* IRQ69 */
    .word DMA2_Stream7_IRQHandler  /* IRQ70 */
    .word USART6_IRQHandler        /* IRQ71 */
    .word I2C3_EV_IRQHandler       /* IRQ72 */
    .word I2C3_ER_IRQHandler       /* IRQ73 */
    .word OTG_HS_EP1_OUT_IRQHandler/* IRQ74 */
    .word OTG_HS_EP1_IN_IRQHandler /* IRQ75 */
    .word OTG_HS_WKUP_IRQHandler   /* IRQ76 */
    .word OTG_HS_IRQHandler        /* IRQ77 ← USB OTG HS */
    .word DCMI_IRQHandler          /* IRQ78 */
    .word 0                        /* IRQ79 reserved */
    .word 0                        /* IRQ80 reserved */
    .word FPU_IRQHandler           /* IRQ81 */
    .word UART7_IRQHandler         /* IRQ82 */
    .word UART8_IRQHandler         /* IRQ83 */
    .word SPI4_IRQHandler          /* IRQ84 */
    .word 0                        /* IRQ85 */
    .word 0                        /* IRQ86 */
    .word SAI1_IRQHandler          /* IRQ87 */
    .word 0                        /* IRQ88 */
    .word 0                        /* IRQ89 */
    .word 0                        /* IRQ90 */
    .word SAI2_IRQHandler          /* IRQ91 */
    .word QUADSPI_IRQHandler       /* IRQ92 */
    .word 0                        /* IRQ93 */
    .word 0                        /* IRQ94 */
    .word FMPI2C1_EV_IRQHandler    /* IRQ95 */
    .word FMPI2C1_ER_IRQHandler    /* IRQ96 */
    .size g_pfnVectors, . - g_pfnVectors
