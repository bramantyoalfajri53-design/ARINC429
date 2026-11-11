
/**
*
*  BTI1553 DRIVER EXAMPLE 34  (08/21/2024)
*  Copyright 2001-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP34.C -- Simultaneous BC, RT, and monitor simulation with sequential DMA
*
**/

#include "BTICard.h"
#include "BTI1553.h"
#include <stdio.h>
#include <stdlib.h>
#include <sys/time.h>

#define	CARDNUM       0
#define	MAX_CORES     4
#define	MAX_CHANNELS  32

#define	FRAMETIME	500000			/*Frame time in microseconds*/

UINT32 GetTickCount()
{
	struct timeval tv;
	UINT32 timerval;

	if (gettimeofday(&tv,NULL)) return(0);

	timerval = (tv.tv_sec * 1000) + (tv.tv_usec / 1000);

	return(timerval);
}

int main(void)
{
	HCARD   hCard;					/*Handle to card*/
	HCORE   hCore;					/*Handle to core*/
	ERRVAL  errval;					/*Error return value*/
	INT     corenum;				/*Core number*/
	INT     channum=0;				/*Channel number*/

	UINT16 seqbuf[2048];
	UINT32  seqcount;
	LPSEQRECORD1553 pRec1553;
	SEQFINDINFO sfinfo;

	INT wait;
	UINT32 dwTickPrev=0;
	UINT32 dwTickCurr;

	MSGADDR BCMsg;

	printf("\n    **********************************************************************");
	printf("\n    *                                                                    *");
	printf("\n    *  EXAMP34  (08/21/2024)                                             *");
	printf("\n    *  Copyright 2001-2024  Astronics Advanced Electronic Systems Corp.  *");
	printf("\n    *  Kirkland WA USA                                                   *");
	printf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	printf("\n    *                                                                    *");
	printf("\n    *  BTI1553 Example 34                                                *");
	printf("\n    *  \"Simultaneous BC, RT, and monitor simulation example w/ DMA.\"     *");
	printf("\n    *                                                                    *");
	printf("\n    **********************************************************************");
	printf("\n");

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
		printf("\nError:  Either card number %u is not present, or",CARDNUM);
		printf("\n        an error occurred (%i) opening the card.",errval);
		printf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		printf("\n");
		exit(1);
	}

	printf("\nUsing BTI1553 card #%d (%s,%s,S/N %04d)",CARDNUM,BTICard_CardTypeStr(hCard),BTICard_CardProductStr(hCard),BTICard_CardGetInfo(INFOTYPE_SERIALNUM,0,hCard));

/**
*
*  Find the first MIL-STD-1553 core with level M, C or D capability.
*
**/

	for (corenum=0;corenum<MAX_CORES;corenum++)
	{
		errval = BTICard_CoreOpen(&hCore,corenum,hCard);
		if (errval) break;

		for (channum=0;channum<MAX_CHANNELS;channum++)
		{
			if ( BTI1553_ChGetInfo(INFO1553_MULTIMODE,channum,hCore) ) break;
		}

		if (channum != MAX_CHANNELS) break;
	}

	if (errval || corenum == MAX_CORES || channum == MAX_CHANNELS)
	{
		printf("\nError:  No MIL-STD-1553 level M, C or D channels present in card #%d.",CARDNUM);
		printf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

	printf("\nUsing MIL-STD-1553 core #%d",corenum);
	printf("\nUsing MIL-STD-1553 channel #%d",channum);
	printf("\n");

/**
*
*  Configure the channel for bus controller mode.
*
**/

	BTICard_CardReset(hCore);                                       /*Reset the core*/

	errval = BTI1553_BCConfig(BCCFG1553_DEFAULT,channum,hCore);     /*Configure the core*/

	if (errval < 0)
	{
		printf("\nError:  An error was encountered (%i) while configuring for",errval);
		printf("\n        bus controller mode on channel #%d on core #%d.",channum,corenum);
		printf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		printf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

/**
*
*  Create a bus controller message and insert into the bus
*  controller schedule.
*
**/

	BTI1553_BCSchedFrame(FRAMETIME,channum,hCore);

	BCMsg = BTI1553_BCCreateMsg(MSGCRT1553_DEFAULT,0x0843,0,NULL,hCore);
	BTI1553_BCSchedMsg(BCMsg,channum,hCore);

	BCMsg = BTI1553_BCCreateMsg(MSGCRT1553_DEFAULT,0x0C25,0,NULL,hCore);
	BTI1553_BCSchedMsg(BCMsg,channum,hCore);

/**
*
*  Configure the channel for remote terminal mode as shown in
*  Example 3.
*
**/

	errval = BTI1553_RTConfig(RTCFG1553_DEFAULT,1,channum,hCore);

	if (errval < 0)
	{
		printf("\nError:  An error was encountered (%i) while configuring for",errval);
		printf("\n        remote terminal mode on channel #%d on core #%d.",channum,corenum);
		printf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		printf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

/**
*
*  Configure the channel for monitor mode as shown in Example 4.
*
**/

	errval = BTI1553_MonConfig(MONCFG1553_DEFAULT,channum,hCore);

	if (errval < 0)
	{
		printf("\nError:  An error was encountered (%i) while configuring for",errval);
		printf("\n        monitor mode on channel #%d on core #%d.",channum,corenum);
		printf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		printf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

/**
*
*  Configure the sequential record with DMA enabled
*
**/

	errval = BTICard_SeqConfig(SEQCFG_DMA,hCore);

	if (errval < 0)
	{
		printf("\nError:  An error was encountered (%i) while configuring the",errval);
		printf("\n        sequential record on on core #%d.",corenum);
		printf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		printf("\n");
		BTICard_CardClose(hCard);
		exit(1);
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

	for (wait=10;wait;)		//Run for 10 seconds
	{
		dwTickCurr = GetTickCount();

		if (dwTickCurr>dwTickPrev+1000)
		{
			dwTickPrev = dwTickCurr;

			--wait;
		}

		seqcount = BTICard_SeqDMARd(seqbuf,sizeof(seqbuf)/sizeof(seqbuf[0]),hCore);

		BTICard_SeqFindInit(seqbuf,seqcount,&sfinfo);

		while(!BTICard_SeqFindNext1553(&pRec1553,&sfinfo))
		{
			printf(" Core:%02d",corenum);
			printf(" Ch:%02u",(pRec1553->activity & MSGACT1553_CHMASK) >> MSGACT1553_CHSHIFT);
			printf(" Time:%08X",pRec1553->timestamp);

			if (pRec1553->activity & (MSGACT1553_RCVCWD1 | MSGACT1553_XMTCWD1)) printf(" Cwd1:%04X",pRec1553->cwd1);
			if (pRec1553->activity & (MSGACT1553_RCVCWD2 | MSGACT1553_XMTCWD2)) printf(" Cwd2:%04X",pRec1553->cwd2);
			if (pRec1553->activity & (MSGACT1553_RCVSWD1 | MSGACT1553_XMTSWD1)) printf(" Swd1:%04X",pRec1553->swd1);
			if (pRec1553->activity & (MSGACT1553_RCVSWD2 | MSGACT1553_XMTSWD2)) printf(" Swd2:%04X",pRec1553->swd2);

			if (pRec1553->error & MSGERR1553_NORESP) printf(" No response!");
			if (pRec1553->error & MSGERR1553_ANYERR) printf(" Error!");

			printf("\n");
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

	return(0);
}
