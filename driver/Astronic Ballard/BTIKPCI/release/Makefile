#
# Makefile extensions for 2.6 kernel build
#

ifndef KERNELDIR
KERNELDIR = /lib/modules/$(KERNVER)/build
endif

MODNAME   = btipci
KERNVER   = $(shell uname -r)
MODDIR    = /lib/modules/$(KERNVER)/extra
EXTRA_CFLAGS = -Werror

# Set compiler
CC = $(CROSS_COMPILE)gcc
LD = $(CROSS_COMPILE)ld

# Append debug/release-dependent flags
# Note: Because of gcc issues O2 must ALWAYS be on when building drivers.

ifdef DEBUG
EXTRA_CFLAGS += -D_DEBUG
else
EXTRA_CFLAGS += -DNDEBUG
endif

# If the class_create breaking change from kernel 6.4.0 is backported
# on an older kernel, override it by setting CLASS_CREATE_WITHOUT_OWNER=1

ifdef CLASS_CREATE_WITHOUT_OWNER
EXTRA_CFLAGS += -DCLASS_CREATE_WITHOUT_OWNER
endif

# Set output directory

ifdef DEBUG
OUTDIR = debug
else
OUTDIR = release
endif

obj-m += $(MODNAME).o

all: $(OUTDIR)
	cp -p *.[chS] Makefile* $(OUTDIR)/
ifdef CROSS_COMPILE
	make ARCH=ppc CROSS_COMPILE=${CROSS_COMPILE} -C ${PRJROOT}/kernel/linux-2.6.10-rc3-bti M=$(PWD)/$(OUTDIR) modules
else
	make -C $(KERNELDIR) M=$(PWD)/$(OUTDIR) modules
endif

$(OUTDIR):
	mkdir -p $(OUTDIR)

clean:
	rm -rf $(OUTDIR)

install:
ifdef CROSS_COMPILE
	cp -p $(MODNAME).ko ${PRJROOT}/rfs/src/rfs_ab2_mx5_ram/lib/modules/2.6.10-rc3-bti
	cp -p $(MODNAME).ko ${PRJROOT}/rfs/src/rfs_ab2_pmc08_ram/lib/modules/2.6.10-rc3-bti
else
	install -d $(MODDIR)
	install -m 0644 $(OUTDIR)/$(MODNAME).ko $(MODDIR)
	echo "SUBSYSTEM==\"btipci\", MODE=\"0666\"" >/etc/udev/rules.d/70-btipci.rules
	depmod -a
endif

uploadftp:
	ncftpput -u omni -p omni 172.30.25.$(UNITIP) /lib/modules/2.6.10-rc3-bti $(MODNAME).ko

uploadscp:
	scp release/$(MODNAME).ko admin@172.30.25.$(UNITIP):/tmp

sign:
	../signing/sign-file sha256 ../signing/signing_key.priv  ../signing/signing_key.x509 ./$(OUTDIR)/$(MODNAME).ko
	xz -k -f ./$(OUTDIR)/$(MODNAME).ko
