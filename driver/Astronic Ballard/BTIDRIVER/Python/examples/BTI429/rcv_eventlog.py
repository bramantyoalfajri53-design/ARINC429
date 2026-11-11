#
# BTI429 DRIVER EXAMPLE 5  (08/19/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
#
# NAME: rcv_eventlog.py -- Polling the Event Log List
#

#
# This program opens the given card number (default: 0), 
# finds the first compatible core, and configures the first 
# receive channel to receive 2 GPS messages into separate
# Message Records; and receive all other messages
# into a default Message Record.
#
# Each of the messages is also configured to generate an
# Event Log List entry.  When an entry is read from the list,
# the associated data is read.
#


import argparse
import sys
from btidriver import bticard, bti429, DriverError, DeviceHandle
import curses

cardnum = 0
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
    Info = 0
    msgdefault = bti429.MSGSTRUCT429()
    latitude = bti429.MSGSTRUCT429()
    longitude = bti429.MSGSTRUCT429()
    ch = 0

    consoleentry(stdscr)

    consoleprintf(stdscr, "\n    **********************************************************************")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  EXAMP5  (08/19/2025)                                              *")
    consoleprintf(stdscr, "\n    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *")
    consoleprintf(stdscr, "\n    *  Kirkland WA USA                                                   *")
    consoleprintf(stdscr, "\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  BTI429 Example 8                                                  *")
    consoleprintf(stdscr, "\n    *  'Polling the Event Log List'                                      *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    **********************************************************************")
    consoleprintf(stdscr, "\n")

# 
# Open the card with the specified card number.
# If a Driver exception is thrown, the except block
# is used to handle it. 
# 

    try:
        hCard = bticard.CardOpen(cardnum)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  Either card number %u is not present, or", cardnum)
        consoleprintf(stdscr, "\n        an error occurred (%i) opening the card.", e.code)
        consoleprintf(stdscr, "\n        (%s)", str(e))
        consoleprintf(stdscr, "\n")
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "\nUsing BTI429 card #%d (%s, %s, S/N %04d)",
                   cardnum,
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
        except DriverError as e:
            break

        for rcvchan in range(MAX_CHANNELS):
            if bti429.ChIsRcv(rcvchan, hCore):
                chanfound = True
                break

        if chanfound:
            break

    if not chanfound:
        consoleprintf(stdscr, "\nError:  No ARINC 429 receive channels present in card #%d.", cardnum)
        consoleprintf(stdscr, "\n")
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "\nUsing ARINC 429 core #%d", corenum)
    consoleprintf(stdscr, "\nUsing receive channel #%d", rcvchan)
    consoleprintf(stdscr, "\n")

#
# Configure rcvchan for automatic speed detection.
#

    bticard.CardReset(hCore)

    try:
        bti429.ChConfig(bti429.CHCFG429_AUTOSPEED, rcvchan, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring channel #%d on core #%d.", e.code, rcvchan, corenum)
        consoleprintf(stdscr, "\n        (%s)", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Before any messages can be received, filters must be set
# for the receive channel.  First, the default filter is
# created.  Then, two filters are set for the two messages
# of interest.
#
# Each message is configured to create Event Log list entries.
#

    msgdefault.addr = bti429.FilterDefault(bti429.MSGCRT429_LOG, rcvchan, hCore)
    latitude.addr = bti429.FilterSet(bti429.MSGCRT429_LOG, 0o0310, bti429.SDIALL, rcvchan, hCore)
    longitude.addr = bti429.FilterSet(bti429.MSGCRT429_LOG, 0o0311, bti429.SDIALL, rcvchan, hCore)

#
# Initialize data values to zero.
#

    msgdefault.data = 0
    latitude.data   = 0
    longitude.data  = 0

#
# Configure the Event Log list.
#

    try:
        bticard.EventLogConfig(bticard.LOGCFG_ENABLE,1024,hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring the event log list on core #%d.", e.code, rcvchan, corenum)
        consoleprintf(stdscr, "\n        (%s)", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Start operation of the card
#
    
    bticard.CardStart(hCore)

# 
# Display data on the screen
#

    consoleprintf(stdscr, "\nPress any key to exit....\n\n")

    while True:
        ch = stdscr.getch()
        if ch != curses.ERR:
            break

        eventaddr, _, Info, _ = bticard.EventLogRd(hCore)
        if eventaddr:
            msgaddr = Info  # Info value is message address

            if msgaddr == msgdefault.addr:
                msgdefault.data = bti429.MsgDataRd(msgaddr, hCore)
            elif msgaddr == latitude.addr:
                latitude.data = bti429.MsgDataRd(msgaddr, hCore)
            elif msgaddr == longitude.addr:
                longitude.data = bti429.MsgDataRd(msgaddr, hCore)

        consoleprintf(stdscr, "\r")
        consoleprintf(stdscr, "Default=%08lX ", msgdefault.data)
        consoleprintf(stdscr, "Latitude=%08lX ", latitude.data)
        consoleprintf(stdscr, "Longitude=%08lX", longitude.data)

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