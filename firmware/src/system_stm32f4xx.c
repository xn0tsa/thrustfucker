#include "stm32f4xx.h"

uint32_t SystemCoreClock = 180000000U;

/* Tables de prescaler requises par stm32f4xx_hal_rcc.c */
const uint8_t AHBPrescTable[16] = {0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 6, 7, 8, 9};
const uint8_t APBPrescTable[8]  = {0, 0, 0, 0, 1, 2, 3, 4};

void SystemInit(void)
{
    /* Activer le FPU — CP10/CP11 full access */
    SCB->CPACR |= ((3UL << 20U) | (3UL << 22U));

    /* Relocaliser la table des vecteurs vers le début de la FLASH */
    SCB->VTOR = FLASH_BASE;

    /* Flush pipeline */
    __DSB();
    __ISB();
}
