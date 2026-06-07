## @category TCA_RE
## @description Extract function list, FunctionID matches, peripheral xrefs
# Ghidra headless Jython post-script
# Extracts: all functions + named matches + xrefs to ADC/I2C/DMA bases

from ghidra.program.model.symbol import RefType

fm = currentProgram.getFunctionManager()
af = currentProgram.getAddressFactory()

funcs = list(fm.getFunctions(True))
named = [(f, f.getName()) for f in funcs if not f.getName().startswith("FUN_") and not f.getName().startswith("LAB_") and not f.isThunk()]

print("=== FUNCTION COUNT: " + str(len(funcs)) + " ===")
print("=== NAMED FUNCTIONS (FunctionID / symbol): " + str(len(named)) + " ===")
for f, n in sorted(named, key=lambda x: x[0].getEntryPoint().getOffset()):
    ep = f.getEntryPoint()
    print("  0x{:08X}  {}".format(ep.getOffset(), n))

print()
print("=== ALL FUNCTIONS (sorted by address) ===")
for f in sorted(funcs, key=lambda x: x.getEntryPoint().getOffset()):
    ep = f.getEntryPoint()
    size = f.getBody().getNumAddresses()
    name = f.getName()
    sig = "*" if not name.startswith("FUN_") else " "
    print("{}0x{:08X}  sz={:5d}  {}".format(sig, ep.getOffset(), size, name))

# Cross-references to key peripheral addresses
PERIPHERALS = {
    0x40012000: "ADC1",
    0x40012100: "ADC2",
    0x40012200: "ADC3",
    0x40005400: "I2C1",
    0x40005800: "I2C2",
    0x40026400: "DMA2",
    0x40026000: "DMA1",
    0x40040000: "USB_OTG_HS",
    0x50000000: "USB_OTG_FS",
}

print()
print("=== XREFS TO PERIPHERAL BASES ===")
refMgr = currentProgram.getReferenceManager()
for base, name in sorted(PERIPHERALS.items()):
    try:
        addr = af.getDefaultAddressSpace().getAddress("0x{:08X}".format(base))
        refs = list(refMgr.getReferencesTo(addr))
        if refs:
            print("{} (0x{:08X}): {} refs".format(name, base, len(refs)))
            for r in sorted(refs, key=lambda x: x.getFromAddress().getOffset())[:10]:
                fromAddr = r.getFromAddress().getOffset()
                fn = fm.getFunctionContaining(r.getFromAddress())
                fnName = fn.getName() if fn else "?"
                print("    0x{:08X}  in {}".format(fromAddr, fnName))
    except Exception as e:
        print("{}: error - {}".format(name, str(e)))
