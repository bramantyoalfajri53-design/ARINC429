#
# BTI429 DRIVER EXAMPLE 3  (08/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
#
# NAME: xmit_rcv.py -- Monitor example
#

#
# This program opens the given card number (default: 0), and 
# finds the first compatible core, builds a transmit schedule
# using transmit interval information, and creates filters
# for two receive messages.  It also enables the
# Sequential Monitor to record transmitted and
# received messages.
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
    rcvchan = 0
    xmtchan = 0
    rcvfound = False
    xmtfound = False
    msgdefault = bti429.MSGSTRUCT429()
    latitude = bti429.MSGSTRUCT429()
    longitude = bti429.MSGSTRUCT429()
    comp_airspeed = bti429.MSGSTRUCT429()
    tot_air_temp = bti429.MSGSTRUCT429()
    altitude_rate = bti429.MSGSTRUCT429()
    msgaddr = [0] * 3
    min_intrvls = [0] * 3
    max_intrvls = [0] * 3
    seqbuf = bticard.uint16_buffer(BUF_SIZE)
    seqcount = 0
    sfinfo = bticard.SEQFINDINFO()
    ch = 0

    consoleentry(stdscr)

    consoleprintf(stdscr, "\n    **********************************************************************")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  EXAMP3  (08/27/2025)                                              *")
    consoleprintf(stdscr, "\n    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *")
    consoleprintf(stdscr, "\n    *  Kirkland WA USA                                                   *")
    consoleprintf(stdscr, "\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  BTI429 Example 3                                                  *")
    consoleprintf(stdscr, "\n    *  'Program for monitor example.'                                    *")
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
# Find the first ARINC 429 core with both a receive and a transmit channel.
#

    for corenum in range(MAX_CORES):
        try:
            hCore = bticard.CoreOpen(corenum, hCard)
        except DriverError:
            break

        for rcvchan in range(MAX_CHANNELS):
            if bti429.ChIsRcv(rcvchan, hCore):
                rcvfound = True
                break

        if rcvfound:
            for xmtchan in range(MAX_CHANNELS):
                if bti429.ChIsXmt(xmtchan, hCore):
                    xmtfound = True
                    break
                    
        if rcvfound and xmtfound:
            break

    if not (rcvfound and xmtfound):
        consoleprintf(stdscr, "Error:  No compatible ARINC 429 core present in card number %d.\n", cardnum)
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "Using ARINC 429 core #%d\n", corenum)
    consoleprintf(stdscr, "Using receive channel #%d\n", rcvchan)
    consoleprintf(stdscr, "Using transmit channel #%d\n", xmtchan)

#
# Configure rcvchan for automatic speed detection.
# Configure xmtchan to transmit at low speed.
#
# Record all of xmtchan data into the Sequential Record.
#

    bticard.CardReset(hCore)

    channel = 0

    try:
        channel = rcvchan
        bti429.ChConfig(bti429.CHCFG429_AUTOSPEED, channel, hCore) # Configure Channel
        channel = xmtchan
        bti429.ChConfig(bti429.CHCFG429_SEQALL, xmtchan, hCore) # Configure Channel
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while configuring channel #%d on core #%d.\n", e.code, channel, corenum)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Create a message for each of the labels we are transmitting.
#

    comp_airspeed.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, hCore)
    tot_air_temp.addr  = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, hCore)
    altitude_rate.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, hCore)
    
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
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while building a transmit schedule on core #%d.\n", e.code, corenum)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Initialize the three Message Records.
#

    comp_airspeed.data = bti429.FldPutLabel(0, 0o206) # Init label field
    tot_air_temp.data  = bti429.FldPutLabel(0, 0o211)
    altitude_rate.data = bti429.FldPutLabel(0, 0o212)

    comp_airspeed.data = bti429.BNRPutMant(comp_airspeed.data,0,14,0) # Init BNR data 
    tot_air_temp.data  = bti429.BNRPutMant(tot_air_temp.data,0,11,0)
    altitude_rate.data = bti429.BNRPutMant(altitude_rate.data,0,16,0)

    bti429.MsgDataWr(comp_airspeed.data, comp_airspeed.addr, hCore)
    bti429.MsgDataWr(tot_air_temp.data, tot_air_temp.addr, hCore)
    bti429.MsgDataWr(altitude_rate.data, altitude_rate.addr, hCore)
    
#
# Before any messages can be received, filters must be set
# for the receive channel.  First, the default filter is
# created.  Then, two filters are set for the two messages
# of interest.
#
# Record the two filtered messages.
#

    msgdefault.addr = bti429.FilterDefault(bti429.MSGCRT429_DEFAULT, rcvchan, hCore)
    latitude.addr   = bti429.FilterSet(bti429.MSGCRT429_DEFAULT, 0o0310, bti429.SDIALL, rcvchan, hCore)
    longitude.addr  = bti429.FilterSet(bti429.MSGCRT429_DEFAULT, 0o0311, bti429.SDIALL, rcvchan, hCore)

#
# Configure the Sequential Monitor for fill and halt mode (default).
#

    try: 
        bticard.SeqConfig(bticard.SEQCFG_DEFAULT, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while configuring the sequential record.\n", e.code)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Start operation of the card.
#

    bticard.CardStart(hCore)

#
# Display data on the screen.
#

    consoleprintf(stdscr, "\nMonitoring the bus...\nPress any key to exit....\n\n")

    try:
        while True:
            ch = stdscr.getch()
            if ch != curses.ERR:
                break

            seqcount, _ = bticard.SeqBlkRd(seqbuf, BUF_SIZE, hCore)
            sfinfo = bticard.SeqFindInit(seqbuf, seqcount)
            
            while True:
                consoleprintf(stdscr, "\r")
                pRec429 = bticard.SeqFindNext429(sfinfo)
                if pRec429:
                    consoleprintf(stdscr, "Core:%d  Ch:%02u  Data:%08lX  Time Stamp:%08lX",
			        corenum,
			        ((pRec429.activity & bti429.MSGACT429_CHMASK) >> bti429.MSGACT429_CHSHIFT),
			        pRec429.data,
			        pRec429.timestamp)
                else:
                    break
                if(bticard.SeqFindCheckVersion(pRec429, bticard.SEQVER_1)):
                    consoleprintf(stdscr, "  decgap:%X",pRec429.decgap)
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while reading the sequential record.\n", e.code)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

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