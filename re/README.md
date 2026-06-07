# TCA Sidestick X — Reverse Engineering & Firmware custom

**Journal technique & méthodologie.**
Objectif : pouvoir flasher un **firmware custom** sur une **Thrustmaster TCA Sidestick X**, **sans ouvrir** l'appareil, pour la détourner en périphérique USB arbitraire (rêve initial : une **souris HID reconnue par un iPhone**).

- **Date :** 2026-06-06
- **Machine :** Windows 11 Pro (build 26200), PowerShell
- **Matériel :** Thrustmaster TCA Sidestick X, branchée en USB-C
- **Statut :** ✅ Recon terminée — accès complet obtenu, firmware d'origine dumpé. Pas encore de firmware custom écrit.

---

## TL;DR — Le verdict

| Verrou | Résultat |
|---|---|
| Accès sans ouvrir | ✅ Combo boutons → mode DFU |
| Bootloader | ✅ ST DfuSe **standard** — aucune vérification de signature au flash |
| RDP (read-out protection) | ✅ **Niveau 0** — flash en lecture totalement ouverte |
| Write protection | ✅ Aucune (`nWRP0..7` inactifs), PCROP désactivé |
| MCU | ✅ **STM32F446** (Cortex-M4F ≤ 180 MHz, 512 Ko flash / 128 Ko RAM, USB OTG FS+HS) |
| Firmware d'origine | ✅ **Dumpé & validé** (512 Ko) — sert de backup **et** de source pour le pinout |

**Conclusion : le projet est faisable de bout en bout.** Rien ne bloque côté accès. L'authentification Xbox est un mécanisme *runtime* (handshake avec une puce de sécurité Microsoft) sans rapport avec le flash — un firmware « HID pur » l'ignore complètement.

---

## 1. Contexte & objectif

La TCA Sidestick X est un joystick de simu Airbus, licencié Xbox, branché en USB-C. L'idée : ne pas se contenter de remapper côté PC (TARGET, vJoy…), mais **changer ce que la manette *est*** au niveau USB — donc toucher au firmware du microcontrôleur.

Contrainte forte posée dès le départ : **ne pas ouvrir l'appareil.** Tout devait se faire via l'USB.

Deux questions décisives à trancher *avant* d'investir :
1. **Peut-on flasher un firmware custom ?** (bootloader accessible ? signature exigée ?)
2. **Peut-on récupérer le firmware d'origine ?** (read-out protection ? → nécessaire pour connaître le *pinout* : quel GPIO = quel bouton, quel canal ADC = quel capteur Hall.)

---

## 2. Environnement & matériel

| | |
|---|---|
| OS | Windows 11 Pro 10.0.26200 |
| Shell | PowerShell 5.1 |
| Outils écrits | `scripts/Read-DfuDescriptors.ps1` (lecteur de descripteurs USB via hub IOCTL) |
| Outils tiers | STM32CubeProgrammer 2.22.0 |
| Logiciels Thrustmaster présents | TARGET 3.0.25.603, TM Flight Series drivers, `TMFirmwareUpdater.exe` |

---

## 3. Méthodologie (vue d'ensemble)

Principe directeur : **du moins invasif au plus invasif, en vérifiant à chaque étape, et toujours de façon réversible.**

```
Phase 0  Identification USB            (énumération, 100% passif)
Phase 1  Recon logiciel hôte           (drivers/firmware Thrustmaster sur le PC)
Phase 2  Trouver le MCU                (web → impasses → la bonne méthode)
Phase 3  Entrée en DFU                 (combo boutons, lecture seule, 0 écriture)
Phase 4  Lecture carte mémoire         (descripteurs USB via hub IOCTL)
Phase 5  Die exact + RDP               (STM32CubeProgrammer)
Phase 6  Dump & analyse firmware       (upload + validation + strings)
```

### Principes de méthodo retenus
- **Identifier avant d'agir.** Chaque commande qui modifie quelque chose n'arrive qu'après avoir compris l'état courant.
- **Vérifier plutôt que deviner.** Estimation initiale du MCU = « STM32F0/F1 » ; la lecture réelle a donné un **F446**. La déduction « famille » donnait F4 512 Ko mais *pas* la déclinaison — il a fallu lire le `Device ID` pour trancher F401/F411/**F446**.
- **Réversibilité d'abord.** L'entrée en DFU par combo de boutons est *non destructive* ; on n'a jamais cliqué « flash ». Sortie = débrancher/rebrancher.
- **Recouper les sources.** La carte mémoire lue par notre script maison a été reconfirmée par CubeProgrammer.
- **Ne pas se reposer sur des mirrors.** CubeProgrammer pris uniquement à la source ST (supply chain).

---

## 4. Déroulé détaillé, phase par phase

### Phase 0 — Identification USB (passif)

```powershell
Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like '*VID_044F*' } |
  Select-Object Status, Class, FriendlyName, InstanceId | Format-List
```

Résultat : `VID_044F` (Thrustmaster/Guillemot), **`PID_040E`**, périphérique **composite** :
- `MI_00` → `TCA Sidestick X Pilot Bus Driver` (HID) — bus propriétaire Thrustmaster (écosystème T.A.R.G.E.T)
- `MI_01` → classe **`MEDIA`** (intrigant à ce stade — résolu en Phase 6 : c'est le **jack casque**)
- enfant → `Contrôleur de jeu HID`

> Leçon : la manette ne parle pas un HID joystick « plat » — il y a une couche propriétaire (le « Bus Driver »).

### Phase 1 — Recon logiciel hôte

On fouille ce que Thrustmaster a déjà installé. La trouvaille décisive :

```
C:\Program Files\Thrustmaster\TM Flight Series\drivers\amd64\GuiSTDFUDevUpdate64.dll
```

**`GuiSTDFUDevUpdate`** = *Guillemot **ST DFU** Device Update*. Donc :
- MCU **STMicroelectronics** (→ STM32),
- mise à jour firmware via le **bootloader DFU USB de ST**.

Confirmé par une adresse trouvée dans `…\TARGET\scripts\target.tmh` : **`0x08000000`** (base flash STM32) + **`0x20000000`** (base RAM).

### Phase 2 — Trouver le MCU : bonnes et mauvaises pistes

- ❌ **FCC** : impasse *par construction*. Un périphérique **filaire** (sans radio) passe en simple auto-déclaration → **aucune photo interne déposée** à la FCC. (Les photos de teardown publiques n'existent que pour les appareils avec radio.)
- ❌ **Teardowns web** : tout ce qui est indexé concerne l'**ancienne** TCA Sidestick (non-X), MCU potentiellement différent.
- ✅ **La bonne méthode** : lire la **carte mémoire que le bootloader DFU expose lui-même**. Définitif et propre à l'exemplaire.

### Phase 3 — Entrée en DFU (lecture seule)

Combo spécifique au modèle **X** (confirmé via le guide iFixit dédié) :

1. Débrancher la manette
2. Interrupteur arrière sur **PC**
3. **Maintenir le bouton Xbox**
4. Rebrancher l'USB (toujours en maintenant)
5. ~5 s puis relâcher

> Aucune écriture : la combo ne fait qu'amener le ROM bootloader. Sortie = débrancher/rebrancher. **On n'ouvre jamais `TMFirmwareUpdater`** (pas besoin, et zéro risque de flash accidentel).

Détection :

```powershell
Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -match 'VID_0483' -or $_.FriendlyName -match 'DFU|BOOT|STM' } |
  Select-Object Status, Class, FriendlyName, InstanceId | Format-List
```

→ `Guillemot STM DFU Device`, **`VID_0483 & PID_DF11 & REV_2200`**, iProduct `STM32  BOOTLOADER`, service `GuiSTDFUDev`. C'est le **bootloader système ST DfuSe v2.2** standard.

### Phase 4 — Lecture de la carte mémoire (hub IOCTL)

Le pilote Guillemot est attaché (pas WinUSB) → `dfu-util` ne pourrait pas ouvrir le device sans un swap de pilote (Zadig). Pour éviter ça, on lit les **string descriptors** au niveau du **hub USB** (même technique qu'USBView, indépendante du pilote attaché) avec un script maison : [`scripts/Read-DfuDescriptors.ps1`](scripts/Read-DfuDescriptors.ps1).

Sortie :

```
str[1] = STMicroelectronics
str[2] = STM32  BOOTLOADER
str[3] = STM32FxSTM32
str[4] = @Internal Flash  /0x08000000/04*016Kg,01*064Kg,03*128Kg
str[5] = @Option Bytes    /0x1FFFC000/01*016 e
str[6] = @OTP Memory      /0x1FFF7800/01*512 e,01*016 e
str[7] = @Device Feature  /0xFFFF0000/01*004 e
```

**Décodage de l'empreinte :**
- Secteurs flash `4×16K + 1×64K + 3×128K` = **512 Ko** → disposition canonique **STM32F4** (≤ 512 Ko).
- **Option bytes @ `0x1FFFC000`** + **OTP @ `0x1FFF7800`** = signature **STM32 F2/F4** (les F0/F1/F3/L0 les placent ailleurs).

→ Conclusion à ce stade : **STM32F4, 512 Ko** (déclinaison encore indéterminée).

### Phase 5 — Die exact + RDP (STM32CubeProgrammer)

CubeProgrammer absent de winget → pris à la source ST (zip → `SetupSTM32CubeProgrammer_win64.exe`, install GUI, **acceptation de licence par l'utilisateur**).

Une fois la manette **remise en DFU** :

```powershell
$cli = "C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe"
& $cli -l usb                       # liste les devices DFU
& $cli -c port=usb1 -ob displ       # connecte + affiche les option bytes (RDP)
```

> Bonne surprise : CubeProgrammer voit le device **même avec le pilote Guillemot** en place (pas besoin du swap via `Drivers\DFU_Driver\STM32Bootloader.bat`).

Résultats :
- **`Device ID : 0x421` → `Device name : STM32F446xx`** — die exact.
- **`RDP : 0xAA (Level 0, no protection)`** — lecture flash 100 % ouverte.
- `nWRP0..7` tous inactifs (pas de write protection), `SPRMOD 0x0` (PCROP désactivé).

### Phase 6 — Dump & analyse du firmware

RDP0 → on peut tout lire. On dumpe les 512 Ko :

```powershell
& $cli -c port=usb1 -u 0x08000000 0x80000 "tca_sidestick_x_fw_ORIGINAL_512k.bin"
```

Validation (table des vecteurs Cortex-M) :
- Taille `524288` octets ✓
- Initial SP = `0x2000EDD0` (pointe en RAM) ✓
- Reset vector = `0x080101F1` (pointe en flash, bit Thumb) ✓
- `83321 / 524288` octets non-`0xFF` (~16 % de remplissage = vrai code)

Strings notables (cf. Annexe A) :
- `Thrustmaster`, `TCA Sidestick X`, `TCA Sidestick X Pilot`, **`TCA Sidestick X Copilot`** (deux rôles)
- **`Microsoft.Xbox.Input.FlightStick`** → protocole **Xbox GIP** (l'auth runtime)
- **`Windows.Xbox.Input.Headset`** → ✅ explique la classe `MEDIA` de la Phase 0 (le jack casque)
- `MSFT100` → descripteurs Microsoft OS

---

## 5. Findings techniques clés

- **MCU : STM32F446** — Cortex-M4 **avec FPU/DSP**, ≤ 180 MHz, **512 Ko flash / 128 Ko RAM**, **USB 2.0 OTG FS et HS**. Largement surdimensionné pour un joystick → marge énorme pour du custom.
- **Bootloader = ROM système ST** (les alt settings `@Option Bytes`/`@OTP`/`@Device Feature` sont sa signature). Le ROM bootloader ST **ne vérifie aucune signature** → on peut y écrire n'importe quelle image.
- **RDP niveau 0** = le meilleur cas : dump complet possible + reflash libre. (Et le simple fait d'avoir *atteint* le bootloader système excluait déjà le **niveau 2**, qui le désactive de façon permanente.)
- **Logique RDP** (pour mémoire) : `0xAA`=L0 (ouvert), `0xCC`=L2 (verrouillé à vie), tout le reste = L1 (lecture bloquée mais reflash possible après régression RDP→0, qui *mass-erase*).

---

## 6. Analyse des deux « murs »

| Mur | Crainte initiale | Réalité |
|---|---|---|
| **Firmware signé** | « Licence Xbox ⇒ image signée, flash custom impossible » | ❌ Faux : bootloader ROM ST standard, **pas de vérif de signature**. L'auth Xbox est *runtime* (puce MS), contournable en ignorant le GIP. |
| **RDP (dump impossible)** | « RDP1/2 ⇒ pas de récupération du firmware d'origine ⇒ pas de pinout » | ❌ Non applicable : **RDP0**, dump complet réussi. |

---

## 7. Cookbook (reproduire / réutiliser)

```powershell
# --- Identifier la manette (mode normal) ---
Get-PnpDevice -PresentOnly | ? InstanceId -like '*VID_044F*' | fl FriendlyName,InstanceId

# --- Entrer en DFU (modèle X) ---
# Débrancher → switch arrière sur PC → MAINTENIR bouton Xbox → rebrancher USB → ~5s → relâcher

# --- Détecter le device DFU ---
Get-PnpDevice -PresentOnly | ? InstanceId -match 'VID_0483' | fl FriendlyName,InstanceId

# --- Lire la carte mémoire SANS swap de pilote ---
.\scripts\Read-DfuDescriptors.ps1

$cli = "C:\Program Files\STMicroelectronics\STM32Cube\STM32CubeProgrammer\bin\STM32_Programmer_CLI.exe"

# --- Die exact + RDP ---
& $cli -l usb
& $cli -c port=usb1 -ob displ

# --- Dump complet de la flash (512 Ko) ---
& $cli -c port=usb1 -u 0x08000000 0x80000 "tca_sidestick_x_fw_ORIGINAL_512k.bin"

# --- (FUTUR) Restaurer le firmware d'origine ---
& $cli -c port=usb1 -w "firmware\tca_sidestick_x_fw_ORIGINAL_512k.bin" 0x08000000 -v

# --- (FUTUR) Flasher un firmware custom ---
& $cli -c port=usb1 -w "build\custom.bin" 0x08000000 -v -s

# --- Sortir du DFU ---
# Débrancher / rebrancher normalement (aucune écriture si on s'est arrêté au -ob/-u)
```

---

## 8. Artefacts

```
TCA-Sidestick-X-Reverse/
├── README.md                                   ← ce document
├── firmware/
│   └── tca_sidestick_x_fw_ORIGINAL_512k.bin    ← dump d'origine (512 Ko) — backup + base RE
└── scripts/
    └── Read-DfuDescriptors.ps1                 ← lecteur de string descriptors via hub IOCTL
```
Copie du dump aussi dans `C:\Users\Sam\Downloads\`. Installeur CubeProgrammer dans `Downloads\CubeProg_extract\`.

---

## 9. Risques & réversibilité

- **Lecture (ce qu'on a fait) :** 0 risque, 0 écriture.
- **Flash custom (à venir) :** risque de brick **faible et récupérable** tant qu'on ne touche **jamais** la zone bootloader (il est en ROM, non écrasable de toute façon) et qu'on garde le dump d'origine pour restaurer. RDP0 = on peut toujours reflasher.
- **À NE PAS faire :** passer RDP en `0xCC` (niveau 2) = **brique définitive** (bootloader + debug désactivés à vie). Ne jamais exécuter `-ob rdp=0xCC`.
- **Pilote :** si un jour on installe le pilote DFU de ST (Zadig/Cube), l'updater officiel Thrustmaster ne verra plus la manette tant que le pilote Guillemot n'est pas restauré (réversible via réinstall des drivers TM).

---

## 10. Prochaines étapes

1. **Reverse du dump (Ghidra)** : base `0x08000000`, Cortex-M4 (little-endian). Extraire le **pinout** (GPIO ↔ boutons, canaux ADC ↔ capteurs Hall), la config d'horloge, le montage USB/HID.
2. **Firmware custom PoC** : énumérer en **souris HID** (USB OTG FS du F446) — stack TinyUSB ou STM32Cube USB Device. Cible « rêve » : reconnu par un iPhone.
3. **Mapper les vrais contrôles** sur la nouvelle fonction (une fois le pinout connu).
4. **Liste des « projets fun »** (en attente côté utilisateur) → prioriser.

---
*Généré pendant la session de recon du 2026-06-06. Tous les résultats bruts en Annexe.*

---

## Annexe A — Sorties brutes

### A.1 — Détection DFU (`Get-PnpDeviceProperty`)
```
DeviceDesc            : Guillemot STM DFU Device
HardwareIds           : USB\VID_0483&PID_DF11&REV_2200, USB\VID_0483&PID_DF11
CompatibleIds         : USB\COMPAT_VID_0483&Class_FE&SubClass_01&Prot_02, ...
Service               : GuiSTDFUDev
BusReportedDeviceDesc : STM32  BOOTLOADER
DriverVersion         : 7.3.2.0  (oem141.inf)
LocationInfo          : Port_#0016.Hub_#0004
```

### A.2 — CubeProgrammer : connexion
```
Device ID   : 0x421
Device name : STM32F446xx
NVM size    : 512 KBytes
Device CPU  : Cortex-M4
DFU protocol: 1.1   |   USB speed : Full Speed (12 MBit/s)
Firmware version (bootloader) : 0x011a
```

### A.3 — CubeProgrammer : option bytes
```
Read Out Protection
  RDP        : 0xAA (Level 0, no protection)
PCROP
  SPRMOD     : 0x0 (PCROP disabled)
BOR Level
  BOR_LEV    : 0x3 (BOR OFF)
User Config
  WDG_SW=1 (software)  nRST_STOP=1  nRST_STDBY=1
Write Protection
  nWRP0..7   : 0x1 (write protection NOT active)
```

### A.4 — Dump : validation
```
File size   : 524288 bytes (512 KB)
Initial SP  : 0x2000EDD0   (RAM)
Reset vector: 0x080101F1   (flash, Thumb)
Non-0xFF    : 83321 / 524288
Read time   : ~11 s
```

### A.5 — Strings firmware
```
Thrustmaster
TCA Sidestick X
TCA Sidestick X Pilot
TCA Sidestick X Copilot
Microsoft.Xbox.Input.FlightStick
Windows.Xbox.Input.NavigationController
Windows.Xbox.Input.Headset
MSFT100   (Microsoft OS String Descriptor)
```
