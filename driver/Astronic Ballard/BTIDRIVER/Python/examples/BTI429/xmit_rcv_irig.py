# 
# BTI429 DRIVER EXAMPLE 7  (08/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
# 
# NAME: xmit_rcv_irig.py -- IRIG Timer example
#

# 
# This program opens the given card number (default: 0), finds the first 
# compatible core, and enables the IRIG timer. A transmit schedule is built using 
# explicit message timing. The self-test wraparound is enabled 
# and filters are set to receive the messages. A time-tag, minimum 
# and maximum elapsed time for each message is converted from 
# the IRIG time and displayed.
#

import argparse
import sys
from btidriver import bticard, bti429, DriverError, DeviceHandle
import curses
import time

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
    rcvchan = 0
    xmtchan = 0
    rcvfound = False
    xmtfound = False

    xmt_airspeed = bti429.MSGSTRUCT429()
    rcv_airspeed = bti429.MSGSTRUCT429()
    airspeed_record = bti429.MSGFIELDS429()
    irigtime = bticard.BTIIRIGTIME()
    curtime = time.localtime()

    consoleentry(stdscr)

    consoleprintf(stdscr, "\n    **********************************************************************")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  EXAMP12  (08/27/2025)                                             *")
    consoleprintf(stdscr, "\n    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *")
    consoleprintf(stdscr, "\n    *  Kirkland WA USA                                                   *")
    consoleprintf(stdscr, "\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *")
    consoleprintf(stdscr, "\n    *                                                                    *")
    consoleprintf(stdscr, "\n    *  BTI429 Example 12                                                 *")
    consoleprintf(stdscr, "\n    *  'Program for IRIG timer example.'                                 *")
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
# Find the first ARINC 429 core with both a receive and a transmit channel.
#

    for corenum in range(MAX_CORES):
        try:
            hCore = bticard.CoreOpen(corenum, hCard)
        except DriverError as errval:
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

    if  not (rcvfound and xmtfound):
        consoleprintf(stdscr, "\nError:  No compatible ARINC 429 core present in card #%d.", cardnum)
        consoleprintf(stdscr, "\n")
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

    consoleprintf(stdscr, "\nUsing ARINC 429 core #%d", corenum)
    consoleprintf(stdscr, "\nUsing receive channel #%d", rcvchan)
    consoleprintf(stdscr, "\nUsing transmit channel #%d", xmtchan)
    consoleprintf(stdscr, "\n")

#
# Configure rcvchan to receive at low speed with the Min/Max Elapse Time option also enabled.
# Note that the self-test wraparound is also enabled.
#
# Configure xmtchan to transmit at low speed.
# Note that the self-test wraparound is also enabled.
# The external line drivers are disabled, and xmtchan is connected internally to all the receive channels.
# 
    
    bticard.CardReset(hCore)

    try:
        bti429.ChConfig(bti429.CHCFG429_MAXMIN | bti429.CHCFG429_SELFTEST, rcvchan, hCore)
        bti429.ChConfig(bti429.CHCFG429_SELFTEST, xmtchan, hCore)
    except DriverError as errval:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring channel #%d on core #%d.", errval.code, rcvchan, corenum)
        consoleprintf(stdscr, "\n        (%s)", str(errval))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Before any messages can be received, filters must be set for the receive channel.
#
    
    rcv_airspeed.addr = bti429.FilterSet(bti429.MSGCRT429_DEFAULT, 0o0206, bti429.SDIALL, rcvchan, hCore)

#
# Create a message for each of the labels we are transmitting.
#

    xmt_airspeed.addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, hCore)

#
# Next, a schedule is built by creating explicit message timing.
#

    bti429.SchedMsg(xmt_airspeed.addr, xmtchan, hCore)
    bti429.SchedGap(1100, xmtchan, hCore)

#
# Those messages that are to be transmitted are initialized.
#

    bti429.MsgDataWr(0x00000086, xmt_airspeed.addr, hCore)

#
# Configure the IRIG timer. (DEFAULT -> bit rate = IRIGB, internal, slave/receiver)
# Sequential monitor will store IRIG time in sequential records
#

    try:
        bticard.IRIGConfig(bticard.IRIGCFG_DEFAULT, hCore)
    except DriverError as errval:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while configuring the IRIG timer on core #%d.", errval.code, corenum)
        consoleprintf(stdscr, "\n        (%s)", str(errval))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)


    timetagIsBCD = (bticard.TimerStatus(hCore) == bticard.TIMETAG_FORMAT_BCD) 
    timetagIsNano = (bticard.TimerResolution(bticard.TIMERRESOL_CURRENT, hCore) == bticard.TIMERRESOL_1NS)

#
# Synchronize the on core IRIG timer with the computer local time
#

    curtime = time.localtime()

    irigtime.days  = curtime.tm_yday;		# Day of year (0 - 365; January 1 = 0) 
    irigtime.hours = curtime.tm_hour;		# Hours after midnight (0 - 23) 
    irigtime.min   = curtime.tm_min;		# Minutes after hour (0 - 59) 
    irigtime.sec   = curtime.tm_sec;		# Seconds after minute (0 - 59) 
    irigtime.msec  = 0;						# The tm structure does not include milliseconds. 
    irigtime.usec  = 0;						# The tm structure does not include microseconds. 

    try:
        bticard.IRIGWr(irigtime, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "\nError:  An error was encountered (%i) while writing",errval)
        consoleprintf(stdscr, "\n        the IRIG time on core #%d.",corenum)
        consoleprintf(stdscr, "\n        (%s)",str(e))
        bticard.CardClose(hCard)
        consoleexit(1)

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

        _, airspeed_record = bti429.MsgBlockRd(rcv_airspeed.addr,hCore)

        if not timetagIsBCD :
            if not timetagIsNano:
                # Most functions that take a 64bit int can now take int 
                timetag = bticard.IRIGTimeBCDToBin((airspeed_record.timetagh << 32) | airspeed_record.timetag)
                airspeed_record.timetagh = timetag >> 32
                airspeed_record.timetag = timetag & 0xFFFFFFFF
                
                airspeed_record.elapsetime = bticard.IRIGTimeBinToBCD(airspeed_record.elapsetime)
            else:
                timetag = bticard.IRIGTimeNanoBinToBCD((airspeed_record.timetagh << 32) | airspeed_record.timetag)
                airspeed_record.timetagh = timetag >> 32
                airspeed_record.timetag = timetag & 0xFFFFFFFF
                
                airspeed_record.elapsetime = bticard.IRIGTimeNanoBinToBCD(airspeed_record.elapsetime)
        
        consoleprintf(stdscr, "\r")
               
        consoleprintf(stdscr, "TT: %02u:%02u %02u.%03u.%03u    ",
				bticard.IRIGFieldGetHours((airspeed_record.timetagh << 32) | airspeed_record.timetag),
				bticard.IRIGFieldGetMin((airspeed_record.timetagh << 32) | airspeed_record.timetag),
				bticard.IRIGFieldGetSec((airspeed_record.timetagh << 32) | airspeed_record.timetag),
				bticard.IRIGFieldGetMillisec((airspeed_record.timetagh << 32) | airspeed_record.timetag),
				bticard.IRIGFieldGetMicrosec((airspeed_record.timetagh << 32) | airspeed_record.timetag))
        
        consoleprintf(stdscr, "AirSpeed: min/max=%02ums/%02ums ",
				bticard.IRIGFieldGetMillisec(airspeed_record.mintime),
				bticard.IRIGFieldGetMillisec(airspeed_record.maxtime))
                
        consoleprintf(stdscr, "    ")

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