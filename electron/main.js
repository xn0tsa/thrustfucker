const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path  = require('path')
const fs    = require('fs')
const { exec, execFile, spawn } = require('child_process')
const { SerialPort }     = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')

const isDev = !app.isPackaged

// ── Serial C2 state ───────────────────────────────────────────────────────────
let g_serialPort = null

// ── STM32CubeProgrammer path ──────────────────────────────────────────────────
const DEFAULT_CLI = 'C:\\Program Files\\STMicroelectronics\\STM32Cube\\STM32CubeProgrammer\\bin\\STM32_Programmer_CLI.exe'
const ORIGINAL_FW = 'C:\\Users\\Sam\\TCA-Sidestick-X-Reverse\\firmware\\tca_sidestick_x_fw_ORIGINAL_512k.bin'

function getCLI() {
  const stored = app.isPackaged
    ? path.join(app.getPath('userData'), 'settings.json')
    : path.join(__dirname, '..', 'settings.json')
  try {
    const s = JSON.parse(fs.readFileSync(stored, 'utf8'))
    return s.cliPath || DEFAULT_CLI
  } catch { return DEFAULT_CLI }
}

function saveSettings(data) {
  const p = app.isPackaged
    ? path.join(app.getPath('userData'), 'settings.json')
    : path.join(__dirname, '..', 'settings.json')
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

function getSettings() {
  const p = app.isPackaged
    ? path.join(app.getPath('userData'), 'settings.json')
    : path.join(__dirname, '..', 'settings.json')
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) }
  catch { return { cliPath: DEFAULT_CLI, originalFw: ORIGINAL_FW } }
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:           1100,
    height:          720,
    minWidth:        900,
    minHeight:       600,
    backgroundColor: '#0a0a0a',
    titleBarStyle:   'hiddenInset',
    frame:           false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── IPC: DFU detection ────────────────────────────────────────────────────────
ipcMain.handle('dfu:detect', async () => {
  return new Promise(resolve => {
    // Check USB for STM32 DFU device (VID=0483, PID=DF11)
    exec(
      'powershell -NoProfile -Command "Get-PnpDevice | Where-Object {$_.HardwareID -like \'*VID_0483*PID_DF11*\'} | Select-Object -ExpandProperty Status"',
      (err, stdout) => {
        if (!err && stdout.includes('OK')) {
          resolve({ found: true, method: 'pnp' })
          return
        }
        // Fallback: try STM32CubeProgrammer
        const cli = getCLI()
        if (!fs.existsSync(cli)) {
          resolve({ found: false, error: 'STM32CubeProgrammer not found at ' + cli })
          return
        }
        execFile(cli, ['-c', 'port=usb1', '-q'], { timeout: 5000 }, (err2, stdout2) => {
          const found = !err2 && (stdout2.includes('STM32') || stdout2.includes('DFU'))
          resolve({ found, raw: stdout2 })
        })
      }
    )
  })
})

// ── IPC: Flash firmware ───────────────────────────────────────────────────────
ipcMain.handle('dfu:flash', async (event, { firmwarePath }) => {
  return new Promise(resolve => {
    const cli = getCLI()
    if (!fs.existsSync(cli))           return resolve({ ok: false, error: 'CLI introuvable: ' + cli })
    if (!fs.existsSync(firmwarePath))  return resolve({ ok: false, error: 'Firmware introuvable: ' + firmwarePath })

    const args = ['-c', 'port=usb1', '-w', firmwarePath, '0x08000000', '-v', '-s']
    const proc = spawn(cli, args)
    let log = ''

    proc.stdout.on('data', d => {
      const chunk = d.toString()
      log += chunk
      // STM32CubeProgrammer prints "XX%" during write — stream real progress to renderer
      const m = chunk.match(/(\d{1,3})%/)
      if (m) {
        const pct = Math.min(99, Math.max(0, parseInt(m[1], 10)))
        event.sender.send('flash:progress', pct)
      }
    })
    proc.stderr.on('data', d => { log += d.toString() })
    proc.on('close', code => resolve({ ok: code === 0, log, code }))
  })
})

// ── IPC: Restore original firmware ───────────────────────────────────────────
ipcMain.handle('dfu:restore', async () => {
  const s = getSettings()
  return new Promise(resolve => {
    const cli = getCLI()
    const fw  = s.originalFw || ORIGINAL_FW
    if (!fs.existsSync(cli)) return resolve({ ok: false, error: 'CLI introuvable' })
    if (!fs.existsSync(fw))  return resolve({ ok: false, error: 'Firmware original introuvable: ' + fw })

    const proc = spawn(cli, ['-c', 'port=usb1', '-w', fw, '0x08000000', '-v', '-s'])
    let log = ''
    proc.stdout.on('data', d => { log += d.toString() })
    proc.stderr.on('data', d => { log += d.toString() })
    proc.on('close', code => resolve({ ok: code === 0, log }))
  })
})

// ── forge_config_t binary struct builder ──────────────────────────────────────
// Mirrors firmware/src/config.h forge_config_t (packed, 33641 bytes, multi-slot)
// Header layout: magic(4) + mode_id(8) + delay(2) + exfil(1) + layout(1)
//              + webhook_url(256) + drive_label(32) + aes_key(32) + extra_json(512) + slot_count(1)
//              = 849 bytes header + 8×4099 = 33641 bytes total
// globalConfig : { keystrokeDelayMs, keyboardLayout, exfilMode, webhookUrl, driveLabel, aesKey }
// slots        : [{ buttonIndex, ducky, modeConfig? }]
function buildForgeConfig(modeId, globalConfig, slots) {
  const MAX_SLOTS = 8
  const SLOT_SIZE = 1 + 2 + 4096  // button(1) + len(2) + data(4096) = 4099
  const HEADER    = 4 + 8 + 2 + 1 + 1 + 256 + 32 + 32 + 512 + 1 // = 849
  const TOTAL     = HEADER + MAX_SLOTS * SLOT_SIZE                  // = 33641

  const s = Buffer.alloc(TOTAL, 0)
  let o = 0

  // magic "FORG" little-endian
  s.writeUInt32LE(0x464F5247, o); o += 4

  // mode_id[8]
  const mid = Buffer.alloc(8, 0)
  Buffer.from(modeId.substring(0, 7), 'ascii').copy(mid)
  mid.copy(s, o); o += 8

  // keystroke_delay_ms
  s.writeUInt16LE(globalConfig.keystrokeDelayMs || 60, o); o += 2

  // exfil_mode
  const exfilMap = { 'Webhook HTTPS': 1, 'Device (flash)': 2, 'Dual USB': 3 }
  let exfil = globalConfig.exfilMode
  if (typeof exfil === 'string') exfil = exfilMap[exfil] ?? 0
  else if (exfil == null)        exfil = 0
  s.writeUInt8(exfil, o); o += 1

  // keyboard_layout: 0=QWERTY 1=AZERTY
  s.writeUInt8(globalConfig.keyboardLayout === 'AZERTY (FR)' ? 1 : 0, o); o += 1

  // webhook_url[256]
  const wh = Buffer.alloc(256, 0)
  if (globalConfig.webhookUrl) Buffer.from(globalConfig.webhookUrl.substring(0, 255), 'utf8').copy(wh)
  wh.copy(s, o); o += 256

  // drive_label[32]
  const dl = Buffer.alloc(32, 0)
  if (globalConfig.driveLabel) Buffer.from(globalConfig.driveLabel.substring(0, 31), 'utf8').copy(dl)
  dl.copy(s, o); o += 32

  // aes_key[32]
  const ak = Buffer.alloc(32, 0)
  if (globalConfig.aesKey) Buffer.from(globalConfig.aesKey.substring(0, 31), 'utf8').copy(ak)
  ak.copy(s, o); o += 32

  // extra_json[512] — config JSON mode-spécifique (C/E/F) : slot[0].modeConfig sérialisé
  const extraBuf = Buffer.alloc(512, 0)
  const firstModeConfig = slots?.[0]?.modeConfig
  if (firstModeConfig) {
    try {
      const j = JSON.stringify(firstModeConfig).substring(0, 511)
      Buffer.from(j, 'utf8').copy(extraBuf)
    } catch {}
  }
  extraBuf.copy(s, o); o += 512

  // slot_count
  const slotCount = Math.min((slots || []).length, MAX_SLOTS)
  s.writeUInt8(slotCount, o); o += 1

  // slots[] — always write MAX_SLOTS blocks (empty ones stay zero)
  for (let i = 0; i < MAX_SLOTS; i++) {
    if (i < slotCount) {
      const slot = slots[i]
      s.writeUInt8(slot.buttonIndex, o); o += 1
      const payloadBuf = Buffer.from(slot.ducky || '', 'utf8')
      const payloadLen = Math.min(payloadBuf.length, 4096)
      s.writeUInt16LE(payloadLen, o); o += 2
      payloadBuf.copy(s, o, 0, payloadLen); o += 4096
    } else {
      o += SLOT_SIZE
    }
  }

  return s
}

// ── IPC: Build firmware for a given mode + multi-slot config ──────────────────
// { modeId, globalConfig, slots: [{buttonIndex, ducky}] }
ipcMain.handle('firmware:build', async (_event, { modeId, globalConfig, slots, firmwareClass: fwClass }) => {
  const outDir = isDev
    ? path.join(__dirname, '..', 'assets', 'firmware')
    : path.join(process.resourcesPath, 'firmware')

  // fwClass is passed explicitly from the UI (mode.firmware); fall back to modeId[0] for legacy calls
  const firmwareClass = (fwClass || modeId[0]).toLowerCase()
  const baseBin = path.join(outDir, `mode_${firmwareClass}01.bin`)
  if (!fs.existsSync(baseBin)) {
    return { ok: false, error: 'Firmware de base introuvable: ' + baseBin, binPath: null }
  }

  // CONFIG_FLASH_ADDR = 0x08010000 → offset 0x10000 (64 KB) in the .bin file
  const CFG_OFFSET = 0x10000

  const fwCode = fs.readFileSync(baseBin)
  const padded = Buffer.alloc(CFG_OFFSET, 0xFF)
  fwCode.copy(padded, 0, 0, Math.min(fwCode.length, CFG_OFFSET))

  const fullBin = Buffer.concat([padded, buildForgeConfig(modeId, globalConfig || {}, slots || [])])

  const binName = `mode_${modeId.replace('-', '').toLowerCase()}.bin`
  const binPath = path.join(outDir, binName)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(binPath, fullBin)

  return { ok: true, binPath }
})

// ── IPC: Detect stick in normal mode (VID 0x1209 / PID 0x5446) ───────────────
// Lit le numéro de série Windows (TF-A01, TF-C01…) → dérive la classe firmware
// Approche fichier temp (.ps1) pour éviter tous les problèmes d'échappement cmd.exe
ipcMain.handle('stick:detectNormal', async () => {
  return new Promise(resolve => {
    const psPath = path.join(app.getPath('temp'), 'tf_detect.ps1')
    const psScript = [
      '# Cherche firmware ThrustFucker (VID_1209/PID_5446) OU firmware original Thrustmaster (VID_044F/PID_040E)',
      '$forge = Get-WmiObject Win32_PnPEntity | Where-Object {',
      '  $_.DeviceID -like "*VID_1209*PID_5446*" -and',
      '  $_.Status   -eq "OK" -and',
      '  $_.DeviceID -notlike "*&MI_*"',
      '} | Select-Object -First 1',
      '$original = Get-WmiObject Win32_PnPEntity | Where-Object {',
      '  $_.DeviceID -like "*VID_044F*PID_040E*" -and',
      '  $_.Status   -eq "OK" -and',
      '  $_.DeviceID -notlike "*&MI_*"',
      '} | Select-Object -First 1',
      'if ($forge) {',
      '  $serial = ($forge.DeviceID -split "\\\\")[-1]',
      '  @{ found=$true; isOriginal=$false; name=$forge.Name; serial=$serial; deviceId=$forge.DeviceID } | ConvertTo-Json -Compress',
      '} elseif ($original) {',
      '  $serial = ($original.DeviceID -split "\\\\")[-1]',
      '  @{ found=$true; isOriginal=$true; name=$original.Name; serial=$serial; deviceId=$original.DeviceID } | ConvertTo-Json -Compress',
      '} else {',
      '  \'{"found":false}\'',
      '}',
    ].join('\r\n')

    try { fs.writeFileSync(psPath, psScript, 'utf8') } catch (e) {
      return resolve({ found: false })
    }

    exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psPath}"`,
      { timeout: 8000 },
      (err, stdout) => {
        try { fs.unlinkSync(psPath) } catch {}
        if (err || !stdout.trim()) return resolve({ found: false })
        try {
          const d = JSON.parse(stdout.trim())
          if (!d.found) return resolve({ found: false })
          if (d.isOriginal) {
            // Firmware Thrustmaster d'origine
            return resolve({ found: true, isOriginal: true, firmwareClass: null, productString: 'TCA Sidestick X Pilot', serial: d.serial || '' })
          }
          // Firmware ThrustFucker : TF-A01 → classe A, TF-C01 → C, etc.
          const m = (d.serial || '').match(/^TF-([A-F])/i)
          const firmwareClass = m ? m[1].toUpperCase() : null
          resolve({ found: true, isOriginal: false, firmwareClass, productString: d.name || '', serial: d.serial || '' })
        } catch { resolve({ found: false }) }
      }
    )
  })
})

// ── IPC: Settings ─────────────────────────────────────────────────────────────
ipcMain.handle('settings:get',  async () => getSettings())
ipcMain.handle('settings:save', async (_e, data) => { saveSettings(data); return { ok: true } })
ipcMain.handle('app:openPath',  async (_e, p) => shell.openPath(p))
ipcMain.handle('app:minimize',  () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.handle('app:maximize',  () => {
  const w = BrowserWindow.getFocusedWindow()
  w?.isMaximized() ? w.unmaximize() : w?.maximize()
})
ipcMain.handle('app:close',     () => BrowserWindow.getFocusedWindow()?.close())

// ── IPC: Native file picker ───────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async (_e, { filters } = {}) => {
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── IPC: Stick MSC volume access (Firmware B only) ────────────────────────────
ipcMain.handle('stick:findVolume', async (_e, { driveLabel }) => {
  const label = (driveLabel || 'FORGE USB').replace(/['"]/g, '')
  return new Promise(resolve => {
    exec(
      `powershell -NoProfile -NonInteractive -Command "Get-WmiObject Win32_LogicalDisk | Where-Object {$_.VolumeName -eq '${label}'} | Select-Object DeviceID,VolumeName | ConvertTo-Json"`,
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve({ found: false })
        try {
          const raw = stdout.trim()
          const parsed = JSON.parse(raw)
          const obj = Array.isArray(parsed) ? parsed[0] : parsed
          if (!obj || !obj.DeviceID) return resolve({ found: false })
          const driveLetter = obj.DeviceID  // e.g. "E:"
          resolve({ found: true, driveLetter, path: driveLetter + '\\' })
        } catch { resolve({ found: false }) }
      }
    )
  })
})

ipcMain.handle('stick:listFiles', async (_e, { drivePath }) => {
  try {
    const entries = fs.readdirSync(drivePath)
    const files = entries
      .filter(name => !name.startsWith('.') && name !== 'System Volume Information')
      .map(name => {
        try {
          const full = path.join(drivePath, name)
          const stat = fs.statSync(full)
          if (!stat.isFile()) return null
          return { name, size: stat.size, modified: stat.mtime.toISOString() }
        } catch { return null }
      })
      .filter(Boolean)
    return { ok: true, files }
  } catch (e) {
    return { ok: false, error: e.message, files: [] }
  }
})

ipcMain.handle('stick:saveFile', async (_e, { drivePath, fileName }) => {
  const win = BrowserWindow.getFocusedWindow()
  const src = path.join(drivePath, fileName)
  if (!fs.existsSync(src)) return { ok: false, error: 'Fichier introuvable sur le stick' }

  const result = await dialog.showSaveDialog(win, {
    defaultPath: fileName,
    filters: [{ name: 'Tous les fichiers', extensions: ['*'] }],
  })
  if (result.canceled) return { ok: false, canceled: true }

  try {
    fs.copyFileSync(src, result.filePath)
    return { ok: true, savedTo: result.filePath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('stick:deleteFile', async (_e, { drivePath, fileName }) => {
  try {
    fs.unlinkSync(path.join(drivePath, fileName))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ── IPC: Serial port C2 relay (Firmware D) ───────────────────────────────────
ipcMain.handle('serial:list', async () => {
  try {
    const ports = await SerialPort.list()
    return { ok: true, ports: ports.map(p => ({ path: p.path, manufacturer: p.manufacturer || '', vendorId: p.vendorId || '' })) }
  } catch (e) {
    return { ok: false, error: e.message, ports: [] }
  }
})

ipcMain.handle('serial:connect', async (event, { path: portPath, baudRate = 9600 }) => {
  // Close previous port if any
  if (g_serialPort?.isOpen) {
    try { g_serialPort.close() } catch {}
    g_serialPort = null
  }
  return new Promise(resolve => {
    try {
      const port = new SerialPort({ path: portPath, baudRate: parseInt(baudRate), autoOpen: false })
      port.open(err => {
        if (err) return resolve({ ok: false, error: err.message })
        const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }))
        parser.on('data', line => {
          // Forward incoming data to renderer
          try { event.sender.send('serial:data', { line: line.trimEnd() }) } catch {}
        })
        port.on('close', () => {
          try { event.sender.send('serial:data', { line: '[port fermé]', type: 'dim' }) } catch {}
          g_serialPort = null
        })
        g_serialPort = port
        resolve({ ok: true, path: portPath, baudRate })
      })
    } catch (e) {
      resolve({ ok: false, error: e.message })
    }
  })
})

ipcMain.handle('serial:send', async (_e, { data }) => {
  if (!g_serialPort?.isOpen) return { ok: false, error: 'Port non connecté' }
  return new Promise(resolve => {
    g_serialPort.write(data + '\r\n', err => {
      resolve(err ? { ok: false, error: err.message } : { ok: true })
    })
  })
})

ipcMain.handle('serial:disconnect', async () => {
  if (!g_serialPort?.isOpen) { g_serialPort = null; return { ok: true } }
  return new Promise(resolve => {
    g_serialPort.close(err => {
      g_serialPort = null
      resolve({ ok: !err, error: err?.message })
    })
  })
})

// ── IPC: Custom payload library (persisted in userData) ───────────────────────
ipcMain.handle('library:load', async () => {
  const p = path.join(app.getPath('userData'), 'payload-library.json')
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return [] }
})
ipcMain.handle('library:save', async (_e, data) => {
  const p = path.join(app.getPath('userData'), 'payload-library.json')
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
  return { ok: true }
})
