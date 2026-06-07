# TCA Sidestick X — Reverse du firmware (STM32F446, dump 512 Ko)

Analyse statique du `firmware/tca_sidestick_x_fw_ORIGINAL_512k.bin` via scripts Python
(`analysis/`) : structure, périphériques, USB, et pinout fonctionnel.
**Méthode :** parsing binaire + désassemblage Thumb-2 (Capstone) avec traçage léger de registres.

---

## 1. Carte mémoire

| Région | Taille | Contenu |
|---|---|---|
| `0x08000000–0x08009937` | ~39 Ko | **Table des vecteurs** + handlers + drivers (USB/I2C…) + **descripteurs/strings USB + métadonnées GIP** |
| `0x0800E000–0x0800E253` | 596 o | **Données isolées** → très probablement **calibration usine des axes** (tables de valeurs 16-bit + ID) |
| `0x08010000–0x0801ACCB` | ~44 Ko | **Application principale** (le `Reset` pointe ici → `0x080101F1`), runtime à heap (`SIGRTMEM: Out of heap memory`), pile GIP (`XGIP10`) |
| `0x0803FFFC` | 4 o | `1B 01 00 00` → marqueur/version/CRC en fin de 1er bloc 256 Ko |

**Table des vecteurs @ `0x08000000`** : SP=`0x2000EDD0`, Reset=`0x080101F1`, handler par défaut=`0x0801020B`.
**IRQ actives** (handler ≠ défaut) : `EXTI0`, `I2C1_EV`, `I2C1_ER`, `EXTI15_10`, `OTG_FS_WKUP`, `DMA2_Stream0/1/4`, + 2 vecteurs **USB OTG** (IRQ67 & 77 — labels FS/HS exacts à reconfirmer sur RM0390).

---

## 2. Périphériques (scan des bases + IRQ)

| Périph | Indice | Rôle confirmé |
|---|---|---|
| **GPIO A/B/C/D** | bases x13/20/11/4 | I/O (E–H non utilisés) |
| **ADC1 + DMA2** (str 0/1/4) | bases + IRQ DMA | **Axes Hall : PA1=IN1 (X), PA2=IN2 (Y), 2 canaux seulement** — ✅ confirmé Ghidra |
| **EXTI0 + EXTI15_10** | IRQ | **Boutons sur interruption** |
| **I2C1** | base + IRQ EV/ER | **IO expander à 7-bit addr 0x20** (PCF8574/MCP23017/PCA9554) — PB6/PB7 AF4 OD |
| **USB OTG-FS** | `0x50000000`, PA11/PA12 AF10 | **Device USB principal** (HID GIP) |
| **USB OTG-HS** | `0x40040000`, PB14/PB15 AF12 | 2e cœur USB (HS hardware, probablement FS-only ou audio) |
| **SAI1 + SAI2 + I2S3** | bases | **Audio du casque** (jack) — PA3/PA9/PB2/PB10/PC10/PC11/PC12 AF6 |
| **SPI2 + SPI3** | `0x40003800` / `0x40003C00` | **Codec audio** — init côte à côte avec SAI2 dans FUN_08008944 |
| **SPI1** | `0x40013000` | **Shift-register/IO expander SPI** — FUN_08007F34 lit 2 octets + inversion bits (boutons actifs-bas)|
| **DMA2_Stream0** | Ch0 = ADC1 | ADC1 DMA — handler envoie msg vers GIP queue (0x08011008) |
| **DMA2_Stream4** | Ch1 = SAI1_A | Audio DMA — handler à 0x08001D04 (timing 10ms, traitement audio) |

---

## 3. USB

- **VID `0x044F` / PID `0x040E`**.
- ⚠️ **Descripteurs assemblés à l'exécution** (aucun blob statique valide en flash — `bmAttributes` incohérent sur les faux positifs). Pour les obtenir exacts → **capture USBPcap** à l'énumération.
- Identité : **Xbox GIP** — `Microsoft.Xbox.Input.FlightStick`, `Windows.Xbox.Input.NavigationController`, `Windows.Xbox.Input.Headset`, version `XGIP10`, + descripteurs **Microsoft OS** (`MSFT100`).
- Deux rôles : **Pilot** et **Copilot**.

---

## 4. API GPIO (identifiée par signature d'appel)

| Fonction | Appels | Signature déduite |
|---|---|---|
| `0x080119F8` | 59 | **`HAL_GPIO_WritePin(port, pin, state)`** |
| `0x080117B0` | 46 | **`HAL_GPIO_ReadPin`** en boucle (r1 non-constant) → scrutation boutons |
| `0x080119E0` | 18 | lecture/toggle de broches **fixes** (boutons discrets) |
| `0x080119EA` | 2 | accès PB9 |
| `0x0801165C` | 1 | accès PB14+PB15 |

---

## 5. Pinout fonctionnel (digital I/O confirmé)

**Sorties pilotées (`WritePin`)** — lignes de contrôle (reset / chip-select / LED / enable) :
```
PA6   PB8(reset, toggles low/high)   PB9   PB13   PC3   PC6   PC9   PD2
```

**Entrées discrètes lues individuellement** (boutons) :
```
PA0   PA10   PA15   PC0   PC1   PC13   PC14   PC15   (+ PB14, PB15)
```
*(+ une série de boutons scrutés en boucle sur A/B/C via `ReadPin`.)*

---

## 6. Décompilation Ghidra — fonctions identifiées

Ghidra 12.1.2 headless, 350 fonctions analysées, 0 FunctionID match (pas de base HAL dans Ghidra).
Identification manuelle par pattern-matching des registres :

| Adresse | Nom déduit | Preuve |
|---|---|---|
| `FUN_080117B0` | `HAL_GPIO_Init` | r0=GPIOx, r1=→GPIO_InitTypeDef, écrit MODER/AFR |
| `FUN_080119F8` | `HAL_GPIO_WritePin` | 59 appels, args (port, pin_mask, state) |
| `FUN_08010A68` | `HAL_ADC_ConfigChannel` | écrit SQR3 (+0x34), SQR2 (+0x30), SQR1 (+0x2C), SMPR1 (+0x0C), SMPR2 (+0x10) |
| `FUN_08010C34` | `HAL_ADC_Init` | écrit ADC_CR1 (+4), CR2 (+8), SQR1 (+0x2C), accède ADC_Common (0x40012300) |
| `FUN_08008944` | main init + game loop | sz=2064 — appelle ADC_ConfigChannel, I2C init, GPIO, USB, boucle principale |
| `FUN_08012334` | `HAL_PCD_Init` (USB) | lit `USB_OTG_CID` à offset 0x3C depuis base USB OTG |
| `FUN_0801525E` | `HAL_SPI_TransmitReceive` | sonde `SPI_SR` (+0x08), écrit `SPI_DR` (+0x0C), mode 8-bit/16-bit |
| `FUN_08015040` | `HAL_SPI_Init` | écrit `SPI_CR1` (+0x00), `SPI_CR2` (+0x04) |
| `FUN_0800881C` | USB descriptor table init | copie blocs 8-octets depuis ROM jusqu'au sentinel `0xFF` dans RAM |
| `FUN_08012564` | `I2C1_EV_IRQHandler` | sz=2716, machine d'état complète — vecteur IRQ31 @ 0x080039FC |
| `FUN_08012410` | `I2C1_ER_IRQHandler` | sz=334 — vecteur IRQ32 @ 0x080039F0 |

**Mapping ADC confirmé (Ghidra)** :
```c
// Dans FUN_08008944 (main init) :
local_30=1; local_2c=1; local_28=2;
HAL_ADC_ConfigChannel(hadc, &local_30);   // Channel=1 (PA1, ADC1_IN1), Rank=1 → AXE X
local_30=2; local_2c=2;
HAL_ADC_ConfigChannel(hadc, &local_30);   // Channel=2 (PA2, ADC1_IN2), Rank=2 → AXE Y
// NbrOfConversions=2 — seulement 2 axes ADC
```

**I2C device** : **7-bit adresse 0x20** (8-bit DevAddr 0x40). Confirmé par scan global — `FUN_0801310C` (HAL_I2C_Master_Transmit) appelée 6 fois avec `r1=0x40` constant depuis : `0x080038F2`, `0x08003908`, `0x08004792`, `0x080047E4`, `0x080052AE`, `0x0800530C`. Device = **PCF8574 ou MCP23017** IO expander (adresse 0x20 = base avec A0=A1=A2=GND). `FUN_08012E0C` = HAL_I2C_Init confirmé (SWRST toggle, calcul CCR/TRISE).

---

## 6b. Résolu vs en attente

**✅ Résolu :**
- Architecture mémoire complète
- Jeu de périphériques + IRQ actives
- Identité USB : GIP (`Microsoft.Xbox.Input.FlightStick`), Audio, MS OS descriptors
- API GPIO : WritePin/ReadPin/Init avec adresses exactes
- **Pinout complet** : toutes broches AF, INPUT, OUTPUT, ANALOG
- **Axes ADC : PA1 = X (IN1, rank 1), PA2 = Y (IN2, rank 2)** — seuls 2 axes Hall
- Double init Pilot/Copilot (blocs ~0x08007Fxx et ~0x08008Axx)
- Fonctions HAL identifiées : ADC_ConfigChannel, ADC_Init, GPIO_Init, SPI_Init, SPI_TransmitReceive, PCD_Init (USB)

**✅ Résolu (session 2024-06) :**
- **I2C device = adresse 7-bit 0x20** (IO expander PCF8574/MCP23017/PCA9554)
  - 6 appels à `FUN_0801310C` (HAL_I2C_Master_Transmit) avec `r1=0x40` constant
- **DMA ADC = DMA2_Stream0 Canal 0** (ADC1 standard sur STM32F446)
  - Handler trampoline → queue GIP (`0x08011008`)
  - DMA2_Stream4 Canal 1 = **SAI1_A** audio (init `mov.w r0, #0x2000000` = CHSEL=1)
- **Calibration `0x0800E000–0x0800E253`** = 74 × records 8 octets `{flag, type_id, v0/1/2 uint16 LE}`
  - 3 triplets d'axe (type 0x00→0x06→0x1E) : capteurs Hall, 12-bit ADC, center≈440, max≈3280
  - Records type 0x0C/0x12/0x16/0x18/0x1A/0x1C = table dispatch GIP (pointeurs flash 16-bit)
- **SPI2+SPI3** = codec audio (init côte à côte avec SAI2 @ 0x08008CD0 et 0x08008D18)
  - **SPI1 / FUN_08007F34** = IO expander SPI boutons : CS toggle + 2 octets TXRX + inversion bits

**❓ En attente (non bloquant) :**
- Branchement Pilot/Copilot GPIO (blocs ~0x08007Fxx vs ~0x08008Axx, non cartographiés)
- Rôle complet SPI1 (pool @ 0x080091CC, handle @ 0x20001EE0) — LED driver ?
- GIP protocol decode (FUN_08012564) — non nécessaire pour firmware HID

---

## 6c. Calibration usine des axes Hall

Région `0x0800E000–0x0800E253` (596 octets). Structure : **74 records × 8 octets** + 4 octets partiels.

Format record : `{ flag:u8=0x00, type_id:u8, v0:u16LE, v1:u16LE, v2:u16LE }`

**3 triplets d'axe** (type sequence `0x00 → 0x06 → 0x1E`) aux offsets +0x188, +0x1F0, +0x240 :

| Axe | id=0x00 (bornes + centre) | id=0x06 (plage ADC) | id=0x1E (limite max) |
|---|---|---|---|
| Axe 1 (X ?) | v0≈440, v1≈2302, v2≈2047 | v0≈440, v1≈2302, v2=2047 | v0≈3280 |
| Axe 2 (Y ?) | v0≈439, v1≈2303, v2=2047 | similaire | similaire |
| Axe 3 | v0≈442, v1≈2301, v2=2047 | similaire | similaire |

**Interprétation** (capteurs Hall 12-bit STM32 ADC, 0-4095) :
- `center` ≈ **440 counts** (~0.36 V) — position neutre (capteur Hall offset magnétique)
- `max_deflection` ≈ **3280 counts** (~2.68 V) — butée mécanique
- `output_max` = **2047** — mapping interne HID → plage de sortie [-2047, +2047] pour axes GIP

**Référence code** : `0x0800E000` chargée depuis pool à `0x08008934`, utilisée dans `FUN_08008944` (main init).

Records entourants (type 0x0C/0x12/0x16/0x18/0x1A/0x1C) : valeurs ≈ adresses flash 16-bit basses → table dispatch GIP (pointeurs de callback compacts dans un dispatch table 16-bit + base fixe).

---

## 7. Pourquoi le static atteint sa limite ici (historique)

Le firmware est **basé HAL STM32** : les écritures de registres se font *dans* les fonctions HAL (paramétrées), pas en ligne. Le traçage statique récupère donc l'**API et les arguments** (d'où le pinout digital), mais pas les **valeurs finales des registres MODER/AFR** ni la logique métier. Pour ça, l'outil adapté est un **décompilateur (Ghidra)** : il reconstruit les signatures et montre `HAL_GPIO_Init(GPIOx, {.Pin=…, .Mode=ANALOG, .Alternate=AFx})` en clair.

---

## 8. Scripts d'analyse (`analysis/`)
- `01_structure.py` — carte mémoire, vecteurs, périphériques, descripteurs, strings
- `02_usb.py` — décodage descripteurs USB (a montré le runtime-built)
- `03_disasm.py` / `03b_debug.py` — écritures registres (a révélé le pattern HAL)
- `03c/03d_gpio.py` — extraction pinout via appels GPIO
- `03e_context.py` — dump contexte (a identifié WritePin vs Init)
- `03f_gpioapi.py` — classification de l'API GPIO + broches de sortie
- `04_init_context.py` — a identifié le vrai `HAL_GPIO_Init` (0x080117B0)
- `04b_init.py` — décodage des 46 structs `GPIO_InitTypeDef` → pinout complet
- `05_i2c.py` — recherche de l'adresse I2C device (1 LDR I2C1, call site @0x080003A8 → adresse dynamique)
- `06_i2c_irq.py` — handlers I2C1_EV (0x080039FC→FUN_08012564) et I2C1_ER (0x080039F0→FUN_08012410)
- `ExtractPeripherals.java` — décompilation Ghidra headless des fonctions ADC/I2C/SPI/USB

---

## 9. Pinout décodé (via `HAL_GPIO_Init` @0x080117B0, 46 appels)

### Fonctions alternées (AF) — SOLIDE (vraies broches périphériques)
| Broches | AF | Fonction |
|---|---|---|
| **PA11, PA12** | AF10 | **USB OTG-FS** (D−/D+) |
| **PB14, PB15** | AF12 | **USB OTG-HS** (D−/D+) — 2e cœur USB |
| **PB6, PB7** | AF4 (OD) | **I2C1** (SCL/SDA) |
| PA3, PA9, PB2, PB10, PC10, PC11, PC12 | AF6 | **Audio** (SAI / SPI3-I2S3) — casque |

### Boutons (INPUT, pull-up) — SOLIDE
`PA4, PA10, PB0, PB3, PB4, PC0, PC1, PC4, PC5, PC14, PC15` + `PA0, PA5` (EXTI rising).

### Sorties (reset / CS / LED / enable)
`PA6, PB5, PB8, PB11, PB12, PB13, PC3, PC6, PC11, PC12, PC13, PD2`.

### Axes analogiques (Hall) — ✅ CONFIRMÉ GHIDRA
`PA1` = **axe X** (ADC1_IN1, Channel 1, Rank 1) — capteur Hall horizontal
`PA2` = **axe Y** (ADC1_IN2, Channel 2, Rank 2) — capteur Hall vertical
Seulement **2 canaux ADC actifs** (NbrOfConversions=2). Pas de twist, pas de throttle intégré.

### Découverte : double configuration Pilot / Copilot
Les blocs d'init apparaissent en double (~0x08007Fxx et ~0x08008Axx) avec des modes différents
selon le rôle. Idem : certaines broches (PA11/PA12, PA6, PC6…) ont plusieurs configs selon le contexte
(USB vs IT, analog vs output…). Ghidra (vue par fonction) lèvera l'ambiguïté.

### ⚠️ Limite du static (à garder en tête)
Le pinout « consolidé » prend la *dernière* config vue par broche → trompeur quand une broche a
plusieurs rôles. Les lignes **AF** et **INPUT-PU** ci-dessus sont fiables ; les **ANALOG** sont à
trier (axes réels vs reset basse-conso).
