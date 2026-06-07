
// ============================================================
// 0x08008944  sz=2064  FUN_08008944
// ============================================================

void FUN_08008944(void)

{
  char cVar1;
  uint *puVar2;
  undefined4 uVar3;
  int *piVar4;
  undefined4 uVar5;
  undefined4 uVar6;
  int *piVar7;
  char *pcVar8;
  undefined1 *puVar9;
  undefined1 *puVar10;
  byte *pbVar11;
  undefined4 *puVar12;
  int iVar13;
  char *pcVar14;
  int iVar15;
  uint uVar16;
  uint local_30;
  undefined4 local_2c;
  undefined4 local_28;
  undefined4 local_24;
  undefined4 local_20;
  undefined4 local_1c;
  undefined4 local_18;
  undefined4 local_14;
  undefined4 local_10;
  undefined4 local_c;
  uint local_8;
  
  local_1c = 0;
  local_18 = 0;
  local_14 = 0;
  local_10 = 0;
  local_c = 0;
  FUN_08013224();
  FUN_08005328();
  puVar2 = DAT_08008d54;
  *DAT_08008d54 = *DAT_08008d54 | 1;
  uVar3 = DAT_08008d58;
  local_30 = *puVar2 & 1;
  local_1c = 0x40;
  local_18 = 1;
  local_14 = 1;
  local_10 = 0;
  FUN_080117b0(DAT_08008d58,&local_1c);
  FUN_080119f8(uVar3,0x40,1);
  DAT_08008d5c[0x26] = 0;
  local_30 = 0;
  local_2c = 0;
  local_28 = 0;
  local_24 = 0;
  local_20 = 0;
  *puVar2 = *puVar2 | 4;
  *puVar2 = *puVar2 | 1;
  *puVar2 = *puVar2 | 2;
  *puVar2 = *puVar2 | 8;
  local_8 = *puVar2 & 8;
  FUN_080119f8(DAT_08008d60,0x208,0);
  local_30 = 0x40;
  local_2c = 1;
  local_28 = 1;
  local_24 = 0;
  FUN_080117b0(uVar3,&local_30);
  FUN_080119f8(uVar3,0x40,1);
  uVar5 = DAT_08008d64;
  FUN_080119f8(DAT_08008d64,0x2100,0);
  FUN_080119f8(DAT_08008d60,0x40,0);
  FUN_080119f8(DAT_08008d68,4,1);
  local_30 = 0x2000;
  local_2c = 0;
  local_28 = 1;
  FUN_080117b0(DAT_08008d60,&local_30);
  FUN_080119f8(DAT_08008d60,8,1);
  local_30 = 8;
  local_2c = 1;
  local_28 = 0;
  local_24 = 0;
  FUN_080117b0(DAT_08008d60,&local_30);
  local_30 = 0x200;
  local_2c = 0x11;
  local_28 = 0;
  local_24 = 0;
  FUN_080117b0(DAT_08008d60,&local_30);
  uVar6 = DAT_08008d6c;
  local_30 = 0x8000;
  local_2c = DAT_08008d6c;
  local_28 = 0;
  FUN_080117b0(uVar3,&local_30);
  local_30 = 2;
  local_2c = 0;
  local_28 = 0;
  FUN_080117b0(uVar5,&local_30);
  local_30 = 0x2100;
  local_2c = 1;
  local_28 = 0;
  local_24 = 0;
  FUN_080117b0(uVar5,&local_30);
  local_30 = 0x40;
  local_2c = 1;
  local_28 = 0;
  local_24 = 0;
  FUN_080117b0(DAT_08008d60,&local_30);
  local_30 = 0x100;
  local_2c = 2;
  local_28 = 0;
  local_24 = 0;
  local_20 = 0;
  FUN_080117b0(uVar3,&local_30);
  local_30 = 4;
  local_2c = 1;
  local_28 = 0;
  local_24 = 0;
  FUN_080117b0(DAT_08008d68,&local_30);
  local_30 = 0x200;
  local_2c = 1;
  local_28 = 0;
  local_24 = 0;
  FUN_080117b0(uVar5,&local_30);
  FUN_080119f8(uVar5,0x200,0);
  local_30 = 1;
  local_2c = uVar6;
  local_28 = 0;
  FUN_080117b0(uVar3,&local_30);
  local_30 = 0x410;
  local_2c = 0;
  local_28 = 1;
  FUN_080117b0(uVar3,&local_30);
  local_30 = 0x19;
  local_2c = 0;
  local_28 = 1;
  FUN_080117b0(uVar5,&local_30);
  local_30 = 0xc033;
  local_2c = 0;
  local_28 = 1;
  FUN_080117b0(DAT_08008d60,&local_30);
  FUN_080132dc(6,0xf,0);
  FUN_080132be(6);
  FUN_080132dc(0x28,0xf,0);
  FUN_080132be(0x28);
  FUN_080113d4(100);
  iVar13 = FUN_080119e0(DAT_08008d60,0x2000);
  if (iVar13 == 1) {
    uVar16 = DAT_08008d5c[0x26] | 0x10;
  }
  else {
    uVar16 = DAT_08008d5c[0x26] & 0xffffffef;
  }
  DAT_08008d5c[0x26] = uVar16;
  iVar13 = FUN_080119e0(uVar3,0x400);
  if (iVar13 == 0) {
    uVar16 = DAT_08008d5c[0x26] | 4;
  }
  else {
    uVar16 = DAT_08008d5c[0x26] & 0xfffffffb;
  }
  DAT_08008d5c[0x26] = uVar16;
  FUN_08018a50();
  piVar4 = DAT_08008d5c;
  *(undefined1 *)(DAT_08008d5c + 1) = 0;
  *(undefined1 *)((int)piVar4 + 5) = 0;
  *(undefined1 *)(piVar4 + 0x27) = 0;
  puVar2 = DAT_08008d54;
  *DAT_08008d54 = *DAT_08008d54 | 0x400000;
  local_30 = *puVar2 & 0x400000;
  FUN_080132dc(0x38,3,0);
  FUN_080132be(0x38);
  FUN_080132dc(0x39,4,0);
  FUN_080132be(0x39);
  FUN_080132dc(0x3c,5,0);
  FUN_080132be(0x3c);
  local_30 = 0;
  local_2c = 0;
  local_28 = 0;
  local_24 = 0;
  piVar4[-0x97] = DAT_08008d70;
  piVar4[-0x96] = 0x30000;
  piVar4[-0x95] = 0;
  piVar4[-0x93] = 1;
  iVar13 = DAT_08008d74;
  *(undefined1 *)(piVar4 + -0x91) = 0;
  *(undefined1 *)(piVar4 + -0x8f) = 0;
  piVar4[-0x8c] = 0;
  piVar4[-0x8d] = iVar13;
  piVar4[-0x94] = 0;
  piVar4[-0x90] = 2;
  *(undefined1 *)(piVar4 + -0x8b) = 1;
  piVar4[-0x92] = 0;
  FUN_08010c34();
  local_30 = 1;
  local_2c = 1;
  local_28 = 2;
  FUN_08010a68(piVar4 + -0x97,&local_30);
  local_30 = 2;
  local_2c = 2;
  FUN_08010a68(piVar4 + -0x97,&local_30);
  piVar4[-0x85] = DAT_08008d78;
  piVar4[-0x84] = DAT_08008d7c;
  piVar4[-0x83] = 0;
  piVar4[-0x82] = 0x40;
  piVar4[-0x81] = 0x4000;
  piVar4[-0x80] = 0;
  piVar4[-0x7f] = 0;
  piVar4[-0x7e] = 0;
  piVar4[-0x7d] = 0;
  FUN_08012e0c();
  piVar4[-0x70] = DAT_08008d80;
  piVar4[-0x6f] = 3;
  piVar4[-0x6e] = 0;
  piVar4[-0x6c] = 0;
  piVar4[-0x6a] = 0;
  piVar4[-0x6d] = 0;
  piVar4[-0x66] = 0x1000;
  piVar4[-0x65] = 0;
  piVar4[-100] = 0;
  FUN_08014d78(piVar4 + -0x70,0,0,2);
  piVar4[-0x4e] = DAT_08008d84;
  piVar4[-0x4d] = 2;
  piVar4[-0x4a] = 0;
  piVar4[-0x48] = 0;
  piVar4[-0x4c] = 1;
  piVar4[-0x4b] = 0;
  piVar4[-0x44] = 0;
  piVar4[-0x43] = 0;
  piVar4[-0x42] = 0;
  FUN_08014d78(piVar4 + -0x4e,0,0,2);
  piVar4[-0x2c] = DAT_08008d88;
  piVar4[-0x2b] = 0x104;
  piVar4[-0x2a] = 0;
  piVar4[-0x29] = 0;
  piVar4[-0x28] = 2;
  piVar4[-0x27] = 1;
  piVar4[-0x26] = 0x200;
  piVar4[-0x25] = 0x28;
  piVar4[-0x24] = 0x80;
  piVar4[-0x23] = 0;
  piVar4[-0x22] = 0;
  piVar4[-0x21] = 10;
  FUN_08015040();
  *(uint *)piVar4[-0x2c] = *(uint *)piVar4[-0x2c] & 0xffffffbf;
  piVar4[-0x16] = DAT_08008d8c;
  piVar4[-0x15] = 0x104;
  piVar4[-0x14] = 0;
  piVar4[-0x11] = 1;
  piVar4[-0x10] = 0x200;
  piVar4[-0x13] = 0;
  piVar4[-0x12] = 2;
  piVar4[-0xf] = 0x20;
  piVar4[-0xe] = 0;
  piVar4[-0xd] = 0;
  piVar4[-0xc] = 0;
  piVar4[-0xb] = 10;
  FUN_08015040();
  FUN_0800881c();
  FUN_08003e70();
  iVar13 = FUN_08018afc(DAT_08008d90);
  piVar4[0x21] = iVar13;
  iVar13 = FUN_08018afc(DAT_08008d94);
  piVar4[0x22] = iVar13;
  FUN_080002f4(piVar4 + 9);
  iVar13 = FUN_08018bd0(DAT_08009198,0);
  piVar4[0x23] = iVar13;
  FUN_0800091c(piVar4 + 0x15);
  iVar13 = FUN_08018bd0(DAT_0800919c,0);
  piVar4[0x25] = iVar13;
  FUN_08018a78();
  *DAT_080091a4 = (uint)(*(byte *)(DAT_080091a0 + 0xd14) >> 4);
  iVar13 = *DAT_080091a8;
  piVar4[0x28] = iVar13;
  *DAT_080091ac = iVar13;
  if ((*(byte *)(piVar4 + 0x26) & 0x10) != 0) {
    pcVar14 = (char *)FUN_08001fbc(1,0xf6);
    pcVar8 = DAT_080091b0;
    if (*pcVar14 == -1) {
      builtin_strncpy(DAT_080091b0,"\x0422d",5);
    }
    else {
      pcVar14 = (char *)FUN_08001fbc(1,0xf6);
      pcVar8[1] = *pcVar14;
      pcVar14 = (char *)FUN_08001fbc(1,0xf7);
      pcVar8[3] = *pcVar14;
      pcVar14 = (char *)FUN_08001fbc(1,0xf8);
      pcVar8[4] = *pcVar14;
      pcVar14 = (char *)FUN_08001fbc(1,0xf9);
      pcVar8[2] = *pcVar14;
      pcVar14 = (char *)FUN_08001fbc(1,0xfa);
      cVar1 = *pcVar14;
      *pcVar8 = cVar1;
      if (cVar1 == -1) {
        *pcVar8 = '\x04';
      }
    }
    FUN_08002db8();
  }
  iVar13 = FUN_08018c98();
  piVar4[0x24] = iVar13;
  piVar4[0x29] = 1000;
  FUN_08018a38(200);
  iVar13 = DAT_080091b4;
  do {
    pbVar11 = DAT_080091c4;
    puVar10 = DAT_080091c0;
    puVar9 = DAT_080091bc;
    if ((*(byte *)(piVar4 + 0x26) & 0x10) == 0) {
      FUN_08018bb8(0,5);
    }
    else {
      cVar1 = *DAT_080091b8;
      while (cVar1 == '\x04') {
        *pbVar11 = 2;
        FUN_080119f8(DAT_080091c8,0x200,0);
        *puVar10 = 0;
        *puVar9 = 0xff;
        if (*(char *)(iVar13 + 0x29c) == '\x04') break;
        FUN_080047fc(piVar4 + 9);
        FUN_08018a38(1);
        cVar1 = *DAT_080091b8;
      }
      FUN_08018bb8(0,1);
      FUN_080047fc(piVar4 + 9);
    }
    if (*(char *)(iVar13 + 0x29c) == '\x03') {
      uVar16 = piVar4[0x26];
      if ((uVar16 & 0x10) == 0) {
        if (((uVar16 & 0x100) != 0) && ((uVar16 & 0x200) == 0)) {
          FUN_08002ac8();
          piVar4[0x26] = piVar4[0x26] | 0x200;
        }
      }
      else if (*DAT_080091b8 != '\0') goto LAB_08009006;
      pcVar8 = DAT_080091d0;
      piVar7 = DAT_080091a8;
      if (200 < (uint)(*DAT_080091a8 - piVar4[2])) {
        if ((uint)(*DAT_080091a8 - *piVar4) < 0x7d1) {
          if (DAT_080091d0[1] != '\0') {
            FUN_0800508c();
            iVar15 = FUN_080119e0(DAT_080091c8,2);
            if (iVar15 == 1) {
              if (*pcVar8 != '\0') {
                if (*DAT_080091dc == '\0' && (*DAT_080091c4 & 0xc) == 0) {
                  *DAT_080091c4 = 4;
                  DAT_080091b8[1] = -1;
                }
                *pcVar8 = '\0';
                FUN_08007ae4(2,0x73);
                *DAT_080091e4 = ~*DAT_080091e0;
                *(undefined1 *)(DAT_080091d4 + 1) = 1;
                if ((*(byte *)(piVar4 + 0x26) & 0x10) != 0) {
                  FUN_08007a0c(DAT_080091b0);
                }
                FUN_0800508c();
              }
            }
            else if (*pcVar8 == '\0') {
              *pcVar8 = -1;
              FUN_08007ae4(2,0x13);
              *DAT_080091c0 = 0;
              iVar15 = DAT_080091d4;
              if (*(char *)(DAT_080091d4 + 1) != '\0') {
                DAT_080091d8[1] = DAT_080091d8[1] | 2;
              }
              *(undefined1 *)(iVar15 + 1) = 0;
            }
          }
        }
        else {
          *(undefined1 *)(piVar4 + 1) = 0;
          FUN_08004db4(DAT_080091cc);
          *piVar4 = *piVar7;
          (**(code **)(*(int *)(iVar13 + 0x2d4) + 8))(*(int *)(iVar13 + 0x2d0) + 0x3cd8,0x1e00,4);
          pcVar8 = DAT_080091d0;
          *(undefined1 *)((int)piVar4 + 5) = 0;
          pcVar8[1] = '\x01';
        }
        piVar4[2] = *piVar7;
      }
    }
LAB_08009006:
    piVar7 = DAT_080091a8;
    piVar4[0x28] = *DAT_080091a8;
    pcVar8 = DAT_080091d0;
    uVar3 = DAT_080091c8;
    cVar1 = *(char *)(iVar13 + 0x29c);
    while (cVar1 == '\x04') {
      do {
        FUN_08018a38(5);
        if (*(int *)(DAT_080091e8 + 0x20) == 0) goto LAB_0800918c;
        FUN_080119f8(uVar3,0x200,0);
        if ((uint)piVar4[0x29] < (uint)(*piVar7 - piVar4[0x28])) {
          if (pcVar8[1] != '\0') {
            FUN_08007ae4(0x30,0x7060);
            FUN_08007ae4(2,0);
            pcVar8[1] = '\0';
          }
          FUN_08018b78(piVar4[0x25],0x20);
          pcVar8[1] = '\x02';
          FUN_080119f8(uVar3,0x100,0);
          FUN_0800208c(0xfa);
          FUN_080119f8(uVar3,0x100);
          piVar4[0x26] = piVar4[0x26] & 0xfffffff7;
          FUN_08018a38(5);
          uVar5 = DAT_080091ec;
          FUN_080119f8(DAT_080091ec,0x200);
          FUN_080119f8(uVar5,8,0);
          FUN_08008078();
          *(undefined1 *)(piVar4 + 0x27) = 1;
          *DAT_080091f0 = 0;
          do {
            FUN_08018a38(10);
          } while ((char)piVar4[0x27] == '\x01');
          *DAT_080091c4 = 0;
          piVar4[0x26] = piVar4[0x26] | 0x80;
          FUN_08018a38(200);
          piVar4[0x28] = *piVar7;
        }
      } while (*(char *)(iVar13 + 0x29c) == '\x04');
      if (pcVar8[1] != '\x02') break;
      FUN_080135f6(DAT_080091e8);
      uVar5 = DAT_080091ec;
      pcVar8[1] = '\0';
      FUN_080119f8(uVar5,0x200,0);
      FUN_08007fa4();
      FUN_08018a38(0x14);
      piVar4[0x26] = piVar4[0x26] | 8;
      FUN_080119f8(uVar5,8,1);
      *DAT_080091dc = -1;
      puVar12 = DAT_080091d8;
      *DAT_080091d8 = 0;
      puVar12[1] = 0;
      if ((*(byte *)(piVar4 + 0x26) & 0x10) != 0) {
        FUN_08002ce0();
      }
      iVar15 = *piVar7;
      *DAT_080091ac = iVar15;
      *DAT_080091f4 = iVar15;
      pcVar14 = DAT_080091b8;
      *DAT_080091b8 = '\x01';
      pcVar14[1] = -1;
      iVar15 = FUN_080119e0(uVar3,2);
      if ((iVar15 != 1) && (*(char *)(DAT_080091d4 + 1) == '\x01')) {
        *(undefined1 *)(DAT_080091d4 + 1) = 0;
      }
LAB_0800918c:
      cVar1 = *(char *)(iVar13 + 0x29c);
    }
  } while( true );
}


// ============================================================
// 0x08010A68  sz=434  FUN_08010a68
// ============================================================

/* WARNING: Removing unreachable block (ram,0x08010be6) */
/* WARNING: Restarted to delay deadcode elimination for space: stack */

undefined4 FUN_08010a68(uint *param_1,uint *param_2)

{
  int iVar1;
  uint uVar2;
  uint uVar3;
  bool bVar4;
  
  if ((char)param_1[0xf] != '\x01') {
    *(undefined1 *)(param_1 + 0xf) = 1;
    uVar2 = *param_2;
    uVar3 = *param_1;
    if (uVar2 < 10) {
      *(uint *)(uVar3 + 0x10) = *(uint *)(uVar3 + 0x10) & ~(7 << (uVar2 * 3 & 0xff));
      *(uint *)(*param_1 + 0x10) =
           param_2[2] << ((uint)(byte)*param_2 * 3 & 0xff) | *(uint *)(*param_1 + 0x10);
    }
    else {
      *(uint *)(uVar3 + 0xc) = *(uint *)(uVar3 + 0xc) & ~(7 << ((uVar2 - 10) * 3 & 0xff));
      *(uint *)(*param_1 + 0xc) =
           param_2[2] << (((byte)*param_2 - 10) * 3 & 0xff) | *(uint *)(*param_1 + 0xc);
    }
    uVar2 = param_2[1];
    if (uVar2 < 7) {
      *(uint *)(*param_1 + 0x34) = *(uint *)(*param_1 + 0x34) & ~(0x1f << ((uVar2 - 1) * 5 & 0xff));
      *(uint *)(*param_1 + 0x34) =
           (uint)(ushort)*param_2 << (((byte)param_2[1] - 1) * 5 & 0xff) |
           *(uint *)(*param_1 + 0x34);
    }
    else {
      uVar3 = *param_1;
      if (uVar2 < 0xd) {
        *(uint *)(uVar3 + 0x30) = *(uint *)(uVar3 + 0x30) & ~(0x1f << ((uVar2 - 7) * 5 & 0xff));
        *(uint *)(*param_1 + 0x30) =
             (uint)(ushort)*param_2 << (((byte)param_2[1] - 7) * 5 & 0xff) |
             *(uint *)(*param_1 + 0x30);
      }
      else {
        *(uint *)(uVar3 + 0x2c) = *(uint *)(uVar3 + 0x2c) & ~(0x1f << ((uVar2 - 0xd) * 5 & 0xff));
        *(uint *)(*param_1 + 0x2c) =
             (uint)(ushort)*param_2 << (((byte)param_2[1] - 0xd) * 5 & 0xff) |
             *(uint *)(*param_1 + 0x2c);
      }
    }
    uVar3 = DAT_08010c20;
    iVar1 = DAT_08010c1c;
    uVar2 = *param_1;
    bVar4 = uVar2 == DAT_08010c20;
    if (bVar4) {
      uVar2 = *param_2;
    }
    if (bVar4 && uVar2 == 0x12) {
      *(uint *)(DAT_08010c1c + 4) = *(uint *)(DAT_08010c1c + 4) & 0xff7fffff;
      *(uint *)(iVar1 + 4) = *(uint *)(iVar1 + 4) | 0x400000;
    }
    uVar2 = DAT_08010c24;
    if ((*param_1 == uVar3) && (*param_2 == DAT_08010c24 || *param_2 == 0x11)) {
      *(uint *)(iVar1 + 4) = *(uint *)(iVar1 + 4) & 0xffbfffff;
      *(uint *)(iVar1 + 4) = *(uint *)(iVar1 + 4) | 0x800000;
      if ((*param_2 == uVar2) && (uVar2 = (*DAT_08010c28 / DAT_08010c2c) * 10, uVar2 != 0)) {
        if (uVar2 < 0x80000000) {
          iVar1 = 1;
          if (1 < (int)(uVar2 + 1)) {
            do {
              iVar1 = iVar1 + 2;
            } while (iVar1 < (int)(uVar2 + 1));
          }
        }
        else {
          do {
            uVar2 = uVar2 - 1;
          } while (uVar2 != 0);
        }
      }
    }
    *(undefined1 *)(param_1 + 0xf) = 0;
    return 0;
  }
  return 2;
}


// ============================================================
// 0x08010C34  sz=360  FUN_08010c34
// ============================================================

bool FUN_08010c34(int *param_1)

{
  int iVar1;
  int iVar2;
  uint uVar3;
  bool bVar4;
  
  if (param_1 != (int *)0x0) {
    if (param_1[0x10] == 0) {
      FUN_080030a8(param_1);
      param_1[0x11] = 0;
      *(undefined1 *)(param_1 + 0xf) = 0;
    }
    bVar4 = (param_1[0x10] & 0x10U) == 0;
    if (bVar4) {
      param_1[0x10] = param_1[0x10] & 0xffffeeffU | 2;
      iVar1 = DAT_08010d9c;
      *(uint *)(DAT_08010d9c + 4) = *(uint *)(DAT_08010d9c + 4) & 0xfffcffff;
      *(uint *)(iVar1 + 4) = *(uint *)(iVar1 + 4) | param_1[1];
      *(uint *)(*param_1 + 4) = *(uint *)(*param_1 + 4) & 0xfffffeff;
      *(uint *)(*param_1 + 4) = *(uint *)(*param_1 + 4) | param_1[4] << 8;
      *(uint *)(*param_1 + 4) = *(uint *)(*param_1 + 4) & 0xfcffffff;
      *(uint *)(*param_1 + 4) = *(uint *)(*param_1 + 4) | param_1[2];
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) & 0xfffff7ff;
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) | param_1[3];
      iVar1 = param_1[10];
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) & 0xf0ffffff;
      iVar2 = *param_1;
      if (iVar1 == 0xf000001) {
        uVar3 = *(uint *)(iVar2 + 8) & 0xcfffffff;
      }
      else {
        *(uint *)(iVar2 + 8) = *(uint *)(iVar2 + 8) | param_1[10];
        *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) & 0xcfffffff;
        iVar2 = *param_1;
        uVar3 = *(uint *)(iVar2 + 8) | param_1[0xb];
      }
      *(uint *)(iVar2 + 8) = uVar3;
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) & 0xfffffffd;
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) | (uint)*(byte *)(param_1 + 6) << 1;
      iVar1 = *param_1;
      if ((char)param_1[8] == '\0') {
        uVar3 = *(uint *)(iVar1 + 4) & 0xfffff7ff;
      }
      else {
        *(uint *)(iVar1 + 4) = *(uint *)(iVar1 + 4) | 0x800;
        *(uint *)(*param_1 + 4) = *(uint *)(*param_1 + 4) & 0xffff1fff;
        iVar1 = *param_1;
        uVar3 = *(uint *)(iVar1 + 4) | DAT_08010da0 + param_1[9] * 0x2000;
      }
      *(uint *)(iVar1 + 4) = uVar3;
      *(uint *)(*param_1 + 0x2c) = *(uint *)(*param_1 + 0x2c) & 0xff0fffff;
      *(uint *)(*param_1 + 0x2c) =
           *(uint *)(*param_1 + 0x2c) | DAT_08010da4 + (uint)*(ushort *)(param_1 + 7) * 0x100000;
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) & 0xfffffdff;
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) | (uint)*(byte *)(param_1 + 0xc) << 9;
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) & 0xfffffbff;
      *(uint *)(*param_1 + 8) = *(uint *)(*param_1 + 8) | param_1[5] << 10;
      param_1[0x11] = 0;
      param_1[0x10] = param_1[0x10] & 0xfffffffdU | 1;
    }
    *(undefined1 *)(param_1 + 0xf) = 0;
    return !bVar4;
  }
  return true;
}


// ============================================================
// 0x08006BB8  sz=42  FUN_08006bb8
// ============================================================

undefined4 FUN_08006bb8(int param_1,undefined4 param_2,undefined4 param_3,undefined4 param_4)

{
  int iVar1;
  
  iVar1 = FUN_0801349a(*(undefined4 *)(param_1 + 0x2d8),param_2,param_4,param_3);
  if (iVar1 == 0) {
    return 0;
  }
  if ((iVar1 != 1) && (iVar1 == 2)) {
    return 1;
  }
  return 3;
}


// ============================================================
// 0x08006D6A  sz=36  FUN_08006d6a
// ============================================================

undefined4 FUN_08006d6a(int param_1)

{
  int iVar1;
  
  iVar1 = FUN_08013542(*(undefined4 *)(param_1 + 0x2d8));
  if (iVar1 == 0) {
    return 0;
  }
  if ((iVar1 != 1) && (iVar1 == 2)) {
    return 1;
  }
  return 3;
}


// ============================================================
// 0x08006838  sz=36  FUN_08006838
// ============================================================

undefined4 FUN_08006838(int param_1)

{
  int iVar1;
  
  iVar1 = FUN_080133ee(*(undefined4 *)(param_1 + 0x2d8));
  if (iVar1 == 0) {
    return 0;
  }
  if ((iVar1 != 1) && (iVar1 == 2)) {
    return 1;
  }
  return 3;
}


// ============================================================
// 0x0801525E  sz=534  FUN_0801525e
// ============================================================

undefined4 FUN_0801525e(int *param_1,int param_2,int param_3,int param_4,uint param_5)

{
  short sVar1;
  char cVar2;
  undefined2 uVar3;
  bool bVar4;
  int iVar5;
  uint *puVar6;
  int iVar7;
  uint uVar8;
  undefined4 uVar9;
  bool bVar10;
  
  bVar4 = true;
  uVar9 = 0;
  if ((char)param_1[0x14] == '\x01') {
    return 2;
  }
  *(undefined1 *)(param_1 + 0x14) = 1;
  iVar5 = FUN_08003200();
  cVar2 = *(char *)((int)param_1 + 0x51);
  iVar7 = param_1[1];
  if (cVar2 != '\x01') {
    bVar10 = iVar7 == 0x104;
    if (bVar10) {
      iVar7 = param_1[2];
    }
    if ((!bVar10 || iVar7 != 0) || cVar2 != '\x04') {
      uVar9 = 2;
    }
    if ((!bVar10 || iVar7 != 0) || cVar2 != '\x04') goto LAB_0801545e;
  }
  if ((param_2 == 0 || param_3 == 0) || param_4 == 0) {
    uVar9 = 1;
  }
  if ((param_2 != 0 && param_3 != 0) && param_4 != 0) {
    if (*(char *)((int)param_1 + 0x51) != '\x04') {
      *(undefined1 *)((int)param_1 + 0x51) = 5;
    }
    param_1[0x15] = 0;
    param_1[0xe] = param_3;
    uVar3 = (undefined2)param_4;
    *(undefined2 *)((int)param_1 + 0x3e) = uVar3;
    *(undefined2 *)(param_1 + 0xf) = uVar3;
    param_1[0xc] = param_2;
    *(undefined2 *)((int)param_1 + 0x36) = uVar3;
    *(undefined2 *)(param_1 + 0xd) = uVar3;
    param_1[0x10] = 0;
    param_1[0x11] = 0;
    puVar6 = (uint *)*param_1;
    if ((*puVar6 & 0x40) == 0) {
      *puVar6 = *puVar6 | 0x40;
    }
    if (param_1[3] == 0x800) {
      if (param_1[1] == 0 || param_4 == 1) {
        *(uint *)(*param_1 + 0xc) = (uint)*(ushort *)param_1[0xc];
        param_1[0xc] = param_1[0xc] + 2;
        *(short *)((int)param_1 + 0x36) = *(short *)((int)param_1 + 0x36) + -1;
      }
      do {
        sVar1 = *(short *)((int)param_1 + 0x36);
        bVar10 = sVar1 == 0;
        if (bVar10) {
          sVar1 = *(short *)((int)param_1 + 0x3e);
        }
        if (bVar10 && sVar1 == 0) goto LAB_080153a2;
        uVar8 = *(uint *)(*param_1 + 8);
        bVar10 = (uVar8 & 2) != 0;
        if (bVar10) {
          uVar8 = (uint)*(ushort *)((int)param_1 + 0x36);
        }
        if ((bVar10 && uVar8 != 0) && (bVar4)) {
          *(uint *)(*param_1 + 0xc) = (uint)*(ushort *)param_1[0xc];
          param_1[0xc] = param_1[0xc] + 2;
          *(short *)((int)param_1 + 0x36) = *(short *)((int)param_1 + 0x36) + -1;
          bVar4 = false;
        }
        uVar8 = *(uint *)(*param_1 + 8);
        bVar10 = (uVar8 & 1) != 0;
        if (bVar10) {
          uVar8 = (uint)*(ushort *)((int)param_1 + 0x3e);
        }
        if (bVar10 && uVar8 != 0) {
          *(short *)param_1[0xe] = (short)*(undefined4 *)(*param_1 + 0xc);
          param_1[0xe] = param_1[0xe] + 2;
          *(short *)((int)param_1 + 0x3e) = *(short *)((int)param_1 + 0x3e) + -1;
          bVar4 = true;
        }
        iVar7 = FUN_08003200();
      } while (((uint)(iVar7 - iVar5) < param_5) || (param_5 == 0xffffffff));
    }
    else {
      if (param_1[1] == 0 || param_4 == 1) {
        *(undefined1 *)(*param_1 + 0xc) = *(undefined1 *)param_1[0xc];
        param_1[0xc] = param_1[0xc] + 1;
        *(short *)((int)param_1 + 0x36) = *(short *)((int)param_1 + 0x36) + -1;
      }
      do {
        while( true ) {
          sVar1 = *(short *)((int)param_1 + 0x36);
          bVar10 = sVar1 == 0;
          if (bVar10) {
            sVar1 = *(short *)((int)param_1 + 0x3e);
          }
          if (bVar10 && sVar1 == 0) goto LAB_080153a2;
          uVar8 = *(uint *)(*param_1 + 8);
          bVar10 = (uVar8 & 2) != 0;
          if (bVar10) {
            uVar8 = (uint)*(ushort *)((int)param_1 + 0x36);
          }
          if ((bVar10 && uVar8 != 0) && (bVar4)) {
            *(undefined1 *)(*param_1 + 0xc) = *(undefined1 *)param_1[0xc];
            param_1[0xc] = param_1[0xc] + 1;
            *(short *)((int)param_1 + 0x36) = *(short *)((int)param_1 + 0x36) + -1;
            bVar4 = false;
          }
          uVar8 = *(uint *)(*param_1 + 8);
          bVar10 = (uVar8 & 1) != 0;
          if (bVar10) {
            uVar8 = (uint)*(ushort *)((int)param_1 + 0x3e);
          }
          if (bVar10 && uVar8 != 0) {
            *(char *)param_1[0xe] = (char)*(undefined4 *)(*param_1 + 0xc);
            param_1[0xe] = param_1[0xe] + 1;
            *(short *)((int)param_1 + 0x3e) = *(short *)((int)param_1 + 0x3e) + -1;
            bVar4 = true;
          }
          iVar7 = FUN_08003200();
          if ((uint)(iVar7 - iVar5) < param_5) break;
          if (param_5 != 0xffffffff) goto LAB_0801544c;
        }
      } while (param_5 != 0);
    }
LAB_0801544c:
    uVar9 = 3;
  }
LAB_0801545e:
  *(undefined1 *)((int)param_1 + 0x51) = 1;
  *(undefined1 *)(param_1 + 0x14) = 0;
  return uVar9;
LAB_080153a2:
  iVar7 = FUN_08015934(param_1,param_5,iVar5);
  if (iVar7 != 0) {
    uVar9 = 1;
    param_1[0x15] = 0x20;
  }
  goto LAB_0801545e;
}


// ============================================================
// 0x08015040  sz=128  FUN_08015040
// ============================================================

undefined4 FUN_08015040(int *param_1)

{
  if (param_1 != (int *)0x0) {
    param_1[10] = 0;
    if (*(char *)((int)param_1 + 0x51) == '\0') {
      *(undefined1 *)(param_1 + 0x14) = 0;
      FUN_0800378c(param_1);
    }
    *(undefined1 *)((int)param_1 + 0x51) = 2;
    *(uint *)*param_1 = *(uint *)*param_1 & 0xffffffbf;
    *(uint *)*param_1 =
         param_1[1] | param_1[2] | param_1[3] | param_1[4] | param_1[5] |
         *(ushort *)(param_1 + 6) & 0x200 | param_1[7] | param_1[8] | param_1[10];
    *(uint *)(*param_1 + 4) = (uint)param_1[6] >> 0x10 & 4 | param_1[9];
    *(uint *)(*param_1 + 0x1c) = *(uint *)(*param_1 + 0x1c) & 0xfffff7ff;
    param_1[0x15] = 0;
    *(undefined1 *)((int)param_1 + 0x51) = 1;
    return 0;
  }
  return 1;
}


// ============================================================
// 0x08012334  sz=128  FUN_08012334
// ============================================================

undefined4 FUN_08012334(int *param_1)

{
  int iVar1;
  
  iVar1 = *param_1;
  if (*(char *)((int)param_1 + 0x2b9) == '\0') {
    *(undefined1 *)(param_1 + 0xae) = 0;
    FUN_08003258(param_1);
  }
  *(undefined1 *)((int)param_1 + 0x2b9) = 3;
  if ((*(uint *)(iVar1 + 0x3c) & 0x100) == 0) {
    param_1[4] = 0;
  }
  FUN_08017b64(*param_1);
  FUN_080177c0(*param_1,param_1[1],param_1[2],param_1[3],param_1[4],param_1[5],param_1[6],param_1[7]
               ,param_1[8],param_1[9],param_1[10],param_1[0xb],param_1[0xc],param_1[0xd]);
  FUN_0801867a(*param_1,1);
  FUN_08018464(*param_1,param_1[1],param_1[2],param_1[3],param_1[4],param_1[5],param_1[6],param_1[7]
               ,param_1[8],param_1[9],param_1[10],param_1[0xb],param_1[0xc],param_1[0xd]);
  *(undefined1 *)((int)param_1 + 0x2b9) = 1;
  return 0;
}


// ============================================================
// 0x0800881C  sz=262  FUN_0800881c
// ============================================================

void FUN_0800881c(void)

{
  int iVar1;
  undefined4 *puVar2;
  ushort uVar3;
  int iVar4;
  byte *pbVar5;
  uint uVar6;
  int iVar7;
  int iVar8;
  
  FUN_0801055a(DAT_08008924,0x100);
  iVar1 = DAT_08008924;
  FUN_0801055a(DAT_08008924 + 0x100,0x100);
  *DAT_08008928 = 0;
  uVar6 = 0;
  iVar4 = iVar1 + 0x200;
  do {
    *(undefined1 *)(iVar4 + uVar6) = 0;
    *(undefined1 *)(iVar4 + uVar6 + 1) = 0;
    uVar6 = uVar6 + 2 & 0xffff;
  } while (uVar6 < 0x20);
  uVar6 = 0;
  do {
    *(undefined1 *)(iVar4 + uVar6 + 0x20) = 0;
    *(undefined1 *)(iVar4 + uVar6 + 0x21) = 0;
    iVar8 = DAT_08008934;
    puVar2 = DAT_08008930;
    uVar6 = uVar6 + 2 & 0xffff;
  } while (uVar6 < 0x20);
  *DAT_08008930 = DAT_0800892c;
  puVar2[1] = iVar8;
  uVar6 = 0;
  do {
    uVar3 = 0;
    iVar4 = iVar1 + uVar6 * 0x100;
    do {
      pbVar5 = (byte *)puVar2[uVar6];
      if (*pbVar5 == 0xff) break;
      iVar7 = (uint)pbVar5[1] + (uint)*pbVar5 * 0x100;
      *(byte *)(iVar4 + iVar7) = pbVar5[2];
      iVar7 = iVar7 + iVar4;
      *(byte *)(iVar7 + 1) = pbVar5[3];
      *(byte *)(iVar7 + 2) = pbVar5[4];
      *(byte *)(iVar7 + 3) = pbVar5[5];
      *(byte *)(iVar7 + 4) = pbVar5[6];
      *(byte *)(iVar7 + 5) = pbVar5[7];
      puVar2[uVar6] = pbVar5 + 8;
      uVar3 = uVar3 + 8;
    } while (uVar3 < 0x2000);
    uVar6 = uVar6 + 1 & 0xffff;
    if (1 < uVar6) {
      if (puVar2[1] == iVar8) {
        *(uint *)(DAT_08008938 + 0x98) = *(uint *)(DAT_08008938 + 0x98) | 0x40;
      }
      iVar4 = DAT_08008940;
      iVar1 = DAT_0800893c;
      iVar8 = 0;
      do {
        iVar7 = *(int *)(DAT_0800893c + iVar8 * 8);
        if (iVar7 == DAT_08008940) {
          if (*(int *)(DAT_0800893c + iVar8 * 8 + 8) == -1) {
            return;
          }
        }
        else if (iVar7 == -1) {
          FUN_08011628();
          FUN_08011560(2,iVar1 + iVar8 * 8,iVar4,0);
          FUN_0801154c();
          return;
        }
        iVar8 = iVar8 + 1;
      } while (iVar8 < 4);
      return;
    }
  } while( true );
}

