
/**
*
*  BTIEBR DRIVER EXAMPLE 8  (05/13/2024)
*  Copyright 2013-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP8.C -- Errors in RT Transmissions
*
**/

/**
*
*  This example requires a Ballard EBR Level M Device.
*  It configures Card Number 0 as an RT and configures a response
*  time error for transmit commands of subaddress 2.  Each time the
*  subaddress is accessed, the response time is incremented by
*  0.01us.
*
**/

#include "BTICard.h"
#include "BTIEBR.h"
#include <ncurses.h>
#include <stdlib.h>

#define	CARDNUM		  0
#define	MAX_CORES     4
#define	MAX_CHANNELS  32

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

	UINT16  GapLength;				/*Gap in units of 0.01us*/

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP8  (05/13/2024)                                              *");
	consoleprintf("\n    *  Copyright 2013-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTIEBR Example 8                                                  *");
	consoleprintf("\n    *  \"Errors in RT Transmissions\"                                      *");
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
		consoleprintf("\nError:  No EBR Level M channels present in card #%d.",CARDNUM);
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
*  Configure the channel for remote terminal mode.
*
**/

	errval = BTIEBR_RTConfig(RTCFGEBR_DEFAULT,1,channum,hCore);	/*Configure RT on link 1*/

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring for",errval);
		consoleprintf("\n        remote terminal mode on channel #%d on core #%d.",channum,corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Define the type and location of the gap.
*
**/

	GapLength = 120;					/*Set initial gap length to 1.2us (Each GapLength=0.01 microseconds)*/

	BTIEBR_ErrorDefine(ERRDEFEBR_GAP, /*Generate a gap*/
						GapLength, 		/*Set the length of the gap*/
						0, 				/*Unused parameter*/
						ERRDEFEBR_SWD,/*Gap precedes the status word*/
						0,				/*Unused parameter*/
						channum,		/*Channel number*/
						hCore);

	BTIEBR_ErrorTagRT(TRUE,SUBADDRESS,1,XMT,2,channum,hCore);
	BTIEBR_ErrorCtrl(ERRCTRLEBR_ONCE | ERRCTRLEBR_TAGMSG,channum,hCore);

/**
*
*  Start the card to begin responding to transmissions.
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

		if (BTIEBR_ErrorSent(channum,hCore) /*AND ANOTHER ERROR DESIRED*/)
		{
			BTIEBR_ErrorDefine(ERRDEFEBR_GAP,	/*Change the length of the gap*/
							++GapLength,		/*Set the length of the new gap*/
							0, 					/*Unused parameter*/
							ERRDEFEBR_SWD,		/*Gap precedes the status word*/
							0,					/*Unused parameter*/
							channum,			/*Channel number*/
							hCore);

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
