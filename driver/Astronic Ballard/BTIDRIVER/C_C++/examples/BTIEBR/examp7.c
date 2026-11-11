
/**
*
*  BTIEBR DRIVER EXAMPLE 7  (05/13/2024)
*  Copyright 2013-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP7.C -- Errors in BC Transmissions - Scheduled Messages
*
**/

/**
*
*  This example requires a Ballard EBR Level M Device.
*  It configures Card Number 0 as a BC and creates a schedule
*  containing a receive command each for terminal address 1
*  and terminal address 2.  Both receive commands send 2 data
*  words to the remote terminal.  The example then alternates
*  a bit count error between the first data word of both
*  commands.
*
**/

#include "BTICard.h"
#include "BTIEBR.h"
#include <ncurses.h>
#include <stdlib.h>

#define	CARDNUM		  0
#define	MAX_CORES     4
#define	MAX_CHANNELS  32

#define	FRAMETIME	10000			/*Frame time in tenths of microseconds*/

#ifndef	TRUE
#define	TRUE 1
#endif

#ifndef	FALSE
#define	FALSE 0
#endif

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);

int main(void)
{
	HCARD   hCard;					/*Handle to card*/
	HCORE   hCore;					/*Handle to core*/
	ERRVAL  errval;					/*Error return value*/
	INT   	corenum;				/*Core number*/
	INT   	channum;				/*Channel number*/
	INT     ch;

	MSGADDR		BCMsgs[2];
	INT			ErrorCount = 0;
	UINT16		InitialData1;
	UINT16		InitialData2;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP7  (05/13/2024)                                              *");
	consoleprintf("\n    *  Copyright 2013-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTIEBR Example 7                                                  *");
	consoleprintf("\n    *  \"Errors in BC Transmissions - Scheduled Messages\"                 *");
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
*  Find the first EBR core with Level M capability.
*
**/

	for (corenum=0;corenum<MAX_CORES;corenum++)
	{
		errval = BTICard_CoreOpen(&hCore,corenum,hCard);
		if (errval) break;

		for (channum=0;channum<MAX_CHANNELS;channum++)
		{
			if ( BTIEBR_ChGetInfo(INFOEBR_ERRORGEN,channum,hCore) ) break;
		}

		if (channum != MAX_CHANNELS) break;
	}

	if (errval || corenum == MAX_CORES || channum == MAX_CHANNELS)
	{
		consoleprintf("\nError:  No EBR Level M channels present in card %d.",CARDNUM);
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
		consoleprintf("\nError:  An error was encountered (%i) while configuring for",errval);
		consoleprintf("\n        bus controller mode on channel #%d on core #%d.",channum,corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Create the message records.
*
**/

	BCMsgs[0] = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,0x0842,&InitialData1,0,hCore);
	BCMsgs[1] = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,0x1042,&InitialData2,0,hCore);

/**
*
*  Schedule the messages to create the desired bus controller
*  schedule.
*
**/

	BTIEBR_BCSchedFrame(FRAMETIME,channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[0],channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[1],channum,hCore);

/**
*
*  Define the type of error generation.  One of the bus
*  controller messages is tagged to generate errors once.
*
**/

	BTIEBR_ErrorDefine(ERRDEFEBR_CNTBIT,3,2,0,0,channum,hCore);
	BTIEBR_ErrorTagBC(TRUE,BCMsgs[0],channum,hCore);
	BTIEBR_ErrorCtrl(ERRCTRLEBR_ONCE | ERRCTRLEBR_TAGMSG,channum,hCore);

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
/**
*
*  When the error is generated once, tag another message for
*  error generation and enable another single error.
*
**/

		if (BTIEBR_ErrorSent(channum,hCore) /*AND ANOTHER ERROR DESIRED*/)
		{
			if ((++ErrorCount) & 1)
			{
				BTIEBR_ErrorTagBC(FALSE,BCMsgs[0],channum,hCore);
				BTIEBR_ErrorTagBC(TRUE, BCMsgs[1],channum,hCore);
			}
			else
			{
				BTIEBR_ErrorTagBC(TRUE, BCMsgs[0],channum,hCore);
				BTIEBR_ErrorTagBC(FALSE,BCMsgs[1],channum,hCore);
			}

			BTIEBR_ErrorCtrl(ERRCTRLEBR_ONCE | ERRCTRLEBR_TAGMSG,channum,hCore);
		}
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
