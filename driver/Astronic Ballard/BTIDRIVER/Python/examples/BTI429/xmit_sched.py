#
# BTI429 DRIVER EXAMPLE 2  (08/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
# 
# NAME: xmit_sched.py -- Transmitter example
#

#
# This program opens the given card number (default: 0) and 
# configures the first compatible core to build a transmit schedule
# using transmit interval information, and then transmit
# the messages with changing data.
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
    xmtchan = 0
    comp_airspeed = bti429.MSGSTRUCT429()
    tot_air_temp = bti429.MSGSTRUCT429()
    altitude_rate = bti429.MSGSTRUCT429()
    msgaddr = []
    min_intrvls = []
    max_intrvls = []
    bnr_data = [0] * 3

    consoleentry(stdscr)

    consoleprintf(stdscr, "\n    **********************************************************************")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  EXAMP2  (08/27/2025)                                              *")
    consoleprintf(stdscr, "\n    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *")
    consoleprintf(stdscr, "\n    *  Kirkland WA USA                                                   *")
    consoleprintf(stdscr, "\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  BTI429 Example 2                                                  *")
    consoleprintf(stdscr, "\n    *  'Program for transmitter example.'                                *")
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
        consoleprintf(stdscr, "Error:  Either card number %d is not present, or\n", cardnum)
        consoleprintf(stdscr, "        an error occurred (%i) opening the card.\n", e.code)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "\nUsing BTI429 card #%d (%s,%s,S/N %04d)\n", cardnum, bticard.CardTypeStr(hCard), bticard.CardProductStr(hCard), bticard.CardGetInfo(bticard.INFOTYPE_SERIALNUM, 0, hCard))

#
# Find the first 429 core with a transmit channel.
#
    chanfound = False
    for corenum in range(MAX_CORES):
        try:
            hCore = bticard.CoreOpen(corenum, hCard)
        except DriverError:
            break

        for xmtchan in range(MAX_CHANNELS):
            if bti429.ChIsXmt(xmtchan, hCore):
                chanfound = True
                break

        if chanfound:
            break

    if not chanfound:
        consoleprintf(stdscr, "\nError:  No ARINC 429 transmit channels present in card number %d.\n", cardnum)
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "\nUsing ARINC 429 core #%d\n", corenum)
    consoleprintf(stdscr, "Using transmit channel #%d\n", xmtchan)

#
# Configure xmtchan to transmit at high speed.
#

    bticard.CardReset(hCore)

    try:
        bti429.ChConfig(bti429.CHCFG429_HIGHSPEED, xmtchan, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring channel #%d of core #%d.\n", e.code, xmtchan, corenum)
        consoleprintf(stdscr, "\n        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Create a message for each of the labels we are transmitting.
#

    comp_airspeed.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT,hCore)
    tot_air_temp.addr  = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT,hCore)
    altitude_rate.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT,hCore)

#
# Set up the arrays of message addresses; and intervals
# needed to build the schedule.  Note that the nth element
# in each array correspond to each other.
#

    msgaddr =       [comp_airspeed.addr,    tot_air_temp.addr,  altitude_rate.addr]
    min_intrvls =   [250,                   250,                100]
    max_intrvls =   [500,                   500,                200]

#
# Next, build a schedule using the minimum and maximum
# transmit intervals.
#

    try:
        bti429.SchedBuild(msgaddr, min_intrvls, max_intrvls, xmtchan, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while building a schedule on channel #%d of core #%d.\n", e.code, xmtchan, corenum)
        consoleprintf(stdscr, "\n        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Initialize the three Message Records.
#

    comp_airspeed.data = bti429.FldPutLabel(0, 0o206)
    tot_air_temp.data = bti429.FldPutLabel(0, 0o211)
    altitude_rate.data = bti429.FldPutLabel(0, 0o212)

    comp_airspeed.data = bti429.BNRPutMant(comp_airspeed.data, 0, 14, 0)
    tot_air_temp.data = bti429.BNRPutMant(tot_air_temp.data, 0, 11, 0)
    altitude_rate.data = bti429.BNRPutMant(altitude_rate.data, 0, 16, 0)

    bti429.MsgDataWr(comp_airspeed.data, comp_airspeed.addr, hCore)
    bti429.MsgDataWr(tot_air_temp.data, tot_air_temp.addr, hCore)
    bti429.MsgDataWr(altitude_rate.data, altitude_rate.addr, hCore)

#
# Start operation of the card.
#

    try:
        bticard.CardStart(hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while starting card #%d / core #%d.\n", e.code, cardnum, corenum)
        consoleprintf(stdscr, "\n        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Change data until a key is pressed.
#

    consoleprintf(stdscr, "\nPress any key to exit....\n\n")

    while True:
        ch = stdscr.getch()
        if ch != curses.ERR:
            break

        comp_airspeed.data = bti429.MsgDataRd(comp_airspeed.addr, hCore)
        tot_air_temp.data = bti429.MsgDataRd(tot_air_temp.addr, hCore)
        altitude_rate.data = bti429.MsgDataRd(altitude_rate.addr, hCore)

        bnr_data[0] = bti429.BNRGetMant(comp_airspeed.data, 14)
        bnr_data[1] = bti429.BNRGetMant(tot_air_temp.data, 11)
        bnr_data[2] = bti429.BNRGetMant(altitude_rate.data, 16)

        bnr_data[0] += 1
        bnr_data[1] += 1
        bnr_data[2] += 1

        comp_airspeed.data = bti429.BNRPutMant(comp_airspeed.data, bnr_data[0], 14, 0)
        tot_air_temp.data = bti429.BNRPutMant(tot_air_temp.data, bnr_data[1], 11, 0)
        altitude_rate.data = bti429.BNRPutMant(altitude_rate.data, bnr_data[2], 16, 0)

        bti429.MsgDataWr(comp_airspeed.data, comp_airspeed.addr, hCore)
        bti429.MsgDataWr(tot_air_temp.data, tot_air_temp.addr, hCore)
        bti429.MsgDataWr(altitude_rate.data, altitude_rate.addr, hCore)

#
# Stop the card.
#

    bticard.CardStop(hCore)

#
# The card MUST be closed before exiting the program.
#

    bticard.CardClose(hCard)

    consoleexit(stdscr, 0)

if __name__ == "__main__":
    curses.wrapper(main)