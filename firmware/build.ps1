# ThrustFucker — Build script
# Usage: .\build.ps1 [-Mode A01] [-Clean]
# Requires: arm-none-eabi-gcc, cmake, ninja (ou make)

param(
    [string]$Mode  = "A01",
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

# Recharger le PATH système pour trouver arm-none-eabi-gcc et ninja
# (nécessaire dans un terminal frais après install winget)
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

$Root   = $PSScriptRoot
$Build  = "$Root\build\$Mode"
$Output = "$Root\..\assets\firmware"

Write-Host "=== ThrustFucker Firmware Build ===" -ForegroundColor Cyan
Write-Host "Mode    : $Mode"
Write-Host "Build   : $Build"

# Clean
if ($Clean -and (Test-Path $Build)) {
    Remove-Item $Build -Recurse -Force
    Write-Host "Build dir cleaned."
}
New-Item -ItemType Directory -Force -Path $Build | Out-Null

# CMake configure
Write-Host "`nConfiguring..." -ForegroundColor Yellow
cmake -S $Root -B $Build -G Ninja `
    -DCMAKE_BUILD_TYPE=Release `
    "-DMODE=$Mode" `
    2>&1 | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) { Write-Error "CMake configure failed"; exit 1 }

# Build
Write-Host "`nBuilding..." -ForegroundColor Yellow
cmake --build $Build 2>&1 | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

# Copy .bin to assets
$Bin = "$Build\firmware_$Mode.bin"
if (Test-Path $Bin) {
    New-Item -ItemType Directory -Force -Path $Output | Out-Null
    Copy-Item $Bin "$Output\mode_$($Mode.ToLower()).bin" -Force
    $Size = (Get-Item $Bin).Length
    Write-Host "`nOK  firmware_$Mode.bin  ($Size bytes)  →  $Output" -ForegroundColor Green
} else {
    Write-Error "Binary not found: $Bin"
}
