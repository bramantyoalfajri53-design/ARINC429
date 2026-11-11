#
# BTI1553 DRIVER EXAMPLE 3  (08/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
#
# NAME: rt_rcv.py -- Simulating an RT
#

#
# This program opens the given card number (default: 0), and configures
# it as an RT to receive the BC-RT data transmitted by the bus controller in
# Example 2.
#
# It continuously receives and displays the data words.
#

import argparse
import sys
from btidriver import bticard, bti1553, DriverError, DeviceHandle
import curses

MAX_CORES = 4
MAX_CHANNELS = 32

# argument parser
parser = argparse.ArgumentParser(description="BTI1553 Example")
parser.add_argument("--cardnum", type=int, default=0, help="Card Number (default: 0)")
args = parser.parse_args()
cardnum = args.cardnum

def consoleentry(stdscr):
    curses.cbreak()
    stdscr.keypad(True)
    curses.noecho()
    curses.nonl()
    stdscr.timeout(0)
    stdscr.scrollok(True)

def consoleexit(stdscr, value, err = False):
    if(err):
        consoleprintf(stdscr, "\nPress any key to exit....")
        stdscr.nodelay(False)
        stdscr.getch()

    curses.nocbreak()
    stdscr.keypad(False)
    curses.echo()
    sys.exit(value)

def consoleprintf(stdscr, message, *args):
    stdscr.addstr(message % args)
    stdscr.refresh()



def main(stdscr):
    hCard = DeviceHandle(0)
    hCore = DeviceHandle(0)
    corenum = 0
    channum = 0
    RTMsg = 0
    Data = []
    ch = 0

    consoleentry(stdscr)

    consoleprintf(stdscr, "    **********************************************************************\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    *  EXAMP3  (08/27/2025)                                              *\n")
    consoleprintf(stdscr, "    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *\n")
    consoleprintf(stdscr, "    *  Kirkland WA USA                                                   *\n")
    consoleprintf(stdscr, "    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    *  BTI1553 Example 3                                                 *\n")
    consoleprintf(stdscr, "    *  'Simulating an RT example.'                                       *\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    **********************************************************************\n")

# 
# Open the card with the specified card number.
# If a Driver exception is thrown, the except block
# is used to handle it. 
# 

    try:
        hCard = bticard.CardOpen(cardnum)
    except DriverError as e:
        consoleprintf(stdscr, "Error:  Either card number %d is not present, or\n", cardnum)
        consoleprintf(stdscr, "        an error occurred (%i) opening the card.\n", e.code)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "Using BTI1553 card #%d (%s, %s, S/N %04d)\n", 
                  cardnum, 
                  bticard.CardTypeStr(hCard), 
                  bticard.CardProductStr(hCard), 
                  bticard.CardGetInfo(bticard.INFOTYPE_SERIALNUM, 0, hCard))

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
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "Using MIL-STD-1553 core #%d\n", corenum)
    consoleprintf(stdscr, "Using MIL-STD-1553 channel #%d\n", channum)

#
# Configure the channel for remote terminal mode.
# 
    
    bticard.CardReset(hCore)
    
    try:
        bti1553.RTConfig(bti1553.RTCFG1553_DEFAULT, 1, channum, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring for",e.code)
        consoleprintf(stdscr, "\n        remote terminal mode on channel #%d on core #%d.",channum,corenum)
        consoleprintf(stdscr, "\n        (%s)",str(e))
        consoleprintf(stdscr, "\n")
        bticard.CardClose(hCard)
        consoleexit(1)

#
# Get the message address for a receive subaddress
#

    RTMsg = bti1553.RTGetMsg(bool(bti1553.SUBADDRESS), 1, bool(bticard.RCV), 2, channum, hCore)

#
# Start the card to begin responding to transmissions
#

    bticard.CardStart(hCore)

    consoleprintf(stdscr, "Press any key to exit....\n")

    while True:
        ch = stdscr.getch()
        if ch != curses.ERR:
            break

        Data = bti1553.MsgDataRd(3, RTMsg, hCore)
        consoleprintf(stdscr, "Received data {%04XH, %04XH, %04XH}\r", Data[0], Data[1], Data[2])

#
# Stop the card
#

    bticard.CardStop(hCore)

#
# The card MUST be closed before exiting the program
#
    
    bticard.CardClose(hCard)
    
    consoleexit(stdscr, 0)

if __name__ == "__main__":
    curses.wrapper(main)