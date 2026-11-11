#
# BTI429 DRIVER EXAMPLE 5 (08/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
#
# NAME:   xmit_rcv_listbuf.py -- Transmit and Receive List Buffer example
#

#
# This program opens the given card number (default: 0),
# finds the first compatible ARINC 429 core, configures
# transmit and receive list buffers, transmits ramping
# airspeed data continuously from the transmit buffer,
# and displays received data from the receive buffer.
#

import argparse
import sys
import curses
from btidriver import bticard, bti429, DriverError, DeviceHandle

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
    rcv_airspeed = bti429.MSGSTRUCT429()

    consoleentry(stdscr)

    consoleprintf(stdscr, "\n    **********************************************************************")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  EXAMP5 (08/27/2025)                                               *")
    consoleprintf(stdscr, "\n    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *")
    consoleprintf(stdscr, "\n    *  Kirkland WA USA                                                   *")
    consoleprintf(stdscr, "\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  BTI429 Example 5                                                  *")
    consoleprintf(stdscr, "\n    *  'Program for transmit and receive list buffers.'                  *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    **********************************************************************\n")
    
# 
# Open the card with the specified card number.
# If a Driver exception is thrown, the except block
# is used to handle it. 
# 

    try:
        hCard = bticard.CardOpen(cardnum)
    except DriverError as e:
        consoleprintf(stdscr, "\nError opening card #%d: %s\n", cardnum, e)
        consoleexit(stdscr, 1, err=True)

    consoleprintf(stdscr, "\nUsing BTI429 card #%d (%s, %s, S/N %04d)",
                   cardnum,
                   bticard.CardTypeStr(hCard),
                   bticard.CardProductStr(hCard),
                   bticard.CardGetInfo(bticard.INFOTYPE_SERIALNUM, 0, hCard))

#
# Find the first ARINC 429 core with both a receive and a transmit channel
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
        consoleprintf(stdscr, "\nError: No compatible ARINC 429 core found in card #%d.", cardnum)
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, err=True)

    consoleprintf(stdscr, "\nUsing ARINC 429 core #%d", corenum)
    consoleprintf(stdscr, "\nUsing receive channel #%d", rcvchan)
    consoleprintf(stdscr, "\nUsing transmit channel #%d", xmtchan)
    consoleprintf(stdscr, "\n")
    
#
# Configure rcvchan for automatic speed detection with
# the self-test wraparound enabled.
# Configure xmtchan to transmit at low speed with
# the self-test wraparound enabled.
#

    bticard.CardReset(hCore)

    # Doing multiple protocol calls in the same try block
    channel = 0
    try:
        channel = rcvchan
        bti429.ChConfig(bti429.CHCFG429_AUTOSPEED|bti429.CHCFG429_SELFTEST, channel, hCore)
        channel = xmtchan
        bti429.ChConfig(bti429.CHCFG429_SELFTEST, channel, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring channel #%d on core #%d.", e.code, channel, corenum)
        consoleprintf(stdscr, "\n        (%s)", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Before any messages can be received, filters must be set
# for the receive channel.
#

    rcv_airspeed.addr = bti429.FilterSet(bti429.MSGCRT429_DEFAULT, 0o0206, bti429.SDIALL, rcvchan, hCore)

#
# Create a message for each of the labels we are transmitting.
#

    xmt_airspeed.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, hCore)

#
# Next, a schedule is built by creating explicit message timing.
#

    bti429.SchedMsg(xmt_airspeed.addr,xmtchan,hCore)
    bti429.SchedGap(1218,xmtchan,hCore)

#
# Create the transmit and receive list buffers.
#
# The transmit list buffer will be a circular buffer,
# which means it should be preloaded with data, and
# it will continuously transmit that data.
#
# The receive list buffer will be a FIFO, which we will
# read out of and display to the screen.
#

    xmtlistaddr = bti429.ListXmtCreate(bti429.LISTCRT429_CIRCULAR, 256, xmt_airspeed.addr, hCore)
    rcvlistaddr = bti429.ListRcvCreate(bti429.LISTCRT429_FIFO, 16, rcv_airspeed.addr, hCore)

#
# Initialize the transmit list buffer.
#

    for j in range(0x00000, 0x1000000, 0x10000):
        bti429.ListDataWr(0x00000086 | j, xmtlistaddr, hCore)

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
        data = bti429.ListDataRd(rcvlistaddr, hCore)
        if data:
            consoleprintf(stdscr, "\rAirSpeed=%08X ", data)

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