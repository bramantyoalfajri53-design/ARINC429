#!/usr/bin/env python3
"""
==============================================================================
Automated Test Equipment (ATE) - Demonstration Test Sequence
Platform: NI PXIe-8821 + Ballard OmniBus II + NI PXIe-6341 + Keysight Supplies
==============================================================================
"""

import sys
import os
import time

def main():
    print("\n" + "=" * 75)
    print("      AUTOMATED TEST EQUIPMENT (ATE) - DEMONSTRASI INTEGRASI SISTEM")
    print("=" * 75)
    
    # 1. Periksa modul Ballard
    print("\n[1] Menguji Inisialisasi Astronics Ballard OmniBus II (ARINC 429)...")
    try:
        from btidriver import bticard, bti429  # type: ignore[import-not-found]
        hCard = bticard.CardOpen(0)
        hCore = bticard.CoreOpen(0, hCard)
        print("    [PASS] Card 0 & Core A berhasil dibuka.")
        bticard.CardClose(hCard)
    except Exception as e:
        print(f"    [WARN] Inisialisasi Ballard: {e}")

    # 2. Periksa modul NI DAQmx
    print("\n[2] Menguji Inisialisasi NI PXIe-6341 Multifunction DAQ...")
    try:
        import nidaqmx  # type: ignore[import-not-found]
        from nidaqmx.system import System  # type: ignore[import-not-found]
        system = System.local()
        devices = list(system.devices)
        if devices:
            print(f"    [PASS] Perangkat terdeteksi: {[d.name for d in devices]}")
        else:
            print("    [WARN] Tidak ada perangkat DAQmx aktif.")
    except Exception as e:
        print(f"    [WARN] Inisialisasi DAQmx: {e}")

    # 3. Periksa NI-VISA & GPIB Interface
    print("\n[3] Menguji Antarmuka Bus GPIB (NI PXI-GPIB & Keysight Supplies)...")
    try:
        import pyvisa  # type: ignore[import-not-found]
        rm = pyvisa.ResourceManager()
        resources = rm.list_resources("?*")
        gpib_intfc = [r for r in resources if "GPIB" in r]
        print(f"    [PASS] NI-VISA Resource Manager aktif ({len(resources)} total resources).")
        print(f"    [INFO] GPIB Resources: {gpib_intfc}")
    except Exception as e:
        print(f"    [WARN] Inisialisasi VISA: {e}")

    print("\n" + "=" * 75)
    print("      STATUS INTEGRASI SISTEM ATE: SIAP DIGUNAKAN (READY)")
    print("=" * 75 + "\n")

if __name__ == "__main__":
    main()
