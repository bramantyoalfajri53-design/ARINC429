
/**
*
*  BTI429 DRIVER EXAMPLE 14  (08/21/2024)
*  Copyright 2004-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP14.C -- Example 14.
*                      "Program to get BNR from ARINC words"
*
**/

/**
*
*  This is a utility function example program and does not access
*  any Device hardware. This program will recreate Table 6-2 "BNR
*  DATA ENCODING EXAMPLES" from the ARINC SPECIFICATION 429, PART 1.
*
*  NOTE: This example is intended to recreate a specific page in the
*  ARINC specification. As such, the ARINC data is presented verbatim.
*  When operating Ballard hardware, the ARINC label should be
*  presented in human readable order, NOT ARINC order as this table
*  shows. See the BTI429 Programming Manual for more details.
*
**/

#include "BTI429.h"
#include <ncurses.h>
#include <stdlib.h>

void consoleprintf(const char *, ...);
void consoleentry(void);
void consoleexit(INT);

/********************************
*
*	BNR
*
*********************************/

double BTI429_BNRGetValDbl(UINT32 msg,UINT16 sigbit,double dblResolution)
{
	double dblResult;

	dblResult = BTI429_BNRGetMant(msg, sigbit) * dblResolution;

	if (BTI429_BNRGetSign(msg))	dblResult = -dblResult;

	return(dblResult);
}

UINT32 BTI429_BNRPutValDbl(double dblVal, UINT32 msg,UINT16 sigbit,double dblResolution)
{
	UINT32 ulResult;
	UINT32 mantissa;
	BOOL bNegative;

	bNegative = (0>dblVal) ? 1:0;									//Record if value is negative

	if (bNegative)	dblVal = -dblVal;								//If negative, make positive

	mantissa = (UINT32)(dblVal / dblResolution);						//Scale to remove decimal

	ulResult = BTI429_BNRPutMant(msg, mantissa, sigbit, bNegative);	//Fold in original message

	return(ulResult);
}

/********************************
*
*	BNR Angular
*
*********************************/

double BTI429_BNRAngularGetValDbl(UINT32 msg, UINT16 sigbit, BOOL bPlusMinus180)
{
	double dblResult;
	double dblResolution;

	dblResolution = 180.0;
	dblResolution /= (1<<sigbit);

	dblResult = BTI429_BNRGetValDbl(msg, sigbit, dblResolution);

	if (!bPlusMinus180 && 0>dblResult)	dblResult = dblResult + 360.0;

	return(dblResult);
}

UINT32 BTI429_BNRAngularPutValDbl(double dblVal, UINT32 msg, UINT16 sigbit)
{
	UINT32 ulResult;
	double dblResolution;

	dblResolution = 180.0;
	dblResolution /= (1<<sigbit);

	if (dblVal > 180)	dblVal = dblVal - 360;

	ulResult = BTI429_BNRPutValDbl(dblVal, msg, sigbit, dblResolution);

	return(ulResult);
}

/********************************
*
*	MAIN
*
*********************************/

int main(void)
{
	UINT32 msg;

	consoleentry();

	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  EXAMP14  (08/21/2024)                                             *");
	consoleprintf("\n    *  Copyright 2004-2024  Astronics Advanced Electronic Systems Corp.  *");
	consoleprintf("\n    *  Kirkland WA USA                                                   *");
	consoleprintf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    *  BTI429 Example 14                                                 *");
	consoleprintf("\n    *  \"Program to get BNR from ARINC words\"                             *");
	consoleprintf("\n    *                                                                    *");
	consoleprintf("\n    **********************************************************************");
	consoleprintf("\n\n");

	consoleprintf("\t\t\t\tTable 6-2\n");
	consoleprintf("\t\t\tBNR DATA ENCODING EXAMPLES\n\n");

	consoleprintf("\tPARAMETER\t  (Label)\tMSG\t\tRESULT\n");
	consoleprintf("    ----------------------------------------------------------------------\n");

	msg = 0x60000002;
	consoleprintf(" %30s","Selected Course (100)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRAngularGetValDbl(msg, 12, 1));
	consoleprintf(" Deg.\n");

	msg = 0x6D550082;
	consoleprintf(" %30s","Selected Heading (101)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRAngularGetValDbl(msg, 12, 1));
	consoleprintf(" Deg.\n");

	msg = 0xEA028042;
	consoleprintf(" %30s","Selected Altitude (102)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 16, 1.0));
	consoleprintf(" Ft.\n");

	msg = 0x6D3800C2;
	consoleprintf(" %30s","Selected Airspeed (103)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.1f",BTI429_BNRGetValDbl(msg, 11, 0.25));
	consoleprintf(" Knots\n");

	msg = 0xFDD80022;
	consoleprintf(" %30s","Selected Vertical Speed (104)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 10, 16.0));
	consoleprintf(" Ft/Min\n");

	msg = 0xE3200062;
	consoleprintf(" %30s","Selected Mach (106)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 12, 1.0));
	consoleprintf(" m Mach.\n");

	msg = 0x78720032;
	consoleprintf(" %30s","Desired Track (114)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRAngularGetValDbl(msg, 12, 0));
	consoleprintf(" Deg.\n");

	msg = 0xE6600072;
	consoleprintf(" %30s","Cross Track Distance (116)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.1f",BTI429_BNRGetValDbl(msg, 15, 0.004));
	consoleprintf(" NM\n");

	msg = 0x64B000F2;
	consoleprintf(" %30s","Vertical Deviation (117)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 11, 1.0));
	consoleprintf(" Ft.\n");

	msg = 0xE2AB0006;
	consoleprintf(" %30s","Flight Director Roll (140)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRAngularGetValDbl(msg, 12, 1));
	consoleprintf(" Deg.\n");

	msg = 0xF0E40086;
	consoleprintf(" %30s","Flight Director Pitch (141)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRAngularGetValDbl(msg, 12, 1));
	consoleprintf(" Deg.\n");

	msg = 0x67800046;
	consoleprintf(" %30s","Fast/Slow (142)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 12, 0.008));
	consoleprintf(" Knots\n");

/*	msg = 0x6972A016;
	consoleprintf(" %30s","Greenwich Mean Time (150)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t(%f)",BTI429_BNRGetValDbl(msg, 12, 0.0178125));
	consoleprintf("\n");
*/
	msg = 0x64C9002E;
	consoleprintf(" %30s","Radio Height (164)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 16, 0.125));
	consoleprintf(" Ft.\n");

	msg = 0xE0D800DE;
	consoleprintf(" %30s","Localizer Deviation (173)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%1.03f",BTI429_BNRGetValDbl(msg, 12, 0.0001));
	consoleprintf(" DDM\n");

	msg = 0xFD80003E;
	consoleprintf(" %30s","Glide Slope Deviation (174)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%1.03f",BTI429_BNRGetValDbl(msg, 12, 0.0002));
	consoleprintf(" Deg.\n");

	msg = 0x680EE041;
	consoleprintf(" %30s","DME Distance (202)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%1.2f",BTI429_BNRGetValDbl(msg, 16, 0.008));
	consoleprintf(" NM\n");

	msg = 0x657E40C1;
	consoleprintf(" %30s","Altitude (29.92) (203)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 17, 1.0));
	consoleprintf(" Ft.\n");

	msg = 0x634080A1;
	consoleprintf(" %30s","Mach (205)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%1.4f",BTI429_BNRGetValDbl(msg, 16, 0.0000625));
	consoleprintf(" Mach\n");

	msg = 0xE6A40061;
	consoleprintf(" %30s","Computed Airspeed (206)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 14, 0.0625));
	consoleprintf(" Knots\n");

	msg = 0x646A0011;
	consoleprintf(" %30s","True Airspeed (210)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 15, 0.0625));
	consoleprintf(" Knots\n");

	msg = 0x606800D1;
	consoleprintf(" %30s","Static Air Temp (213)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 11, 0.25));
	consoleprintf(" Deg. C\n");

	msg = 0x7F320091;
	consoleprintf(" %30s","Total Air Temp (211)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 11, 0.25));
	consoleprintf(" Deg. C\n");

	msg = 0x788E0051;
	consoleprintf(" %30s","Altitude Rate (212)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 11, 16.0));
	consoleprintf(" Ft/Min\n");

	msg = 0xE73EA813;
	consoleprintf(" %30s","Present Pos. Lat. (310)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\tN %.1f",BTI429_BNRGetValDbl(msg, 20, 0.000172));
	consoleprintf(" Deg\n");

	msg = 0x7716C093;
	consoleprintf(" %30s","Present Pos. Long. (311)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\tW %.1f",BTI429_BNRGetValDbl(msg, 20, 0.000172));
	consoleprintf("\n");

	msg = 0xE28A0053;
	consoleprintf(" %30s","Ground Speed (312)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%.0f",BTI429_BNRGetValDbl(msg, 15, 0.125));
	consoleprintf(" Knots\n");

	msg = 0x6A0500CB;
	consoleprintf(" %30s","Flight Path Accel (323)");
	consoleprintf("\t\t%08X",msg);
	consoleprintf("\t%1.2f",BTI429_BNRGetValDbl(msg, 12, 0.001));
	consoleprintf(" g\n");

	consoleprintf("\n\n");

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
