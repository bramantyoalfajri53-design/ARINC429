
/**
*
*  BTICard DRIVER EXAMPLE 1  (08/21/2024)
*  Copyright 2009-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP1.C -- Report BTIDriver devices
*
**/

/**
*
*  This example uses a special feature of the BTICard_CardOpen(...)
*  function to search the computer for registered Ballard BTIDriver
*  devices.  The program loops through the array of discovered
*  devices and outputs some generic card information.
*
**/

#include <BTICard.h>
#include <BTI422.h>
#include <BTI429.h>
#include <BTI708.h>
#include <BTI717.h>
#include <BTI1553.h>
#include <BTICSDB.h>
#include <BTIDIO.h>
#include <BTIEBR.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_CARDS    32
#define MAX_CORES    4
#define MAX_CHANNELS 32
#define MAX_PORTS    16
#define	MAX_BANKS    4

int main(void)
{
	HCARD hCard[MAX_CARDS];			/*Handle to card*/
	HCORE hCore;					/*Handle to core*/
	ERRVAL errval;					/*Error return value*/
	INT cardnum;					/*Card number*/
	INT corenum;					/*Core number*/
	INT channum;					/*Channel number*/
	INT cardcount=0;				/*Count of cards opened*/
	UINT16 j, jj;

	printf("\n    **********************************************************************");
	printf("\n    *                                                                    *");
	printf("\n    *  EXAMP1  (08/21/2024)                                              *");
	printf("\n    *  Copyright 2009-2024  Astronics Advanced Electronic Systems Corp.  *");
	printf("\n    *  Kirkland WA USA                                                   *");
	printf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	printf("\n    *                                                                    *");
	printf("\n    *  BTICard Example 1                                                 *");
	printf("\n    *  \"Report BTIDriver devices\"                                        *");
	printf("\n    *                                                                    *");
	printf("\n    **********************************************************************");
	printf("\n");

/**
*
*  Open a bogus card number to populate internal card count and card number array
*
**/

	BTICard_CardOpen(NULL,-1);

/**
*
*  Open each card number in the card number array, test returned error value
*
**/

	for (cardcount=0,j=0;j<BTICard_HandleTotalCount && cardcount<MAX_CARDS;++j)
	{
		// Get card number from internal array
		cardnum = BTICard_HandleCardNumbers[j];

		// Try to open card
		errval = BTICard_CardOpen(&hCard[cardcount],cardnum);

		if (errval)
		{
			printf("\nError:  Either card number %u is not present, or",cardnum);
			printf("\n        an error occurred (%i) opening the card.",errval);
			printf("\n        (%s)",BTICard_ErrDescStr(errval,hCard[cardcount]));
			printf("\n");
			continue;
		}

		// Print card type
		printf("\nOpening card #%d (%s,%s,S/N %04d)",cardnum,BTICard_CardTypeStr(hCard[cardcount]),BTICard_CardProductStr(hCard[cardcount]),BTICard_CardGetInfo(INFOTYPE_SERIALNUM,0,hCard[cardcount]));

/**
*
*  Loop through each core on the card
*  Report all protocols found
*
**/

		for (corenum=0;corenum<MAX_CORES;++corenum)
		{
			// Open the core
			hCore = -1;

			if (ERR_NONE==BTICard_CoreOpen(&hCore,corenum,hCard[cardcount]))
			{
				// Report all channels
				for (channum=0; channum<MAX_CHANNELS;++channum)
				{
					if      (BTI429_ChIs429(channum, hCore))   printf("\nOn card #%d, core #%d, found 429  channel #%d",cardnum,corenum,channum);
					else if (BTI708_ChIs708(channum, hCore))   printf("\nOn card #%d, core #%d, found 708  channel #%d",cardnum,corenum,channum);
					else if (BTI717_ChIs717(channum, hCore))   printf("\nOn card #%d, core #%d, found 717  channel #%d",cardnum,corenum,channum);
					else if (BTI1553_ChIs1553(channum, hCore)) printf("\nOn card #%d, core #%d, found 1553 channel #%d",cardnum,corenum,channum);
					else if (BTICSDB_ChIsCSDB(channum, hCore)) printf("\nOn card #%d, core #%d, found CSDB channel #%d",cardnum,corenum,channum);
					else if (BTIEBR_ChIsEBR(channum, hCore))   printf("\nOn card #%d, core #%d, found EBR  channel #%d",cardnum,corenum,channum);
				}

				// Report all ports
				for (jj=0;jj<MAX_PORTS;++jj)
				{
					if (BTI422_PortIs422(jj,hCore)) printf("\nOn card #%d, core #%d, found 422 port #%d",cardnum,corenum,jj);
				}

				// Report all dio banks
				for (jj=0;jj<MAX_BANKS;++jj)
				{
					if (BTIDIO_BankIsDIO(jj,hCore)) printf("\nOn card #%d, core #%d, found DIO bank #%d",cardnum,corenum,jj);
				}
			}
		}

/**
*
*  Keep running count of open cards
*
**/

		++cardcount;
	}

/**
*
*  All card MUST be closed before exiting
*
**/

	for (j=0;j<cardcount;++j)
	{
		BTICard_CardClose(hCard[j]);
	}

	printf("\n");

	exit(0);
}
