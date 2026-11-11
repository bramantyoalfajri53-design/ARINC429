#
# BTI429 DRIVER EXAMPLE 4  (08/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
#
# NAME: xmit_rcv_explicit.py -- Explicit message timing
#
  
# 
# This program opens the given card number (default: 0),
# finds the first compatible core, and builds a transmit 
# schedule using explicit message timing. The self-test
# wraparound is enabled and filters are set to
# receive the messages. The minimum and maximum elapsed
# time for each message is displayed.
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
    xmtchan = 0
    rcvfound = False
    xmtfound = False
    xmt_airspeed = bti429.MSGSTRUCT429()
    xmt_altitude = bti429.MSGSTRUCT429()
    rcv_airspeed = bti429.MSGSTRUCT429()
    rcv_altitude = bti429.MSGSTRUCT429()
    airspeed_record = bti429.MSGFIELDS429()
    altitude_record = bti429.MSGFIELDS429()
    ch = 0


    consoleentry(stdscr)

    consoleprintf(stdscr, "\n    **********************************************************************")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  EXAMP4  (08/27/2025)                                              *")
    consoleprintf(stdscr, "\n    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *")
    consoleprintf(stdscr, "\n    *  Kirkland WA USA                                                   *")
    consoleprintf(stdscr, "\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  BTI429 Example 4                                                  *")
    consoleprintf(stdscr, "\n    *  'Program for explicit message timing.'                            *")
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
# Find the first ARINC 429 core with both a receive and a transmit channel
#

    for corenum in range(MAX_CORES):
        rcvfound = False
        xmtfound = False

        try:
            hCore = bticard.CoreOpen(corenum, hCard)
        except DriverError as e:
            break

        for rcvchan in range(MAX_CHANNELS):
            rcvfound = bti429.ChIsRcv(rcvchan, hCore)
            if rcvfound:
                break

        if rcvfound:
            for xmtchan in range(MAX_CHANNELS):
                xmtfound = bti429.ChIsXmt(xmtchan, hCore)
                if xmtfound:
                    break

        if rcvfound and xmtfound:
            break

    if not (rcvfound and xmtfound):
        consoleprintf(stdscr, "\nError:  No compatible ARINC 429 core present in card #%d.", cardnum)
        consoleprintf(stdscr, "\n")
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "\nUsing ARINC 429 core #%d", corenum)
    consoleprintf(stdscr, "\nUsing receive channel #%d", rcvchan)
    consoleprintf(stdscr, "\nUsing transmit channel #%d", xmtchan)
    consoleprintf(stdscr, "\n")

#
# Configure rcvchan to receive at low speed with the
# Min/Max Elapse Time option also enabled.
# Note that the self-test wraparound is also enabled.
#
# Configure xmtchan to transmit at low speed.
# Note that the self-test wraparound is also enabled.
# The external line drivers are disabled, and xmtchan is
# connected internally to all the receive channels.
#

    bticard.CardReset(hCore)

    # Doing multiple protocol calls in the same try block
    channel = 0
    try:
        channel = rcvchan
        bti429.ChConfig(bti429.CHCFG429_MAXMIN|bti429.CHCFG429_SELFTEST, channel, hCore)
        channel = xmtchan
        bti429.ChConfig(bti429.CHCFG429_SELFTEST, channel, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring channel #%d on core #%d.", e.code, channel, corenum)
        consoleprintf(stdscr, "\n        (%s)", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Before any messages can be received, filters must be set
# for the receive channel.  Two filters are set for the
# two messages of interest.
#

    rcv_airspeed.addr = bti429.FilterSet(bti429.MSGCRT429_DEFAULT, 0o0206, bti429.SDIALL, rcvchan, hCore)
    rcv_altitude.addr = bti429.FilterSet(bti429.MSGCRT429_DEFAULT, 0o0212, bti429.SDIALL, rcvchan, hCore)

#
# Create a message for each of the labels we are transmitting.
#

    xmt_airspeed.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, hCore)
    xmt_altitude.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, hCore)

#
# Next, a schedule is built by creating explicit message timing.
#

    bti429.SchedMsg(xmt_altitude.addr,xmtchan,hCore)
    bti429.SchedMsg(xmt_airspeed.addr,xmtchan,hCore)
    bti429.SchedGap(495,xmtchan,hCore)
    bti429.SchedMsg(xmt_altitude.addr,xmtchan,hCore)
    bti429.SchedGap(531,xmtchan,hCore)


#
# Calculate a divisor for later when printing min/max time
#

    divVal = 1000000 if (bticard.TIMERRESOL_1NS == bticard.TimerResolution(bticard.TIMERRESOL_CURRENT, hCore)) else 1000

#
# Those messages that are to be transmitted are initialized.
#

    bti429.MsgDataWr(0x0000008A,xmt_altitude.addr,hCore)
    bti429.MsgDataWr(0x00000086,xmt_airspeed.addr,hCore)

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

        # Ignore the returned MSGADDR using '_'
        _, airspeed_record = bti429.MsgBlockRd(rcv_airspeed.addr, hCore)
        _, altitude_record = bti429.MsgBlockRd(rcv_altitude.addr, hCore)

        consoleprintf(stdscr, "\r")
        consoleprintf(stdscr, "AirSpeed: min/max=%2ums/%2ums ", airspeed_record.mintime / divVal, airspeed_record.maxtime / divVal)
        consoleprintf(stdscr, "Altitude: min/max=%2ums/%2ums ", altitude_record.mintime / divVal, altitude_record.maxtime / divVal)
        consoleprintf(stdscr, "         ")

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