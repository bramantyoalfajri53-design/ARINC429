# 
# BTI1553 DRIVER EXAMPLE 1  (08/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
# 
# NAME: bc_xmit_once.py -- Simulating the BC - Unscheduled Messages
# 

# 
# This program opens the given card number (default: 0), and configures it
# as a BC to transmit the receive command 0843H with data words 1234H, 5678H,
# and 9ABCH.  If the message is completed successfully, it
# displays the responding RT's status word.  Otherwise it
# displays the value of any errors.
# 


import argparse
import sys
from btidriver import bticard, bti1553, DriverError, DeviceHandle

MAX_CORES = 4
MAX_CHANNELS = 32

# argument parser
parser = argparse.ArgumentParser(description="BTI1553 Example")
parser.add_argument("--cardnum", type=int, default=0, help="Card Number (default: 0)")
args = parser.parse_args()
cardnum = args.cardnum

def main():
    hCard = DeviceHandle(0)
    hCore = DeviceHandle(0)
    err = False
    corenum = 0
    channum = 0

    print(f"    **********************************************************************")
    print(f"    *                                                                    *")
    print(f"    *  EXAMP1  (08/27/2025)                                              *")
    print(f"    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *")
    print(f"    *  Kirkland WA USA                                                   *")
    print(f"    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    print(f"    *                                                                    *")
    print(f"    *  BTI1553 Example 1                                                 *")
    print(f"    *  'Simulating the BC - Unscheduled Message'                         *")
    print(f"    *                                                                    *")
    print(f"    **********************************************************************\n")

# 
# Open the card with the specified card number.
# If a Driver exception is thrown, the except block
# is used to handle it. 
# 

    try:
        hCard = bticard.CardOpen(cardnum)
    except DriverError as e:
        print(f"Error:  Either card number {cardnum} is not present, or")
        print(f"        an error occurred ({e.code}) opening the card.")
        print(f"        ({str(e)})", )
        sys.exit(1)

    print(f"Using BTI1553 card #{cardnum} ({bticard.CardTypeStr(hCard)},{bticard.CardProductStr(hCard)},S/N {bticard.CardGetInfo(bticard.INFOTYPE_SERIALNUM, 0, hCard):04d})")

#
# Find the first MIL-STD-1553 core and channel.
#

    chanfound = False
    for corenum in range(MAX_CORES):
        try:
            hCore = bticard.CoreOpen(corenum, hCard)
        except DriverError:
            break

        for channum in range(MAX_CHANNELS):
            if bti1553.ChIs1553(channum, hCore):
                chanfound = True
                break

        if chanfound:
            break

    if not chanfound:
        print(f"Error:  No MIL-STD-1553 channels present in cardnum {cardnum}.\n")
        bticard.CardClose(hCard)
        sys.exit(1)

    print(f"Using MIL-STD-1553 core #{corenum}")
    print(f"Using MIL-STD-1553 channel #{channum}\n")

#
# Configure the channel for bus controller mode.
#
    bticard.CardReset(hCore)

    try:
        bti1553.BCConfig(bti1553.BCCFG1553_DEFAULT, channum, hCore)
    except DriverError as e:
        print(f"Error:  An error was encountered ({e.code}) while configuring bus")
        print(f"        controller mode on channel #{channum} on core #{corenum}.")
        print(f"        ({str(e)})\n")
        bticard.CardClose(hCard)
        sys.exit(1)

#
# Create an empty frame in the BC Schedule.
#
# BTI1553_BCTransmitMsg uses an asynchronous Message Record
# that is transmitted at the end of every frame.  Therefore,
# even though we aren't scheduling messages, we must still
# schedule a frame.
#

    bti1553.BCSchedFrame(1000, channum, hCore)
    
#
# Start operation of the card.
#

    bticard.CardStart(hCore)

#
# Initialize the message command and data words, and select
# a BC-RT transfer. Then transmit the message.
#

    Msg = bti1553.XMITFIELDS1553()
    Msg.ctrlflags = bti1553.MSGCRT1553_BCRT
    Msg.cwd1 = bti1553.ValPackCWD(1, 0, 2, 3)
    Msg.data = [ 0x1234, 0x5678, 0x9ABC ]

#
# Test for any error results.
#
# Note the distinction between card errors and bus errors.
# A DriverError exception occuring in BTI1553_BCTransmitMsg is a card error
# (caught by the try-except). Errors related to the RT's response are
# returned in the (errflags) member of the message
# structure.
#

    try:
        bti1553.BCTransmitMsg(Msg, channum, hCore)
    except DriverError as e:
        print(f"Error:  An error was encountered ({e.code}) while transmitting")
        print(f"        the message on channel #{channum} on core #{corenum}.")
        print(f"        ({str(e)})\n")
        bticard.CardClose(hCard)
        sys.exit(1)

    if Msg.errflags & bti1553.MSGERR1553_NORESP:
        print("\nWarning:  No response was received from the RT.")
        print("\n          Refer to the documentation for a")
        print(f"\n          description of the error flags ({Msg.errflags:04X}H).")
        print("\n")
    elif Msg.errflags & bti1553.MSGERR1553_ANYERR:
        print("\nWarning:  An error occurred while receiving the response from the RT.")
        print("\n          Refer to the documentation for a")
        print(f"\n          description of the error flags ({Msg.errflags:04X}H).")
        print("\n")
    else:
        print("\nSuccess!  The message was completed successfully.")
        print(f"\n          The RT returned the status word {Msg.swd1:04X}H.")
        print("\n")
        
#
# Stop the card.
#

    bticard.CardStop(hCore)

#
# The card MUST be closed before exiting the program.
#

    bticard.CardClose(hCard)
    sys.exit(0)

if __name__ == "__main__":
    main()