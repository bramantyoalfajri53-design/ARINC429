
/**
*
*  BTIEBR DRIVER EXAMPLE 9  (05/13/2024)
*  Copyright 2013-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP9.C -- Event Log using Interrupts
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
*  entry after each 1ms frame.  An interrupt handler is installed
*  which enables the Event Log List to generate an interrupt when an
*  entry is made to the list.  Upon each interrupt, the data
*  words associated with the 0843H BC-RT message are updated.
*
**/

#include "BTICard.h"
#include "BTIEBR.h"
#include <ncurses.h>
#include <stdlib.h>
#include <pthread.h>
#include <sys/poll.h>

#define	CARDNUM		  0
#define	MAX_CORES     4
#define	MAX_CHANNELS  32

#define CMD0		0x0843			/*Command word for first message*/
#define CMD1		0x0821			/*Command word for second message*/
#define CMD2	    0x1C21			/*Command word for third message*/

#define	FRAMETIME	10000			/*Frame time in tenths of microseconds*/

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);

typedef struct                      /*Variables used by the thread*/
{
	volatile BOOL fStayAlive;       /*Flag indicating the thread should stay alive*/
	volatile BOOL fThreadHasQuit;   /*Flag indicating the thread has quit*/
	volatile UINT32 Count;           /*Counting variable*/
	volatile UINT16 Data[3];        /*Data values transmitted by BCMsgs[0]*/
	MSGADDR  BCMsgs[3];             /*Address of three BC messages*/
	HCORE	 hCore;                 /*Handle of core*/
} ThreadMailbox;

/**
*
*  The following thread is spun off by the main application.
*  It waits for the specified thread to be released when the
*  card generates an interrupt.  It then resets the event to
*  allow us to receive more events, reads an entry from the
*  Event Log list, and waits for the next event.
*
**/

LPVOID EventLogInterruptThread(LPVOID lpParam)
{
	UINT16 Type;
	UINT32  Info;
	struct pollfd eventlog_poll;


	ThreadMailbox *pMailbox = (ThreadMailbox*)lpParam;

	pMailbox->fStayAlive     = TRUE;
	pMailbox->fThreadHasQuit = FALSE;
	pMailbox->Count          = 0;

	eventlog_poll.fd         = 0;
	eventlog_poll.events     = POLLIN;
	eventlog_poll.revents    = 0;

	while(pMailbox->fStayAlive)
	{
		if (!eventlog_poll.fd)	//Wait for valid fd (after int install)
		{
			eventlog_poll.fd = (INT)BTICard_IntGet(pMailbox->hCore);
			continue;
		}

		if (poll(&eventlog_poll,1,200) > 0)
		{
			pMailbox->Count++;								//Increment counter

			//Read entry from Event Log list
			BTICard_EventLogRd(&Type,&Info,NULL,pMailbox->hCore);

			pMailbox->Data[0] += 2;							//Calculate the new data words
			pMailbox->Data[1] += 4;
			pMailbox->Data[2] += 6;

			//Write the new data words
			BTIEBR_MsgDataWr((LPUINT16)pMailbox->Data,3,pMailbox->BCMsgs[0],pMailbox->hCore);

			BTICard_IntClear(pMailbox->hCore);				//Clear interrupt from card
		}
	}

	pMailbox->fThreadHasQuit = TRUE;

	return(0);
}

int main(void)
{
	HCARD   hCard;					/*Handle to card*/
	HCORE   hCore;					/*Handle to core*/
	ERRVAL  errval;					/*Error return value*/
	INT   	corenum;				/*Core number*/
	INT   	channum;				/*Channel number*/
	INT     ch;

	pthread_t ThreadId;
	ThreadMailbox Mailbox;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP9  (05/13/2024)                                              *");
	consoleprintf("\n    *  Copyright 2013-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTIEBR Example 9                                                  *");
	consoleprintf("\n    *  \"Event Log using Interrupts\"                                      *");
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
*  Create a thread.
*
**/

	Mailbox.hCore    = hCore;

	errval = pthread_create(
		&ThreadId,                    //ID of Thread being created
		NULL,                         //Default attributes
		EventLogInterruptThread,      //Pointer to thread function
		(LPVOID)&Mailbox);            //Argument for new thread

	if (errval)
	{
		consoleprintf("\nError:  Thread creation failed (error = %d)",errval);
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Install the interrupt handler.
*
**/

	errval = BTICard_IntInstall(NULL,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while installing",errval);
		consoleprintf("\n        interrupt handler on core #%d.",corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		pthread_cancel(ThreadId);
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

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

	Mailbox.Data[0] = 0;
	Mailbox.Data[1] = 0;
	Mailbox.Data[2] = 0;

	Mailbox.BCMsgs[0] = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,CMD0,(LPUINT16)Mailbox.Data,0,hCore);
	Mailbox.BCMsgs[1] = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,CMD1,NULL,        0,hCore);
	Mailbox.BCMsgs[2] = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,CMD2,NULL,        0,hCore);

/**
*
*  Schedule the messages to create the desired bus controller
*  schedule.  Also schedule an Event Log after each frame.
*  Note the unique tag value associated with each Event Log
*  that could be used to distinguish unique Events.
*
**/

	BTIEBR_BCSchedFrame(FRAMETIME,          channum,hCore);
	BTIEBR_BCSchedMsg(Mailbox.BCMsgs[0],    channum,hCore);
	BTIEBR_BCSchedMsg(Mailbox.BCMsgs[1],    channum,hCore);
	BTIEBR_BCSchedMsg(Mailbox.BCMsgs[2],    channum,hCore);
	BTIEBR_BCSchedLog(CONDEBR_ALWAYS,0x1111,channum,hCore);

	BTIEBR_BCSchedFrame(FRAMETIME,          channum,hCore);
	BTIEBR_BCSchedMsg(Mailbox.BCMsgs[0],    channum,hCore);
	BTIEBR_BCSchedLog(CONDEBR_ALWAYS,0x2222,channum,hCore);

	BTIEBR_BCSchedFrame(FRAMETIME,          channum,hCore);
	BTIEBR_BCSchedMsg(Mailbox.BCMsgs[0],    channum,hCore);
	BTIEBR_BCSchedMsg(Mailbox.BCMsgs[1],    channum,hCore);
	BTIEBR_BCSchedLog(CONDEBR_ALWAYS,0x3333,channum,hCore);

	BTIEBR_BCSchedFrame(FRAMETIME,          channum,hCore);
	BTIEBR_BCSchedMsg(Mailbox.BCMsgs[0],    channum,hCore);
	BTIEBR_BCSchedLog(CONDEBR_ALWAYS,0x4444,channum,hCore);

/**
*
*  Configure the Event Log list.
*
**/

	errval = BTICard_EventLogConfig(LOGCFG_ENABLE,1024,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring the",errval);
		consoleprintf("\n        Event Log list on on core #%d.",corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_IntUninstall(hCard);
		pthread_cancel(ThreadId);
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

		consoleprintf("\rTransmitting data {%04XH, %04XH, %04XH}",Mailbox.Data[0],Mailbox.Data[1],Mailbox.Data[2]);
	}

/**
*
*  Clear the flag keeping the thread alive and wait for the
*  thread to quit.
*
**/

	consoleprintf("\nWaiting for the thread to quit.");

	Mailbox.fStayAlive = FALSE;		//Clear the fStayAlive flag so the thread commits suicide after the next interrupt

	pthread_join(ThreadId,NULL);

/**
*
*  Uninstall the interrupt handler.
*
**/

	errval = BTICard_IntUninstall(hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while uninstalling",errval);
		consoleprintf("\n        interrupt handler on core #%d.",corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		BTICard_CardClose(hCard);
		consoleexit(1);
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

	BTICard_IntUninstall(hCore);
	BTICard_CardClose(hCard);					/*Close the card*/

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
