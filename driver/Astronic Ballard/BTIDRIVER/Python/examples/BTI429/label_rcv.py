# 
# BTI429 DRIVER EXAMPLE 1  (08/14/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
# 
# NAME: label_rcv.py -- Receiver example
# 

# 
# This program opens the given card number (default: 0), and 
# configures the first compatible core to receive 2 GPS messages 
# into separate Message Records, and receive all other
# messages into a default Message Record.
# 

import argparse
import sys
from btidriver import bticard, bti429, DriverError, DeviceHandle
import curses

MAX_CORES = 4
MAX_CHANNELS = 32

# argument parser
parser = argparse.ArgumentParser(description="BTI429 Example")
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

def consoleexit(stdscr, value, err=False):
    if err:
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
    rcvchan = 0
    msgdefault = bti429.MSGSTRUCT429()
    latitude = bti429.MSGSTRUCT429()
    longitude = bti429.MSGSTRUCT429()

    consoleentry(stdscr)

    consoleprintf(stdscr, "    **********************************************************************\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    *  EXAMP1  (08/27/2025)                                              *\n")
    consoleprintf(stdscr, "    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *\n")
    consoleprintf(stdscr, "    *  Kirkland WA USA                                                   *\n")
    consoleprintf(stdscr, "    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    *  BTI429 Example 1                                                  *\n")
    consoleprintf(stdscr, "    *  'Program for receiver example'                                    *\n")
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

    consoleprintf(stdscr, "Using BTI429 card #%d (%s, %s, S/N %04d)\n", cardnum,
                  bticard.CardTypeStr(hCard),
                  bticard.CardProductStr(hCard),
                  bticard.CardGetInfo(bticard.INFOTYPE_SERIALNUM, 0, hCard))

#
# Find the first ARINC 429 core with a receive channel.
#

    chanfound = False
    for corenum in range(MAX_CORES):
        try:
            hCore = bticard.CoreOpen(corenum, hCard)
        except DriverError:
            break

        for rcvchan in range(MAX_CHANNELS):
            if bti429.ChIsRcv(rcvchan, hCore):
                chanfound = True
                break

        if chanfound:
            break

    if not chanfound:
        consoleprintf(stdscr, "Error:  No ARINC 429 receive channels present in cardnum %d.\n", cardnum)
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "Using ARINC 429 core #%d\n", corenum)
    consoleprintf(stdscr, "Using receive channel #%d\n", rcvchan)

#
# Configure receiver channel for automatic speed detection.
#

    bticard.CardReset(hCore)

    try:
        bti429.ChConfig(bti429.CHCFG429_AUTOSPEED, rcvchan, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while configuring channel #%d on core #%d.\n",
                      e.code, rcvchan, corenum)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Before any messages can be received, filters must be set
# for the receive channel.  First, the default filter is
# created.  Then, two filters are set for the two messages
# of interest.
#


    msgdefault.addr = bti429.FilterDefault(bti429.MSGCRT429_DEFAULT, rcvchan, hCore)
    latitude.addr = bti429.FilterSet(bti429.MSGCRT429_DEFAULT, 0o0310, bti429.SDIALL, rcvchan, hCore)
    longitude.addr = bti429.FilterSet(bti429.MSGCRT429_DEFAULT, 0o0311, bti429.SDIALL, rcvchan, hCore)

#
# Start operation of the card.
#

    bticard.CardStart(hCore)

#
# Display data on the screen.
#

    consoleprintf(stdscr, "\nPress any key to exit....\n\n")

    while True:
        ch = stdscr.getch()
        if ch != curses.ERR:
            break

        msgdefault.data = bti429.MsgDataRd(msgdefault.addr, hCore)
        latitude.data = bti429.MsgDataRd(latitude.addr, hCore)
        longitude.data = bti429.MsgDataRd(longitude.addr, hCore)

        consoleprintf(stdscr, "\r")
        consoleprintf(stdscr, "Default=%08lX ", msgdefault.data)
        consoleprintf(stdscr, "Latitude=%08lX ", latitude.data)
        consoleprintf(stdscr, "Longitude=%08lX", longitude.data)

#
# Stop the card
#

    bticard.CardStop(hCore)
    
#
# The card MUST be closed before exiting the program.
#

    bticard.CardClose(hCard)

    consoleexit(stdscr, 0)

if __name__ == "__main__":
    curses.wrapper(main)