#
# BTI1553 DRIVER EXAMPLE 4  (08/21/2024)
# Copyright 2001-2024
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
#
# NAME: bm_rcv.py -- Monitoring the bus
#

#
# This program opens the given card number (default: 0), and configures it
# as a Bus Monitor terminal. It prints the time-tag, command words (if any),
# and status words (if any) for each monitor record.
#

import argparse
import sys
from btidriver import bticard, bti1553, DriverError, DeviceHandle
import curses

MAX_CORES = 4
MAX_CHANNELS = 32
BUF_SIZE = 2048

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
    channum = 0
    err = False
    seqcount = 0
    seqbuf = bticard.uint16_buffer(BUF_SIZE) # uint16 buffer for reading the Sequential Monitor
    sfinfo = bticard.SEQFINDINFO()
    pRec1553 = bticard.SEQRECORD1553()
    pRecMore1553 = bticard.SEQRECORDMORE1553()
    

    consoleentry(stdscr)

    consoleprintf(stdscr, "    **********************************************************************\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    *  EXAMP4  (08/27/2025)                                              *\n")
    consoleprintf(stdscr, "    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *\n")
    consoleprintf(stdscr, "    *  Kirkland WA USA                                                   *\n")
    consoleprintf(stdscr, "    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    *  BTI1553 Example 4                                                 *\n")
    consoleprintf(stdscr, "    *  'Monitoring the bus example.'                                     *\n")
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

    consoleprintf(stdscr, "Using BTI1553 card #%d (%s, %s, S/N %04d)\n", cardnum,
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
# Configure the channel for monitor mode.
#

    bticard.CardReset(hCore)

    try:
        bti1553.MonConfig(bti1553.MONCFG1553_DEFAULT, channum, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while configuring monitor mode on channel #%d on core #%d.\n", 
                      e.code, channum, corenum)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Configure the sequential record.
#

    try:
        bticard.SeqConfig(bticard.SEQCFG_DEFAULT,hCore)
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while configuring the sequential record on core #%d.\n", 
                      e.code, corenum)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Start the card to begin monitoring messages.
#

    bticard.CardStart(hCore)

#
# Read the entire contents of the monitor and display the results.
#

    consoleprintf(stdscr, "\nPress any key to exit....\n\n")

    try:
        while True:
            ch = stdscr.getch()
            if ch != curses.ERR:
                break

            seqcount, _ = bticard.SeqBlkRd(seqbuf, BUF_SIZE, hCore)
            sfinfo = bticard.SeqFindInit(seqbuf, seqcount)


            while True:
                pRec1553 = bticard.SeqFindNext1553(sfinfo)

                # Sequential record will be None if at the end of the buffer.
                if pRec1553:
                    consoleprintf(stdscr, "\n")

                    consoleprintf(stdscr, " Ch:%u",(pRec1553.activity & bti1553.MSGACT1553_CHMASK) >> bti1553.MSGACT1553_CHSHIFT)
                    consoleprintf(stdscr, " Time:%lu", pRec1553.timestamp)

                    if pRec1553.activity & bti1553.MSGACT1553_RCVCWD1:
                        consoleprintf(stdscr, " Cwd1:%04X", pRec1553.cwd1)
                    if pRec1553.activity & bti1553.MSGACT1553_RCVCWD2:
                        consoleprintf(stdscr, " Cwd2:%04X", pRec1553.cwd2)
                    if pRec1553.activity & bti1553.MSGACT1553_RCVSWD1:
                        consoleprintf(stdscr, " Swd1:%04X", pRec1553.swd1)
                    if pRec1553.activity & bti1553.MSGACT1553_RCVSWD2:
                        consoleprintf(stdscr, " Swd2:%04X", pRec1553.swd2)

                    if pRec1553.error & bti1553.MSGERR1553_NORESP:
                        consoleprintf(stdscr, " No response!")
                    if pRec1553.error & bti1553.MSGERR1553_ANYERR:
                        consoleprintf(stdscr, " Error!")

                    if bticard.SeqFindCheckVersion(pRec1553, bticard.SEQVER_1) == 0:
                        pRecMore1553 = bticard.SeqFindMore1553(pRec1553)
                        consoleprintf(stdscr, " RespTime1:%u", pRecMore1553.resptime1)
                else:
                    break
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while reading the sequential record.\n", e.code)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Stop the Card
#

    bticard.CardStop(hCore)

# 
# The card MUST be closed before exiting the program.
#

    bticard.CardClose(hCard)
    
    consoleexit(stdscr, 0)

if __name__ == "__main__":
    curses.wrapper(main)