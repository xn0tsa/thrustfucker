<#
.SYNOPSIS
    Lit les string descriptors USB d'un peripherique (par defaut le bootloader ST DFU 0483:DF11)
    via les IOCTL du hub USB - SANS installer ni echanger de pilote (meme methode qu'USBView).

.DESCRIPTION
    Quand un STM32 est en mode DFU mais que le pilote attache n'est PAS WinUSB (ici le pilote
    proprietaire "Guillemot STM DFU Device"), dfu-util ne peut pas ouvrir le device sans un swap
    de pilote (Zadig). Ce script contourne ca : il interroge le HUB USB parent via
    IOCTL_USB_GET_DESCRIPTOR_FROM_NODE_CONNECTION, ce qui fonctionne quel que soit le pilote
    attache au device. On recupere ainsi la "memory map" DfuSe :
        @Internal Flash /0x08000000/...   @Option Bytes /0x1FFFC000/...   etc.

.PARAMETER VendorId
    Vendor ID (defaut 0x0483 = STMicroelectronics).

.PARAMETER ProductId
    Product ID (defaut 0xDF11 = bootloader DFU ST).

.EXAMPLE
    .\Read-DfuDescriptors.ps1
    .\Read-DfuDescriptors.ps1 -VendorId 0x0483 -ProductId 0xDF11

.NOTES
    Projet : TCA Sidestick X reverse engineering. Lecture seule, 100% non destructif.
    NB: ne pas nommer un parametre $Pid -> c'est une variable automatique reservee de PowerShell.
#>
param(
    [uint16]$VendorId = 0x0483,
    [uint16]$ProductId = 0xDF11
)

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public static class UsbDfu {
  const uint GENERIC_READ=0x80000000, GENERIC_WRITE=0x40000000;
  const uint FILE_SHARE_READ=1, FILE_SHARE_WRITE=2, OPEN_EXISTING=3;
  const uint DIGCF_PRESENT=0x2, DIGCF_DEVICEINTERFACE=0x10;
  // CTL_CODE(FILE_DEVICE_USB=0x22, func, METHOD_BUFFERED, FILE_ANY_ACCESS)
  const uint IOCTL_INFO_EX=0x220448; // GET_NODE_CONNECTION_INFORMATION_EX (func 274)
  const uint IOCTL_DESC=0x220410;    // GET_DESCRIPTOR_FROM_NODE_CONNECTION (func 260)
  static readonly IntPtr INVALID=new IntPtr(-1);
  // GUID_DEVINTERFACE_USB_HUB
  static Guid HUB=new Guid(unchecked((int)0xf18a0e88),unchecked((short)0xc30c),0x11d0,0x88,0x15,0x00,0xa0,0xc9,0x06,0xbe,0xd8);

  [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr SetupDiGetClassDevs(ref Guid g,IntPtr e,IntPtr w,uint f);
  [DllImport("setupapi.dll",SetLastError=true)] static extern bool SetupDiEnumDeviceInterfaces(IntPtr h,IntPtr d,ref Guid g,uint i,ref SP_DID data);
  [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr h,ref SP_DID d,IntPtr det,uint ds,out uint req,IntPtr di);
  [DllImport("setupapi.dll",SetLastError=true)] static extern bool SetupDiDestroyDeviceInfoList(IntPtr h);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFile(string n,uint a,uint s,IntPtr sec,uint d,uint f,IntPtr t);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool DeviceIoControl(IntPtr h,uint c,byte[] ib,uint isz,byte[] ob,uint osz,out uint r,IntPtr o);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr h);

  [StructLayout(LayoutKind.Sequential)] struct SP_DID { public uint cbSize; public Guid g; public uint flags; public IntPtr res; }

  public static List<string> Dump(ushort vid, ushort pid){
    var o=new List<string>();
    IntPtr hd=SetupDiGetClassDevs(ref HUB,IntPtr.Zero,IntPtr.Zero,DIGCF_PRESENT|DIGCF_DEVICEINTERFACE);
    if(hd==INVALID){o.Add("ERR GetClassDevs");return o;}
    var did=new SP_DID(); did.cbSize=(uint)Marshal.SizeOf(did); uint i=0;
    while(SetupDiEnumDeviceInterfaces(hd,IntPtr.Zero,ref HUB,i,ref did)){
      i++; uint req=0; SetupDiGetDeviceInterfaceDetail(hd,ref did,IntPtr.Zero,0,out req,IntPtr.Zero);
      if(req==0) continue; IntPtr det=Marshal.AllocHGlobal((int)req);
      Marshal.WriteInt32(det,(IntPtr.Size==8)?8:6);  // cbSize de SP_DEVICE_INTERFACE_DETAIL_DATA
      if(SetupDiGetDeviceInterfaceDetail(hd,ref did,det,req,out req,IntPtr.Zero)){
        string path=Marshal.PtrToStringUni(new IntPtr(det.ToInt64()+4)); Probe(path,vid,pid,o);
      }
      Marshal.FreeHGlobal(det);
    }
    SetupDiDestroyDeviceInfoList(hd); return o;
  }
  // Sur chaque hub, on sonde les ports 1..31 et on lit le device descriptor de chaque port.
  static void Probe(string path, ushort vid, ushort pid, List<string> o){
    IntPtr h=CreateFile(path,GENERIC_WRITE|GENERIC_READ,FILE_SHARE_READ|FILE_SHARE_WRITE,IntPtr.Zero,OPEN_EXISTING,0,IntPtr.Zero);
    if(h==INVALID) return;
    for(uint p=1;p<=31;p++){
      byte[] b=new byte[1024]; BitConverter.GetBytes(p).CopyTo(b,0); uint r;
      if(!DeviceIoControl(h,IOCTL_INFO_EX,b,(uint)b.Length,b,(uint)b.Length,out r,IntPtr.Zero)) continue;
      // USB_NODE_CONNECTION_INFORMATION_EX: ConnectionIndex(4) + USB_DEVICE_DESCRIPTOR @offset 4
      // idVendor @ desc+8 = buf+12 ; idProduct @ desc+10 = buf+14
      ushort dv=BitConverter.ToUInt16(b,12), dp=BitConverter.ToUInt16(b,14);
      if(dv==vid && dp==pid){
        o.Add(String.Format("FOUND {0:X4}:{1:X4} port {2}",dv,dp,p));
        for(uint s=1;s<=16;s++){ string v=GetStr(h,p,s); if(!String.IsNullOrEmpty(v)) o.Add(String.Format("  str[{0,2}] = {1}",s,v)); }
      }
    }
    CloseHandle(h);
  }
  // GET_DESCRIPTOR (STRING, index, langid=0x0409) via le hub.
  static string GetStr(IntPtr h, uint port, uint idx){
    byte[] b=new byte[12+256]; BitConverter.GetBytes(port).CopyTo(b,0);
    // USB_DESCRIPTOR_REQUEST: ConnectionIndex(4) + SETUP_PACKET(8) + Data[]
    b[4]=0x80;            // bmRequest = IN, standard, device
    b[5]=0x06;            // bRequest  = GET_DESCRIPTOR
    b[6]=(byte)idx; b[7]=0x03;                           // wValue = (STRING<<8)|index
    BitConverter.GetBytes((ushort)0x0409).CopyTo(b,8);  // wIndex = LANGID (en-US)
    BitConverter.GetBytes((ushort)256).CopyTo(b,10);    // wLength
    uint r; if(!DeviceIoControl(h,IOCTL_DESC,b,(uint)b.Length,b,(uint)b.Length,out r,IntPtr.Zero)) return null;
    if(r<14) return null; int bl=b[12]; if(bl<2) return null;      // bLength @ data offset 0 = buf[12]
    int ch=bl-2; if(14+ch>b.Length) ch=b.Length-14; if(ch<=0) return null;
    return Encoding.Unicode.GetString(b,14,ch).TrimEnd('\0');      // UTF-16LE @ buf[14..]
  }
}
'@

Add-Type -TypeDefinition $code -Language CSharp
Write-Host ("Lecture des descripteurs USB pour {0:X4}:{1:X4} ..." -f $VendorId, $ProductId) -ForegroundColor Cyan
$res = [UsbDfu]::Dump($VendorId, $ProductId)
if (-not $res -or -not ($res -match 'FOUND')) {
    Write-Warning ("Aucun device {0:X4}:{1:X4} trouve. La manette est-elle bien en DFU ?" -f $VendorId, $ProductId)
}
$res | ForEach-Object { $_ }
