
/**
*
*  BTIEBR DRIVER EXAMPLE 10  (05/13/2024)
*  Copyright 2013-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP10.C -- Polling the Event Log List
*
**/

/**
*
*  This example configures Card Number 0 as a bus controller
*  to transmit a schedule of three messages.  The schedule is
*  created in such a way that the messages are transmitted at
*  frequencies of 1000Hz, 500Hz, and 250Hz (or every 1ms, 2ms,
*  and 4ms, respectively).
*
*  The schedule is also configured to generate an Event Log List
*  entry after each 1ms frame.  When an entry is read from the list,
*  the data words associated with the 0843H BC-RT message is updated.
*
**/

#include "BTICard.h"
#include "BTIEBR.h"
#include <ncurses.h>
#include <stdlib.h>

#define	CARDNUM		  0
#define	MAX_CORES     4
#define	MAX_CHANNELS  32

#define CMD0		0x0843			/*Command word for first message*/
#define CMD1		0x0821			/*Command word for second message*/
#define CMD2     	0x1C21			/*Command word for third message*/

#define	FRAMETIME	10000			/*Frame time in tenths of microseconds*/

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);

int main(void)
{
	HCARD   hCard;					/*Handle to card*/
	HCORE   hCore;					/*Handle to core*/
	ERRVAL  errval;					/*Error return value*/
	INT   corenum;				/*Core number*/
	INT   channum;				/*Channel number*/
	INT     ch;

	MSGADDR BCMsgs[3];
	UINT16  Data[3] = {0,0,0};
	UINT16  type;
	UINT32  info;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP10  (05/13/2024)                                             *");
	consoleprintf("\n    *  Copyright 2013-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTIEBR Example 10                                                 *");
	consoleprintf("\n    *  \"Polling the Event Log List\"                                      *");
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
*  Create the message records for each of the three messages.
*
**/

	Data[0] = 0;
	Data[1] = 0;
	Data[2] = 0;

	BCMsgs[0] = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,CMD0,Data,0,hCore);
	BCMsgs[1] = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,CMD1,NULL,0,hCore);
	BCMsgs[2] = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,CMD2,NULL,0,hCore);

/**
*
*  Schedule the messages to create the desired bus controller
*  schedule.  Also schedule an Event Log after each frame.
*  Note the unique tag value associated with each Event Log
*  that could be used to distinguish unique Events.
*
**/

	BTIEBR_BCSchedFrame(FRAMETIME,          channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[0],            channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[1],            channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[2],            channum,hCore);
	BTIEBR_BCSchedLog(CONDEBR_ALWAYS,0x1111,channum,hCore);

	BTIEBR_BCSchedFrame(FRAMETIME,          channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[0],            channum,hCore);
	BTIEBR_BCSchedLog(CONDEBR_ALWAYS,0x2222,channum,hCore);

	BTIEBR_BCSchedFrame(FRAMETIME,          channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[0],            channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[1],            channum,hCore);
	BTIEBR_BCSchedLog(CONDEBR_ALWAYS,0x3333,channum,hCore);

	BTIEBR_BCSchedFrame(FRAMETIME,          channum,hCore);
	BTIEBR_BCSchedMsg(BCMsgs[0],            channum,hCore);
	BTIEBR_BCSchedLog(CONDEBR_ALWAYS,0x4444,channum,hCore);

/**
*
*  Configure the Event Log list.
*
**/

	errval = BTICard_EventLogConfig(LOGCFG_ENABLE,1024,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring",errval);
		consoleprintf("\n        event log list on core #%d.",corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
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

		if (BTICard_EventLogRd(&type,&info,NULL,hCore))
		{
			/*Calculate the new data words*/
			Data[0] += 2;
			Data[1] += 4;
			Data[2] += 6;

			/*Write the new data words*/
			BTIEBR_MsgDataWr(Data,3,BCMsgs[0],hCore);

			consoleprintf("\rTransmitting data {%04XH, %04XH, %04XH}",Data[0],Data[1],Data[2]);
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
