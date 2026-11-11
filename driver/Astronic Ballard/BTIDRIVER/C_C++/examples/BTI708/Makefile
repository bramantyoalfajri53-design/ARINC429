##
#
#  BTI708 Host Linux Examples
#  Copyright 2004-2024
#  Astronics Advanced Electronic Systems Corp.
#  www.astronics.com
#  Ballard.Support@astronics.com
#
##

##
#
#  Some build environments redefine $(CC), some do not.  Check the
#  output of the 'export' or 'make -p' commands to see if the following
#  line needs to be uncommented and/or modified.
#
##

#CC = gcc

ifndef CROSS_COMPILE
64OS := $(findstring 64,$(shell uname -m))
endif

ifndef APIPATH
APIPATH = ../..
endif

CFLAGS = -Wall

LIBS += -lbtiCard -lbti708 -lncurses -lpthread

ifdef 64BIT
CFLAGS += -m64
endif
ifdef 32BIT
CFLAGS += -m32
endif

ifdef DEBUG
CFLAGS += -D_DEBUG -O0 -ggdb
else
CFLAGS += -DNDEBUG -O2
endif

ifdef DEBUG
OUTDIRBLD = debug
else
OUTDIRBLD = release
endif

ifdef 64BIT
OUTDIRPROC = 64
APIDIRPROC = 64
endif
ifdef 32BIT
OUTDIRPROC = 32
APIDIRPROC = 32
endif

ifdef IPV6
OUTDIRIP = ipv6_
LIBS += -ltirpc
endif

OUTDIR = $(OUTDIRIP)$(OUTDIRBLD)$(OUTDIRPROC)
APIDIR = $(APIPATH)/API$(APIDIRPROC)

ifeq ($(MAKELEVEL),0)
all clean install: ipv6_no

ipv6: ipv6_no ipv6_yes

ipv6_no:
ifdef 64OS
	$(MAKE) $(MAKECMDGOALS) 64BIT=1
	$(MAKE) $(MAKECMDGOALS) 32BIT=1
else
	$(MAKE) $(MAKECMDGOALS)
endif

ipv6_yes:
ifdef 64OS
	$(MAKE) $(MAKECMDGOALS) 64BIT=1 IPV6=1
	$(MAKE) $(MAKECMDGOALS) 32BIT=1 IPV6=1
else
	$(MAKE) $(MAKECMDGOALS) IPV6=1
endif

else

BINS := $(patsubst %.c,$(OUTDIR)/%,$(wildcard *.c))

all ipv6: $(BINS)

$(OUTDIR)/%: %.c
	@mkdir -p $(OUTDIR)
	$(CC) $(CFLAGS) -I$(APIDIR) -L$(APIDIR) -o $@ $^ $(LIBS)

clean:
	rm -rf $(OUTDIR)

endif
