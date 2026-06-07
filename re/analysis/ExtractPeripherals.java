// Extrait les fonctions qui accèdent aux périphériques ADC/I2C/DMA, et les décompile
// @category TCA_RE
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import ghidra.program.model.address.*;
import ghidra.program.model.mem.*;
import java.util.*;

public class ExtractPeripherals extends GhidraScript {

    static final long[] PERIPH_BASES = {
        0x40012000L, // ADC1
        0x40012100L, // ADC2
        0x40012200L, // ADC3
        0x40012300L, // ADC_Common
        0x40005400L, // I2C1
        0x40005800L, // I2C2
        0x40026400L, // DMA2
        0x40026000L, // DMA1
    };
    static final String[] PERIPH_NAMES = {"ADC1","ADC2","ADC3","ADC_Common","I2C1","I2C2","DMA2","DMA1"};

    @Override
    public void run() throws Exception {
        FunctionManager fm = currentProgram.getFunctionManager();
        Memory mem = currentProgram.getMemory();
        ReferenceManager rm = currentProgram.getReferenceManager();

        // === Find functions referencing each peripheral base ===
        // Strategy: search flash for the 4-byte LE value of each base,
        // then follow Ghidra's data references TO those addresses
        Map<String, Set<Function>> periphFuncs = new LinkedHashMap<>();
        for (String pn : PERIPH_NAMES) {
            periphFuncs.put(pn, new TreeSet<>(Comparator.comparingLong(f -> f.getEntryPoint().getOffset())));
        }

        for (int p = 0; p < PERIPH_BASES.length; p++) {
            long base = PERIPH_BASES[p];
            String pname = PERIPH_NAMES[p];
            byte[] pattern = new byte[]{
                (byte)(base & 0xFF),
                (byte)((base >> 8) & 0xFF),
                (byte)((base >> 16) & 0xFF),
                (byte)((base >> 24) & 0xFF)
            };
            Address searchAt = mem.getMinAddress();
            int poolCount = 0;
            while (searchAt != null) {
                Address found = mem.findBytes(searchAt, pattern, null, true, monitor);
                if (found == null) break;
                poolCount++;
                // Walk all references TO this pool address
                ReferenceIterator refs = rm.getReferencesTo(found);
                while (refs.hasNext()) {
                    Reference ref = refs.next();
                    Function fn = fm.getFunctionContaining(ref.getFromAddress());
                    if (fn != null) periphFuncs.get(pname).add(fn);
                }
                try { searchAt = found.add(1); } catch (Exception e) { break; }
            }
            if (poolCount > 0) {
                println(pname + " (0x" + Long.toHexString(base) + "): "
                        + poolCount + " pool entries, " + periphFuncs.get(pname).size() + " functions");
            }
        }

        println("\n=== DETAIL PER PERIPHERAL ===");
        for (Map.Entry<String, Set<Function>> e : periphFuncs.entrySet()) {
            if (!e.getValue().isEmpty()) {
                println("\n" + e.getKey() + " (" + e.getValue().size() + " fns):");
                for (Function fn : e.getValue()) {
                    println(String.format("  0x%08X  sz=%-5d  %s",
                            fn.getEntryPoint().getOffset(),
                            fn.getBody().getNumAddresses(),
                            fn.getName()));
                }
            }
        }

        // === Decompile targeted functions (I2C driver candidates + key inits) ===
        Set<Function> toDecompile = new LinkedHashSet<>();
        // ADC + I2C peripheral functions found above
        for (String p : new String[]{"ADC1","ADC2","ADC3","ADC_Common","I2C1","I2C2"}) {
            toDecompile.addAll(periphFuncs.get(p));
        }
        // Add specific addresses of interest (I2C driver candidates, main EV handler, large USB/I2C inits)
        long[] extra = {
            0x08006BB8L, // r1=0x80 candidate -> HAL_I2C?
            0x08006D6AL, // r1=0x80 candidate
            0x08006838L, // r1=0x82/0x84 candidate
            0x0801525EL, // called from early init with r1=ptr
            0x08015040L, // called from main init x2
            0x08012334L, // near I2C1_EV handler - HAL_I2C_Init?
            0x0800881CL, // called from main init
            0x08003A08L, // early init function (calls GPIO+?)
        };
        for (long ep : extra) {
            Function fn = fm.getFunctionAt(currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(String.format("0x%08X", ep)));
            if (fn != null) toDecompile.add(fn);
        }

        if (toDecompile.isEmpty()) {
            println("\n[!] No peripheral functions found via references — trying raw byte scan for movw/movt patterns");
            // Fallback: scan for MOVW 0x2000 (lower half of 0x40012000) near MOVT 0x4001
            // This catches cases where Ghidra didn't create references
            // Just list the largest non-trivial functions in the HAL range for manual inspection
            List<Function> candidates = new ArrayList<>();
            FunctionIterator it = fm.getFunctions(true);
            while (it.hasNext()) {
                Function fn = it.next();
                long ep = fn.getEntryPoint().getOffset();
                int sz = (int)fn.getBody().getNumAddresses();
                if (ep >= 0x08010000L && sz >= 50) candidates.add(fn);
            }
            candidates.sort((a, b) -> (int)(b.getBody().getNumAddresses() - a.getBody().getNumAddresses()));
            println("Top 20 largest app functions (>= 50 bytes):");
            for (int i = 0; i < Math.min(20, candidates.size()); i++) {
                Function fn = candidates.get(i);
                println(String.format("  0x%08X  sz=%-5d  %s",
                        fn.getEntryPoint().getOffset(),
                        fn.getBody().getNumAddresses(), fn.getName()));
            }
            // Decompile the top 10
            toDecompile.addAll(candidates.subList(0, Math.min(10, candidates.size())));
        }

        String outPath = "C:/Users/Sam/TCA-Sidestick-X-Reverse/analysis/decompiled_periph.c";
        println("\n=== Writing decompiled output to " + outPath + " ===");
        java.io.PrintWriter pw = new java.io.PrintWriter(new java.io.FileWriter(outPath));

        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);
        decomp.setSimplificationStyle("decompile");
        for (Function fn : toDecompile) {
            String header = String.format("\n// ============================================================\n// 0x%08X  sz=%d  %s\n// ============================================================\n",
                    fn.getEntryPoint().getOffset(),
                    fn.getBody().getNumAddresses(), fn.getName());
            pw.print(header);
            println("Decompiling " + fn.getName() + " @ 0x" + Long.toHexString(fn.getEntryPoint().getOffset()));
            DecompileResults res = decomp.decompileFunction(fn, 60, monitor);
            if (res.decompileCompleted()) {
                pw.print(res.getDecompiledFunction().getC());
            } else {
                pw.println("// FAILED: " + res.getErrorMessage());
            }
        }
        decomp.dispose();
        pw.close();
        println("Done. " + toDecompile.size() + " functions written.");
    }
}
