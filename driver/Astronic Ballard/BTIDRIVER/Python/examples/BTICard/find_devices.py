#
# BTICard DRIVER EXAMPLE 1  (08/27/2025)
# Copyright 2009-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
#
# NAME: find_devices.py -- Report BTIDriver devices
#

#
# This example uses a special feature of the BTICard_CardOpen(...)
# function to search the computer for registered Ballard BTIDriver
# devices. The program loops through the array of discovered
# devices and outputs some generic card information.
#

from btidriver import bticard, bti1553, bti429, DriverError, DeviceHandle

CARDNUM = 0
MAX_CORES = 4
MAX_CHANNELS = 32
MAX_CARDS = 32

def main():
    hcards = list[DeviceHandle]()
    errval = 0
    corenum = 0
    channum = 0

    print("    **********************************************************************")
    print("    *                                                                    *")
    print("    *  EXAMP1  (08/27/2025)                                              *")
    print("    *  Copyright 2009-2025  Astronics Advanced Electronic Systems Corp.  *")
    print("    *  Kirkland WA USA                                                   *")
    print("    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    print("    *                                                                    *")
    print("    *  BTICard Example 1                                                 *")
    print("    *  'Report BTIDriver Devices'                                        *")
    print("    *                                                                    *")
    print("    **********************************************************************")

#
# Open a bogus card number to populate internal card count and card number array.
# The try-except block is used to catch the exception reported by using a 
# bad card number. 
#
    

    try: 
        _ = bticard.CardOpen(0xFFFF)
    except DriverError:
        pass # Error is expected, so pass

#
# Get the HandleCardNumber and HandleTotalCount to use the internal array. 
# Since HandleCardNumber is an array of UINT32, we need to access it using the
# the uint32_buffer object.  
#

    HandleCardNumbers = bticard.uint32_buffer.frompointer(bticard.cvar.HandleCardNumbers)
    HandleTotalCount = bticard.cvar.HandleTotalCount

#
# Open each card number in the card number array and test for exception
#

    handle = 0
    for i in range(HandleTotalCount):
        if len(hcards) >= MAX_CARDS:
            break
            
        cardnum = HandleCardNumbers[i]
        try:
            handle = bticard.CardOpen(cardnum)   
        except DriverError as e:
            print(f"Error:  Either card number {cardnum} is not present, or")
            print(f"        an error occurred ({e.code}) opening the card.",errval)
            print(f"        ({str(e)})")
            continue
        
        hcards.append(handle)
        
        print(f"\nOpening card #{cardnum} ({bticard.CardTypeStr(hcards[-1])},{bticard.CardProductStr(hcards[-1])},S/N {bticard.CardGetInfo(bticard.INFOTYPE_SERIALNUM,0,hcards[-1]):04d})")

#
# Loop through each core on the card
# Report all protocols found
#
    
        for corenum in range(MAX_CORES):
            try:
                hcore = bticard.CoreOpen(corenum, hcards[-1])
            except DriverError:
                continue
            
            for channum in range(MAX_CHANNELS):
                if bti1553.ChIs1553(channum, hcore):
                    print(f"On card #{cardnum}, core #{corenum}, found 1553 channel #{channum}")
                elif bti429.ChIs429(channum, hcore):
                    print(f"On card #{cardnum}, core #{corenum}, found 429  channel #{channum}")
        
    for card in hcards:
        bticard.CardClose(card)
    
if __name__ == "__main__":
    main()