# 
# BTI429 DRIVER EXAMPLE 10  (8/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
# 
# NAME: xmit_rcv_mon_all.py -- Multiple Core Example
#

# 
# This program opens the given card number (default: 0) and configures all ARINC 
# 429 cores to transmit, receive, and monitor. All transmit channels and all
# receive channels are used. It also enables the Sequential Monitor to
# record transmitted and received messages.
#

import argparse
import sys
from btidriver import bticard, bti429, DriverError, DeviceHandle
import curses

MAX_CORES = 4
MAX_CHANNELS = 32
BUF_SIZE = 2048

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
    hCores = [DeviceHandle(0)] * MAX_CORES
    b429Core = [False] * MAX_CORES
    corecount = 0
    seqbuf = bticard.uint16_buffer(BUF_SIZE) # uint16 buffer for reading the Sequential Monitor

    consoleentry(stdscr)

    consoleprintf(stdscr, "\n    **********************************************************************")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  EXAMP6  (08/27/2025)                                              *")
    consoleprintf(stdscr, "\n    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *")
    consoleprintf(stdscr, "\n    *  Kirkland WA USA                                                   *")
    consoleprintf(stdscr, "\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  BTI429 Example 10                                                 *")
    consoleprintf(stdscr, "\n    *  'Program for multiple core example.'                              *")
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
# Find all ARINC 429 cores on the board
#

    for corenum in range(MAX_CORES):
        try:
            hCores[corenum] = bticard.CoreOpen(corenum, hCard)
        except DriverError:
            break

        for chan in range(MAX_CHANNELS):
            if bti429.ChIsRcv(chan, hCores[corenum]) or bti429.ChIsXmt(chan, hCores[corenum]):
                b429Core[corenum] = True
                corecount += 1
                break

    if corecount == 0:
        consoleprintf(stdscr, "\nError:  Unable to find any ARINC 429 cores on card #%d.", cardnum)
        consoleprintf(stdscr, "\n")
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "\nUsing %d ARINC 429 core(s) on card #%d", corecount, cardnum)
    consoleprintf(stdscr, "\n")

#
# Configure all transmit channels on all cores to transmit at low speed.
# Configure all receive channels on all cores for automatic speed detection.
# Configure the Sequential Monitor for each core.
#

    xmt_airspeed = bti429.MSGSTRUCT429()

    for corenum in range(MAX_CORES):
        if b429Core[corenum]:
            
            for chan in range(MAX_CHANNELS):
                if bti429.ChIsXmt(chan, hCores[corenum]):
                    try:
                        bti429.ChConfig(bti429.CHCFG429_SEQALL, chan, hCores[corenum])
                    except DriverError as e: 
                        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring",e.code)
                        consoleprintf(stdscr, "\n        channel #%d on core #%d.",chan,corenum)
                        consoleprintf(stdscr, "\n        (%s)",str(e))
                        bticard.CardClose(hCard)
                        consoleexit(1)
                    
                    # Create a message for each of the synchronous labels we are transmitting. 
                    xmt_airspeed.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT,hCores[corenum])

                    # Schedule the message 
                    bti429.SchedMsg(xmt_airspeed.addr,chan,hCores[corenum])
                    bti429.SchedGap(1218,chan,hCores[corenum])

                    # Initialize the Message Record. 
                    xmt_airspeed.data = bti429.FldPutLabel(0,0o206)  # Init label field
                    bti429.MsgDataWr(xmt_airspeed.data,xmt_airspeed.addr,hCores[corenum])
                    
                if bti429.ChIsRcv(chan, hCores[corenum]):
                    try:
                        bti429.ChConfig(bti429.CHCFG429_SEQALL | bti429.CHCFG429_AUTOSPEED, chan, hCores[corenum])
                    except DriverError as e: 
                        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring",e.code)
                        consoleprintf(stdscr, "\n        channel #%d on core #%d.",chan,corenum)
                        consoleprintf(stdscr, "\n        (%s)",str(e))
                        bticard.CardClose(hCard)
                        consoleexit(1)

                    # Create a default filter 
                    bti429.FilterDefault(bti429.MSGCRT429_DEFAULT,chan,hCores[corenum]);                            
            
            try:
                bticard.SeqConfig(bticard.SEQCFG_DEFAULT,hCores[corenum])
            except DriverError as e: 
                consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring",e.code)
                consoleprintf(stdscr, "\n        the sequential record on core #%d.",corenum)
                consoleprintf(stdscr, "\n        (%s)",str(e))
                bticard.CardClose(hCard)
                consoleexit(1)

#
# Start operation of the card.
#

    for corenum in range(MAX_CORES):
        if(b429Core[corenum]):
            bticard.CardStart(hCores[corenum])

#
# Display data on the screen.
#

    consoleprintf(stdscr, "\nPress any key to exit....\n\n")


    try:
        while True:
            ch = stdscr.getch()
            if ch != curses.ERR:
                break
            
            for corenum in range(corecount):
                seqcount, _ = bticard.SeqBlkRd(seqbuf, BUF_SIZE, hCores[corenum])

                sfinfo = bticard.SeqFindInit(seqbuf, seqcount)

                while True: 
                    pRec429 = bticard.SeqFindNext429(sfinfo)
                    if pRec429:
                        consoleprintf(stdscr, "\nCore:%d Ch:%02u Data:%08lX Time Stamp:%08lX",
	    					corenum,
	    					((pRec429.activity & bti429.MSGACT429_CHMASK) >> bti429.MSGACT429_CHSHIFT),
	    					pRec429.data,
	    					pRec429.timestamp)
                    else:
                        break
    
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while reading the sequential record.\n", e.code)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Stop the card
#

    for corenum in range(MAX_CORES):
        if hCores[corenum] is not None:
            bticard.CardStop(hCores[corenum])

#
# The card MUST be closed before exiting the program.
#

    bticard.CardClose(hCard)

    consoleexit(stdscr, 0)

if __name__ == "__main__":
    curses.wrapper(main)