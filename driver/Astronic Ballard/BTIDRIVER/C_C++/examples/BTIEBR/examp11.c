
/**
*
*  BTIEBR DRIVER EXAMPLE 11  (05/13/2024)
*  Copyright 2013-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP11.C -- BC Transmission of Ramping Data Using a Circular Buffer
*
**/

/**
*
*  This example configures Card Number 0 as a bus controller
*  to transmit a schedule of one message.  The message is
*  transmitted at a frequency of 100Hz (or every 10ms).
*
*  A circular buffer of 10 entries is configured for the
*  message.  Each of the 10 entries in the buffer is
*  initialized with a unique set of data words.  When the
*  card is started, each set of data words is transmitted on
*  every cycle.
*
**/

#include "BTICard.h"
#include "BTIEBR.h"
#include <ncurses.h>
#include <stdlib.h>

#define	CARDNUM		  0
#define	MAX_CORES     4
#define	MAX_CHANNELS  32

#define CMD 0x0840					/*Command word for message*/

#define	FRAMETIME 100000			/*Frame time in tenths microseconds*/

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);

int main(void){
	HCARD   hCard;					/*Handle to card*/
	HCORE   hCore;					/*Handle to core*/
	ERRVAL  errval;					/*Error return value*/
	INT   	corenum;				/*Core number*/
	INT   	channum;				/*Channel number*/
	INT     ch;


	LISTADDR BCList;
	UINT16   Data[32];
	INT    j;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP11  (05/13/2024)                                             *");
	consoleprintf("\n    *  Copyright 2013-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTIEBR Example 11                                                 *");
	consoleprintf("\n    *  \"BC Transmission of Ramping Data Using a Circular Buffer\"         *");
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
		consoleexit(1);
	}

	consoleprintf("\nUsing BTIEBR card #%d (%s,%s,S/N %04d)",CARDNUM,BTICard_CardTypeStr(hCard),BTICard_CardProductStr(hCard),BTICard_CardGetInfo(INFOTYPE_SERIALNUM,0,hCard));

/**
*
*  Find the first EBR core and channel.
*
**/

	for (corenum=0;corenum<MAX_CORES;corenum++)
	{
		errval = BTICard_CoreOpen(&hCore,corenum,hCard);
		if (errval) break;

		for (channum=0;channum<MAX_CHANNELS;channum++)
			if (BTIEBR_ChIsEBR(channum,hCore)) break;

		if (channum != MAX_CHANNELS) break;
	}

	if (errval || corenum == MAX_CORES || channum == MAX_CHANNELS)
	{
		consoleprintf("\nError:  No EBR channels present in card #%d.",CARDNUM);
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

	consoleprintf("\nUsing EBR core #%d",corenum);
	consoleprintf("\nUsing EBR channel #%d",channum);
	consoleprintf("\n");

/**
*
*  Reset the core
*
**/

	BTICard_CardReset(hCore);										/*Reset the core*/

/**
*
*  Configure Logical Hub for Spec mode.
*
*  This also enables all ports on the core and maps the
*  matching RT Link (e.g. port 0 to link 0, port 1 to
*  link 1, etc.)
*
**/

	errval = BTIEBR_LHubConfig(LHUBCFGEBR_DEFAULT,channum,hCore);	/*Configure the LHub*/

	if (errval)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring LHub",errval);
		consoleprintf("\n        on channel #%d on core #%d.",channum,corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Configure the channel for bus controller mode.
*
**/

	errval = BTIEBR_BCConfig(BCCFGEBR_DEFAULT,channum,hCore);	/*Configure the core*/

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring bus",errval);
		consoleprintf("\n        controller mode on channel #%d on core #%d.",channum,corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Create the Circular List Buffer.
*
**/

	BCList = BTIEBR_BCCreateList(
		LISTCRTEBR_CIRCULAR,		/*List creation flags*/
		10,							/*List size*/
		MSGCRTEBR_DEFAULT,			/*Message creation flags*/
		CMD,						/*Command Word*/
		NULL,						/*Initial data (if any)*/
		0,							/*RT link*/
		hCore);						/*Device handle*/

/**
*
*  Schedule the messages to create the desired bus controller
*  schedule.
*
**/

	BTIEBR_BCSchedFrame(FRAMETIME,channum,hCore);
	BTIEBR_BCSchedMsg(BCList,     channum,hCore);

/**
*
*  Initialize the list with data words to ramp through.
*
**/

	for (j=0;j<32;++j) Data[j]=0;

	for (j=0;j<10;++j)
	{
		Data[0]=j;
		BTIEBR_ListDataWr(Data,32,BCList,hCore);
	}

/**
*
*  Start the card to begin transmissions.
*
**/

	BTICard_CardStart(hCore);

/**
*
*  Loop until a key is hit.
*
**/

	consoleprintf("\nPress any key to exit....\n\n");

	while (1)
	{
		ch = getch();
		if (ch != ERR) break;
	}

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
