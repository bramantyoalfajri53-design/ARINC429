
/**
*
*  BTICard DRIVER EXAMPLE 2  (08/21/2024)
*  Copyright 2009-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP2.C -- Toggling LED and DIO
*
**/

/**
*
*  This example opens Card Number 0 and finds the first
*  digital out (DOUT) signal.  The user presses the spacebar
*  to toggle the DOUT and card LED light on and off.
*
**/

#include <BTICard.h>
#include <ncurses.h>
#include <stdlib.h>
#include <string.h>

#define	CARDNUM 0
#define CORENUM 0

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);

/**
*
*  This helper function determines the first DOUT number by
*  looking at the board information.
*
**/

INT BTICard_GetFirstDOUTNum(HCARD hCard)
{
	switch (BTICard_CardGetInfo(INFOTYPE_HWGEN, 0, hCard))
	{
		case 3:	return 3;	/*3RD GEN*/
		case 4:	return 5;	/*4TH GEN*/
		case 5:	/*5TH GEN*/
			if ((strcmp(BTICard_CardTypeStr(hCard), "NG3") == 0) || (strcmp(BTICard_CardTypeStr(hCard), "NG2") == 0))
			{
				return 1;
			}
			else
			{
				return 9;
			}
		case 6:	return 1;	/*6TH GEN*/
	}

	return -1;
}

int main(void)
{
	HCARD  hCard;					/*Handle to card*/
	HCORE  hCore;					/*Handle to core*/
	ERRVAL errval;					/*Error return value*/
	INT    doutnum;

	int  done;
	int  val;
	char ch;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP2  (08/21/2024)                                              *");
	consoleprintf("\n    *  Copyright 2009-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTICard Example 2                                                 *");
	consoleprintf("\n    *  \"Toggling LED and DIO\"                                            *");
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
	consoleprintf("\nUsing BTICard card #%d",CARDNUM);

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
*  Determine the DOUT number.
*
**/

	doutnum = BTICard_GetFirstDOUTNum(hCard);

	if (doutnum < 0)
	{
		consoleprintf("\nError:  Unable to determine the DOUT number.");
		consoleprintf("\n");
		BTICard_CardClose(hCard);
		consoleexit(1);
	}
	consoleprintf("\nUsing DOUT number #%d",doutnum);

/**
*
*  Start operation of the card.
*
**/

	BTICard_CardStart(hCore);

/**
*
*  Display data
*
**/

	done = 0;		/* We are '!done' */
	ch = '?';		/* invalid data */
	val = 0;		/* DOUT un-set */

	consoleprintf("\n\nPress ESC to exit, <SPACE> to toggle DOUT and LED....\n\n");

	/* Print current values */
	consoleprintf("\rDOUT and LED are %s",(val ? (" ON") : ("OFF")));

	while(!done)
	{
		ch = getch();	/* get the last key pressed */
		switch(ch)
		{
		case 0x1B:	/* ESC */
			done = 1;	/* We are done */
			break;

/***
*
*	On command, toggle the value of the selected DOUT and of the board LED.
*	These are done through native API functions. The LED is lock stepped to
*	the DOUT line.
*
***/
		case ' ':	/* <SPACE> */
			val = val ? 0 : 1;											/* invert output value */
			BTICard_ExtDIOWr(doutnum,val,hCore);						/* write value to DOUT */
			BTICard_ExtStatusLEDWr(val, 0, hCore);						/* write value to LED */
			consoleprintf("\rDOUT and LED are %s",(val ? (" ON") : ("OFF")));	/* Print current values */
			break;

		default:	/* All else, do nothing */
			break;
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
