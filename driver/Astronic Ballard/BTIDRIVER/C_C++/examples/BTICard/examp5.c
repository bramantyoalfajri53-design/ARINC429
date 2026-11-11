/**
*
*  BTICard DRIVER EXAMPLE 5  (08/21/2024)
*  Copyright 2004-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP5.C -- Polling Eventlog for BIT
*
**/

/**
*
*  This example configures Card Number 0 to report BIT
*  errors in the Eventlog as well as the Eventlog.
*  Once configured, the Eventlog is polled for a BIT Error
*  Event and if an error occurs, the error is decoded.
*
**/

#include <BTICard.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ncurses.h>

#define	CARDNUM		  0
#define CORENUM		  0
#define SYSMON_NUMSENSORS 16
#define TRUE 1
#define FALSE 0

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);

int main()
{
	HCARD   hCard;					/*Handle to card*/
	HCORE   hCore;					/*Handle to core*/
	ERRVAL  errval;					/*Error return value*/

	INT index;						/*Sensor index value*/
	BOOL enable;					/*Sensor logging enable value*/
	INT minval;						/*Sensor minimum threshold value*/
	INT maxval;						/*Sensor maximum threshold value*/

	UINT16  type;					/*Eventlog type*/
	UINT32   info;					/*Eventlog info*/

	INT timer;						/*Timer to see if Sensors are ready to be read*/
	INT ch;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP5  (08/21/2024)                                              *");
	consoleprintf("\n    *  Copyright 2004-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTICard Example 5                                                 *");
	consoleprintf("\n    *  \"BIT Eventlog Polling\"                                            *");
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

	consoleprintf("\nUsing BTICard card #%d",CARDNUM);

	errval = BTICard_CardOpen(&hCard,CARDNUM);

	if (errval)
	{
		consoleprintf("\nError:  Either card number %u is not present, or",CARDNUM);
		consoleprintf("\n        an error occurred (%i) opening the card.",errval);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		consoleexit(1);
	}

	errval = BTICard_CoreOpen(&hCore, CORENUM, hCard);

	if (errval)
	{
		consoleprintf("\nError:  Either core number %u is not present, or",CORENUM);
		consoleprintf("\n        an error occurred (%i) opening the core.",errval);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

	consoleprintf("\nUsing Core #%d",CORENUM);

/**
*
*  Check to make sure SysMon is supported on this card/core and configure it for EventLog
*
**/

	errval = BTICard_BITConfig( BITCFG_MEMECC_LOG |
								BITCFG_CARD_STOPPED_LOG |
								BITCFG_FPGA_LOG |
								BITCFG_SYSMON_LOG |
								BITCFG_PROTOCOL_LOG,hCore);


	if (errval)
	{
		consoleprintf("\nError:  Either SysMon is not supported on this card, or");
		consoleprintf("\n        an error occurred (%i) while Configuring BIT.",errval);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Set each of the sensors to enable reporting
*
**/

	for (index=0; index < SYSMON_NUMSENSORS; index++)
	{
		/**
		*
		*  Read User Settings (Available for Temperature Sensors)
		*
		**/

		errval = BTICard_SysMonThresholdGet(&enable,&minval,&maxval,index,hCore);

		if (!errval && !enable)
		{
			/**
			*
			*  Restore User Settings while setting the reporting enable
			*
			**/

			errval = BTICard_SysMonThresholdSet(TRUE,minval,maxval,index,hCore);
		}
	}

/**
*
*  Configure the Event Log list.
*
**/

	errval = BTICard_EventLogConfig(LOGCFG_ENABLE,1024,hCore);

	if (errval < 0)
	{
		consoleprintf("\nError:  An error was encountered (%i) while configuring",errval);
		consoleprintf("\n        event log list on core #%d.",CORENUM);
		consoleprintf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Verify that the sensor data is ready to be read
*
**/

	timer = BTICard_TickTimerStart(1000);

	while (BTICard_TickTimerValid(timer) && (BTICard_SysMonValRd(0,hCore) == SYSMONRD_NOTVALID));

	if (BTICard_SysMonValRd(0,hCore) == SYSMONRD_NOTVALID)
	{
		consoleprintf("\nError:  Sensors exceeded timeout to be valid");
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}

/**
*
*  Start the card
*
**/

	BTICard_CardStart(hCore);

/**
*
*  Loop until a key is hit.
*
**/

	consoleprintf("\nPress any key to exit....\n\n");

	while(1)
	{
		ch = getch();
		if (ch != ERR) break;

		if (BTICard_EventLogRd(&type,&info,NULL,hCore))
		{
			consoleprintf("\nType = %08x info = %08x",type,info);

			/**
			*
			*  Check to see if Event is a BIT Error
			*
			**/

			if (type == EVENTTYPE_BITERROR)
			{
				if (info & BITSTAT_CARD_STOPPED)
				{
					consoleprintf("\nCard Stopped Error");
				}

				if (info & BITSTAT_CBIT_FPGA_ERR)
				{
					consoleprintf("\nCard CBIT FPGA");
				}

				if (info & (BITSTAT_SINGLE_BIT_ERR | BITSTAT_DOUBLE_BIT_ERR))
				{
					consoleprintf("\nECC Memory Error");
				}

				if (info & BITSTAT_SYSMON_ERR)
				{
					consoleprintf("\nSysmon error, 0x%04X ",info & BITSTAT_SYSMON_ERR);

					for (index = 0;index < SYSMON_NUMSENSORS;index++)
					{
						if ((info & BITSTAT_SYSMON_ERR) & 1<<index)
						{
							consoleprintf("\n     Error on index:%i",index);
						}
					}
				}

				if (info & BITSTAT_PROTOCOL_ERR)
				{
					consoleprintf("\nProtocol Error");
				}
			}
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
