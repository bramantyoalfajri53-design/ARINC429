
/**
*
*  BTIEBR DRIVER EXAMPLE 6  (05/13/2024)
*  Copyright 2013-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP6.C -- Errors in BC Transmissions - Unscheduled Messages
*
**/

/**
*
*  This example requires a Ballard EBR Level M Device.
*  It configures Card Number 0 as a BC and transmits a single
*  receive command containing a parity error in the command
*  word.
*
*  A No response is expected because of the parity error in the
*  command word.
*
**/

#include "BTICard.h"
#include "BTIEBR.h"
#include <ncurses.h>
#include <stdlib.h>

#define	CARDNUM		  0
#define	MAX_CORES     4
#define	MAX_CHANNELS  32

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);

int main(void)
{
	HCARD   hCard;					/*Handle to card*/
	HCORE   hCore;					/*Handle to core*/
	ERRVAL  errval;					/*Error return value*/
	INT		corenum;				/*Core number*/
	INT		channum;				/*Channel number*/

	XMITFIELDSEBR Msg;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP6  (05/13/2024)                                              *");
	consoleprintf("\n    *  Copyright 2013-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTIEBR Example 6                                                  *");
	consoleprintf("\n    *  \"Errors in BC Transmissions - Unscheduled Messages\"               *");
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
*  Create an empty frame in the BC Schedule.
*
*  BTIEBR_BCTransmitMsg uses an asynchronous Message Record
*  that is transmitted at the end of every frame.  Therefore,
*  even though we aren't scheduling messages, we must still
*  schedule a frame.
*
**/

	BTIEBR_BCSchedFrame(1000,channum,hCore);

/**
*
*  Initialize the message command and data words, and select
*  a BC->RT transfer.
*
**/

	Msg.ctrlflags	= MSGCRTEBR_BCRT;
	Msg.cwd			= 0x0843;
	Msg.data[0]		= 0x1234;
	Msg.data[1]		= 0x5678;
	Msg.data[2]		= 0x9ABC;

/**
*
*  Define the type of error generation.
*
**/

	errval = BTIEBR_ErrorDefine(ERRDEFEBR_PAR,0,0,ERRDEFEBR_CWD,0,channum,hCore);
	errval = BTIEBR_ErrorCtrl(ERRCTRLEBR_ONCE | ERRCTRLEBR_ANYMSG,channum,hCore);

/**
*
*  Start the card.
*
**/

	BTICard_CardStart(hCore);

/**
*
*  Transmit the message.
*
**/

	errval = BTIEBR_BCTransmitMsg(&Msg,channum,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while transmitting",errval);
		consoleprintf("\n        the message on channel #%d on core #%d.",channum,corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Test for any error results. No response is the expected result.
*
**/

	if (Msg.errflags & MSGERREBR_NORESP)		/*Was there a response?*/
	{
		consoleprintf("\nWarning:  No response was received from the RT.");
		consoleprintf("\n          Refer to the documentation for a");
		consoleprintf("\n          description of the error flags (%04XH).",Msg.errflags);
		consoleprintf("\n");
	}
	else if (Msg.errflags & MSGERREBR_ANYERR)	/*Was there an error?*/
	{
		consoleprintf("\nWarning:  An error occurred while receiving the response from the RT.");
		consoleprintf("\n          Refer to the documentation for a");
		consoleprintf("\n          description of the error flags (%04XH).",Msg.errflags);
		consoleprintf("\n");
	}
	else									/*There were no errors*/
	{
		consoleprintf("\nSuccess!  The message was completed successfully.");
		consoleprintf("\n          The RT returned the status word %04XH.",Msg.swd);
		consoleprintf("\n");
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
