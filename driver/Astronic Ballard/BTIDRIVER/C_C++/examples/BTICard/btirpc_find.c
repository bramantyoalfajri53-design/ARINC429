/**
*
*  BTICard RPC FIND EXAMPLE  (08/21/2024)
*  Copyright 2004-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   btirpc_find.c -- Finds RPC cards
*
**/

/**
*
*  This example will perform a broadcast on the network and then
*  display information about each BTIDriver-compliant RPC card that
*  responds.  If an error is encountered, a message is displayed
*  indicating the type of error that occurred.
*
**/

#include <BTICard.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define TRUE 1
#define FALSE 0

extern ERRVAL BTIRPC_DiscoverEx(BOOL (*callback)(LPBTIIDENTIFY info,char * ipaddr));

BOOL headerdone = FALSE;
BOOL shortform  = FALSE;
INT	count = 0;

/**
*
*  This helper function checks for the help option on the
*  command line.
*
**/

int isarghelp(int argc,char *argv[])
{
	int j;

	for (j=0;j<argc;++j)
	{
		if (!strcmp(argv[j],"?") || !strcmp(argv[j],"-?") || !strcmp(argv[j],"/?"))
		{
			return(1);
		}
	}
	return(0);
}

/**
*
*  This helper function checks for options on the
*  command line.
*
**/

char *isargopt(int argc,char *argv[],const char *opts)
{
	UINT16 j;

	for (j=0;j<argc;++j)
	{
		if ((*argv[j]=='-' || *argv[j]=='/') && !strncmp(opts,argv[j]+1,strlen(opts)))
		{
			return(argv[j]+strlen(opts)+1);
		}
	}
	return(NULL);
}

static BOOL discover_callback(LPBTIIDENTIFY info,char * ipaddr)
{
	if (!headerdone && !shortform)
	{
		printf(" %-20s %-6s %-16s %-17s %-8s\n",  "Card Type",                "S/N", "IP Address",      "MAC Address",    "Model");
		printf("|%-20s|%-6s|%-16s|%-17s|%-8s|\n", "--------------------", "------", "----------------", "-----------------", "--------");
		headerdone = TRUE;
	}

	if (!shortform)
	{
		printf(" %-20s %-6s %-16s %-17s %-8s\n",info->type_string,info->serial_number,ipaddr,info->mac_address,info->card_string);
	}
	else
	{
		printf("%d,%s\n",count++,info->mac_address);
	}

	return(FALSE);
}

int main(INT argc,LPSTR *argv)
{
	ERRVAL errval;

	printf("\n    **********************************************************************");
	printf("\n    *                                                                    *");
	printf("\n    *  BTICard RPC FIND (08/21/2024)                                     *");
	printf("\n    *  Copyright 2004-2024  Astronics Advanced Electronic Systems Corp.  *");
	printf("\n    *  Kirkland WA USA                                                   *");
	printf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	printf("\n    *                                                                    *");
	printf("\n    **********************************************************************");
	printf("\n");
	printf("\n");
	printf("\n");

	if (isarghelp(argc,argv))
	{
		printf("\nUsage:  btirpc_find [options]");
		printf("\n");

		printf("\n-?                      Display help information");
		printf("\n-SHORT                  Display results in short form.");
		printf("\n");

		exit(0);
	}

	if (isargopt(argc,argv,"SHORT"))
	{
		shortform = TRUE;
	}

/**
*
*  Send discover broadcast
*
**/

	errval = BTIRPC_DiscoverEx(discover_callback);

	if (errval)
	{
		printf("\nError:  Discover failed.");
		printf("\n");
		exit(1);
	}

	exit(0);
	return(0);
}
