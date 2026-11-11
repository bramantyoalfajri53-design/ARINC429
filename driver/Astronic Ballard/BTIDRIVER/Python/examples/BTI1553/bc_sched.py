#
# BTI1553 DRIVER EXAMPLE 2  (08/27/2025)
# Copyright 2001-2025
# Astronics Advanced Electronic Systems Corp.
# www.astronics.com
# Ballard.Support@astronics.com
#
# NAME: bc_sched.py -- Simulating the BC - Scheduled Messages
#

#
# This program opens the given card number (default: 0), and configures it
# as a bus controller to transmit a schedule of three messages. 
# The schedule is created in such a way that the messages are transmitted 
# at frequencies of 100Hz, 50Hz, and 25Hz (or every 10ms, 20ms,
# and 40ms, respectively).
#
# The program watches the 'hit' bit associated with the 0842H
# BC-RT message.  When the message is transmitted and the
# bit is set, the program updates the data words.
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

CMD0 = 0x0843  # Command word for first message
CMD1 = 0x0821  # Command word for second message
RCV_CMD2 = 0x0821  # Receive command of an RT-RT transfer
XMT_CMD2 = 0x1C21  # Transmit command of an RT-RT transfer

FRAMETIME = 10000  # Frame time in microseconds

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
    channum = 0
    BCMsgs = []
    Data = [0] * 3

    consoleentry(stdscr)

    consoleprintf(stdscr, "    **********************************************************************\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    *  EXAMP2  (08/27/2025)                                              *\n")
    consoleprintf(stdscr, "    *  Copyright 2001-2025  Astronics Advanced Electronic Systems Corp.  *\n")
    consoleprintf(stdscr, "    *  Kirkland WA USA                                                   *\n")
    consoleprintf(stdscr, "    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *\n")
    consoleprintf(stdscr, "    *                                                                    *\n")
    consoleprintf(stdscr, "    *  BTI1553 Example 2                                                 *\n")
    consoleprintf(stdscr, "    *  'Simulating the BC - Scheduled Messages'                          *\n")
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
# Configure the channel for bus controller mode.
#

    bticard.CardReset(hCore)

    try:
        bti1553.BCConfig(bti1553.BCCFG1553_DEFAULT, channum, hCore)
    except DriverError as e:
        consoleprintf(stdscr, "Error:  An error was encountered (%i) while configuring bus\n", e.code)
        consoleprintf(stdscr, "        controller mode on channel #%d on core #%d.\n", channum, corenum)
        consoleprintf(stdscr, "        (%s)\n", str(e))
        bticard.CardClose(hCard)
        consoleexit(stdscr, 1, True)

#
# Create the message records for each of the three messages.
#

    BCMsgs.append(bti1553.BCCreateMsg(bti1553.MSGCRT1553_DEFAULT, CMD0, 0, Data, hCore))
    BCMsgs.append(bti1553.BCCreateMsg(bti1553.MSGCRT1553_DEFAULT, CMD1, 0, [0], hCore))
    BCMsgs.append(bti1553.BCCreateMsg(bti1553.MSGCRT1553_RTRT, RCV_CMD2, XMT_CMD2, [0], hCore))

#
# Schedule the messages to create the desired bus controller
# schedule.
#

    bti1553.BCSchedFrame(FRAMETIME, channum, hCore)
    bti1553.BCSchedMsg(BCMsgs[0], channum, hCore)
    bti1553.BCSchedMsg(BCMsgs[1], channum, hCore)
    bti1553.BCSchedMsg(BCMsgs[2], channum, hCore)

    bti1553.BCSchedFrame(FRAMETIME, channum, hCore)
    bti1553.BCSchedMsg(BCMsgs[0], channum, hCore)

    bti1553.BCSchedFrame(FRAMETIME, channum, hCore)
    bti1553.BCSchedMsg(BCMsgs[0], channum, hCore)
    bti1553.BCSchedMsg(BCMsgs[1], channum, hCore)

    bti1553.BCSchedFrame(FRAMETIME, channum, hCore)
    bti1553.BCSchedMsg(BCMsgs[0], channum, hCore)

#
# Start the card to begin transmissions.
#

    bticard.CardStart(hCore)

#
# Watch the 'hit' bit of the first message to see if it has
# been transmitted.  If it has, update the data words.
#

    consoleprintf(stdscr, "\nPress any key to exit....\n\n")

    while True:
        ch = stdscr.getch()
        if ch != curses.ERR:
            break

        MsgErrors = bti1553.MsgFieldRd(bti1553.FIELD1553_ERROR, BCMsgs[0], hCore)
        if MsgErrors & bti1553.MSGERR1553_HIT:
            Data[0] += 2
            Data[1] += 4
            Data[2] += 6

            # if value is greater than UINT16 can hold, reset to 0. 
            Data = [x % 0xffff for x in Data]

            bti1553.MsgDataWr(Data, BCMsgs[0], hCore)
            bti1553.MsgFieldWr(0, bti1553.FIELD1553_ERROR, BCMsgs[0], hCore)
            consoleprintf(stdscr, "\rTransmitting data {%04XH, %04XH, %04XH}", Data[0], Data[1], Data[2])

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