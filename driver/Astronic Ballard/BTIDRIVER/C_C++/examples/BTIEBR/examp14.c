
/**
*
*  BTIEBR DRIVER EXAMPLE 14  (05/13/2024)
*  Copyright 2013-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP14.C -- Simultaneous BC, RT, and monitor simulation in Link mode
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


	MSGADDR BCMsg;

	UINT16 seqbuf[2048];
	UINT32 seqcount;
	UINT32 blkcnt;
	LPSEQRECORDEBR pRecEBR;
	SEQFINDINFO sfinfo;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP14  (05/13/2024)                                             *");
	consoleprintf("\n    *  Copyright 2013-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTIEBR Example 14                                                 *");
	consoleprintf("\n    *  \"Simultaneous BC, RT, and MON simulation in Link mode.\"           *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    **********************************************************************");

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
			if ( BTIEBR_ChGetInfo(INFOEBR_MULTIMODE,channum,hCore) ) break;
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
*  Configure Logical Hub for Link mode.
*
*  This also enables all ports on the core and maps the
*  matching RT Link (e.g. port 0 to link 0, port 1 to
*  link 1, etc.)
*
**/

	errval = BTIEBR_LHubConfig(LHUBCFGEBR_LINK,channum,hCore);	/*Configure the LHub*/

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
*  Create a bus controller message and insert into the bus
*  controller schedule. Note rtlink is 1, meaning message
*  will only be transmitted on link 1. Also note that taval
*  within the command word is zeroed out as required by the
*  EBR Logical Hub Link mode.
*
**/

	BCMsg = BTIEBR_BCCreateMsg(MSGCRTEBR_DEFAULT,0x0043,NULL,1,hCore);

	BTIEBR_BCSchedFrame(FRAMETIME,channum,hCore);
	BTIEBR_BCSchedMsg(BCMsg,channum,hCore);

/**
*
*  Configure the channel for remote terminal mode as shown in
*  Example 3.
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
*  Configure the channel for monitor mode as shown in Example 4.
*
**/

	errval = BTIEBR_MonConfig(MONCFGEBR_DEFAULT,channum,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring for",errval);
		consoleprintf("\n        monitor mode on channel #%d on core #%d.",channum,corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

	errval = BTIEBR_MonFilterRTLink(0x00000002,channum,hCore);	/*Monitor RT Link 1*/

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring the",errval);
		consoleprintf("\n        monitor filter on channel #%d on core #%d.",channum,corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Configure the sequential record.
*
**/

	errval = BTICard_SeqConfig(SEQCFG_DEFAULT,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring the",errval);
		consoleprintf("\n        sequential record on on core #%d.",corenum);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Start the card to begin transmitting, receiving and monitoring messages.
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

		seqcount = BTICard_SeqBlkRd(seqbuf,sizeof(seqbuf)/sizeof(seqbuf[0]),&blkcnt,hCore);

		BTICard_SeqFindInit(seqbuf,seqcount,&sfinfo);

		while(!BTICard_SeqFindNextEBR(&pRecEBR,&sfinfo))
		{
			consoleprintf("\n");

			consoleprintf(" Ch:%u",(pRecEBR->activity & MSGACTEBR_CHMASK) >> MSGACTEBR_CHSHIFT);
			consoleprintf(" Time:%lu",pRecEBR->timestamp);

			if (pRecEBR->activity & MSGACTEBR_RCVCWD) consoleprintf(" Cwd:%04X",pRecEBR->cwd);
			if (pRecEBR->activity & MSGACTEBR_RCVCWD) consoleprintf(" Cwd Link:%04X",(pRecEBR->cwdinfo&CWDINFOEBR_LINKMASK)>>CWDINFOEBR_LINKSHIFT);
			if (pRecEBR->activity & MSGACTEBR_RCVSWD) consoleprintf(" Swd:%04X",pRecEBR->swd);
			if (pRecEBR->activity & MSGACTEBR_RCVSWD) consoleprintf(" Swd Link:%04X",(pRecEBR->swdinfo&SWDINFOEBR_LINKMASK)>>SWDINFOEBR_LINKSHIFT);
			if (pRecEBR->activity & MSGACTEBR_RCVSWD) consoleprintf(" RespTime:%u",pRecEBR->resptime);

			if (pRecEBR->error & MSGERREBR_NORESP) consoleprintf(" No response!");
			if (pRecEBR->error & MSGERREBR_ANYERR) consoleprintf(" Error!");
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
