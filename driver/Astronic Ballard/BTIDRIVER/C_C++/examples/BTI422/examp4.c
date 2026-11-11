
/**
*
*  BTI422 DRIVER EXAMPLE 4  (08/21/2024)
*  Copyright 2004-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP4.C -- Transmitting/Receiving 9 bit data
*
**/

/**
*  This program assumes that the first and second
*  serial channels that support RS422 are connected
*
*  This program opens Card Number 0, and configures the
*  first and second serial ports at 115,200 bps with
*  8 bit data, space parity, 1 stop bit. The port is
*  loaded with initial data using the local 9 bit FIFO
*  write function that uses the force parity error to
*  invert the 9th data bit as needed. The data is
*  transmitted from the first to the second serial port
*  where it is reconstructed to 9 bits using the
*  parity error flag
**/

#include "BTICard.h"
#include "BTI422.h"
#include <stdio.h>
#include <stdlib.h>
#include <ncurses.h>


#define	CARDNUM		  0
#define	MAX_CORES     4
#define	MAX_PORTS     16
#define	BUFSIZE       512
#define DATA_MASK     0x1ff
#define NINTH_BIT     0x100

INT FIFO9BitDataWr(LPUINT16 buf,INT count,UINT32 ctrlflags,INT portnum,HCORE handleval);
INT FIFO9BitDataRd(LPUINT16 buf,INT count,LPUINT32 status,INT portnum,HCORE handleval);

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);


int main(void)
{
	HCARD	hCard;
	HCORE	hCore;
	ERRVAL	errval;
	INT		corenum;
	INT		tx_port;
	INT		rx_port;
	INT		j;
	UINT16	type;
	INT		count = 0;
	UINT16	databuf[BUFSIZE];
	INT		num_words;
	UINT32	status;
	INT		num_wr;
	INT 	ch;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP4  (08/21/2024)                                              *");
	consoleprintf("\n    *  Copyright 2004-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTI422 Example 4                                                  *");
	consoleprintf("\n    *  \"9 bit data example.\"                                             *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n");

/**
*
*  Open the card with the specified card number.
*  An error value is returned which is tested
*  to determine if an error occurred.
*
**/

	errval = BTICard_CardOpen(&hCard,CARDNUM);

	if (errval)
	{
		consoleprintf("\nError:  Either card number %u is not present, or",CARDNUM);
		consoleprintf("\n        an error occurred (%i) opening the card.",errval);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		exit(1);
	}

	consoleprintf("\nUsing Serial 422 card #%d",CARDNUM);

/**
*
*  Find the first two Serial 422 ports on the same core.
*
**/

	for (corenum=0;corenum<MAX_CORES;corenum++)
	{
		errval = BTICard_CoreOpen(&hCore,corenum,hCard);
		if (errval) break;

		for (tx_port=0;tx_port<MAX_PORTS;tx_port++)
		{
			if (BTI422_PortIs422(tx_port, hCore))
				if (BTI422_PortGetInfo(INFO422_RS422,tx_port,hCore))
					break;
		}

		if (tx_port == MAX_PORTS) continue;

		for (rx_port=tx_port+1;rx_port<MAX_PORTS;rx_port++)
		{
			if (BTI422_PortIs422(rx_port, hCore))
				if (BTI422_PortGetInfo(INFO422_RS422, rx_port, hCore))
					break;
		}

		if (rx_port != MAX_PORTS) break;
	}

	if (errval || corenum == MAX_CORES || rx_port == MAX_PORTS)
	{
		consoleprintf("\nError:  Two Serial 422 ports not present in Core on card %d.",CARDNUM);
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

	consoleprintf("\nUsing Serial 422 core #%d",corenum);
	consoleprintf("\nUsing tx port #%d and rx port #%d",tx_port, rx_port);
	consoleprintf("\n");


/**
*
*  Configure ports.
*
**/

	BTICard_CardReset(hCore);

	errval = BTI422_PortConfig(PORTCFG422_PARITYSPACE,BITRATE422_115200BPS,tx_port,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring port %d.",errval,tx_port);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCore));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

	errval = BTI422_PortConfig(PORTCFG422_PARITYSPACE,BITRATE422_115200BPS,rx_port,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring port %d.",errval,rx_port);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCore));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

/**
*
*  Init data.
*
**/

	for (j=0;j<BUFSIZE;j++) databuf[j] = (((count)+j) & DATA_MASK);
	num_wr = FIFO9BitDataWr(databuf,BUFSIZE,0,tx_port,hCore);

	if (num_wr != BUFSIZE)
	{
		consoleprintf("\nError:  FIFO9BitDataWr did not write correct number of bytes.");
		consoleprintf("\n        Expected: %d. Wrote %d",BUFSIZE,num_wr);
		BTICard_CardClose(hCard);
		exit(1);
	}

/**
*
*  Configure the Event Log list.
*
**/

	errval = BTICard_EventLogConfig(LOGCFG_ENABLE,256,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring the event log list.",errval);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCore));
		BTICard_CardClose(hCard);
		exit(1);
	}

/**
*
*  Configure FIFO Threshold.
*
**/

	errval = BTI422_FIFOConfigRx(FIFOCFG422_RXTHRESHOLD,512,rx_port,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring the RX FIFO threshold.",errval);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCore));
		BTICard_CardClose(hCard);
		exit(1);
	}

/**
*
*  Start operation of the card.
*
**/

	BTICard_CardStart(hCore);

/**
*
*  Loop until a key is hit.
*
**/

	consoleprintf("\nPress any key to exit.");
	consoleprintf("\n");

	while (1)
	{
		ch = getch();
		if (ch != ERR) break;

		if (BTICard_EventLogRd(&type,NULL,&rx_port,hCore))	//Read entry from Event Log list
		{
			if (type == EVENTTYPE_422RXTHRESHOLD)
			{
				num_words = FIFO9BitDataRd(databuf,BUFSIZE,&status,rx_port,hCore);

				if(num_words != BUFSIZE)
					consoleprintf("\nDid not receive expected number of words. Exp #%d, Got #%d",BUFSIZE,num_words);

				for (j=0;j<BUFSIZE;j++)
					if(databuf[j] != (((count)+j)& DATA_MASK))
						consoleprintf("\nError in data received. Exp #%X, Got #%X",count+j,databuf[j]);

				count++;

				for (j=0;j<BUFSIZE;j++) databuf[j] = (((count)+j) & DATA_MASK);
				FIFO9BitDataWr(databuf,BUFSIZE,0,tx_port,hCore);

				consoleprintf("\nUpdated data for port%1d. (count = %d)",tx_port,count);

			}
		}
	}
	consoleprintf("\n");

/**
*
*  Stop the card.
*
**/

	BTICard_CardStop(hCore);

/**
*
*  The card MUST be closed before exiting the program.
*
**/

	BTICard_CardClose(hCard);

	consoleexit(0);
	return(0);
}

/**
*
*  Use the parity bit as the 9th data bit by forcing parity error to match input bit.
*
**/

INT FIFO9BitDataWr(LPUINT16 buf,INT count,UINT32 ctrlflags,INT portnum,HCORE handleval)
{
	INT j;
	UINT32 configval;
	BYTE byte_tx;

	for(j=0;j<count;j++)
	{
		byte_tx = (BYTE)(buf[j] & 0xFF);
		configval = ctrlflags;

		if(buf[j] & NINTH_BIT) configval |= WRDCFG422_PARERR;

		if(!BTI422_FIFODataWr(&byte_tx,1,configval,portnum,handleval))
		{
			consoleprintf("Unable to write data to card on word #%d",j);
			break;
		}
	}

	return(j);
}

/**
*
*  Reconstruct the 9bit word using the parity error flag.
*
**/

INT FIFO9BitDataRd(LPUINT16 buf,INT count,LPUINT32 status,INT portnum,HCORE handleval)
{
	INT j;
	INT num_rd;

	FIFOFIELDS422 fifofields[BUFSIZE];

	for(j=0;j<BUFSIZE;j++)
	{
		fifofields[j].data = 0;
		fifofields[j].status = 0;
		fifofields[j].timetag = 0;
		fifofields[j].timetagh = 0;
	}

	num_rd = BTI422_FIFOBlockRd(&fifofields[0], BUFSIZE, portnum, handleval);

	for (j=0;j<num_rd;j++)
	{
		if(fifofields[j].status & WRDSTAT422_PARERR)
			buf[j] = (UINT16)fifofields[j].data | NINTH_BIT;
		else
			buf[j] = (UINT16)fifofields[j].data;

		*status |= (fifofields[j].status & ~WRDSTAT422_PARERR);
	}

	return(num_rd);
}

void consoleentry(void)
{
    initscr();
    cbreak();
    keypad(stdscr,TRUE);
    noecho();
    nonl();
    intrflush(stdscr,FALSE);
    timeout(0);
    scrollok(stdscr,TRUE);
}

void consoleexit(INT value)
{
    consoleprintf("\n");
    endwin();
    exit(value);
}

void consoleprintf(const char * str, ...)
{
    CHAR buf[1024];
    va_list arg_maker;

    va_start(arg_maker,str);
    vsnprintf(buf,1024,str,arg_maker);
    va_end(arg_maker);
    printw(buf);
    refresh();
}
