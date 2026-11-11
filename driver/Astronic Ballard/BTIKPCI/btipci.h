
/**
*
*	Copyright (c) 2001-2024 Astronics Advanced Electronic Systems Corp.
*	Kirkland WA USA
*
*	This program is free software; you can redistribute it and/or modify
*	it under the terms of the GNU General Public License as published by
*	the Free Software Foundation; either version 2 of the License, or
*	(at your option) any later version.
*
*	This program is distributed in the hope that it will be useful,
*	but WITHOUT ANY WARRANTY; without even the implied warranty of
*	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*	GNU General Public License for more details.
*
*	You should have received a copy of the GNU General Public License
*	along with this program; if not, write to the Free Software
*	Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA
*
**/

#ifndef __btipci_h__
#define __btipci_h__

#include <linux/version.h>
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/stddef.h>
#include <linux/pci.h>
#include <linux/fs.h>
#include <linux/errno.h>
#include <linux/string.h>	// for memset
#include <linux/pci.h>
#include <linux/poll.h>
#include <linux/irqreturn.h>
#include <linux/cdev.h>

#include <linux/fs.h>
#include <linux/wait.h>
#include <linux/sched.h>
#include <asm/uaccess.h>
#include <asm/io.h>			// for ioremap(_nocache)
#include <linux/interrupt.h>
#include <linux/dma-mapping.h>

#define ASSERT(expr)	if (!(expr)) \
						{ \
						     printk( KERN_ALERT "btipci: ====== ASSERTION FAILED! ======\n"); \
						     printk( KERN_ALERT "btipci: EXPR=%s\n",#expr);                   \
						     printk( KERN_ALERT "btipci: FILE=%s\n",__FILE__);                \
						     printk( KERN_ALERT "btipci: FUNC=%s\n",__FUNCTION__);            \
						     printk( KERN_ALERT "btipci: LINE=%d\n",__LINE__);                \
						     printk( KERN_ALERT "btipci: ===============================\n"); \
						}

/**
*	MAX_DEVICES should be a power of two (...just because it makes for some
*	conveniences throught the driver code).
*/

#define MAX_DEVICES 16
#define MAX_CORES 4
#define MAX_DMAS  64
#define BTIPCI_INT_MINOR MAX_DEVICES

/**
*	Define MINOR number for bti_pci_int
*	The number is based at 80 and is defined as:
*	base + (cardnum * MAX_CORES) + corenum
*/

/*
*	Define base numbers
*/

#define BTI_MAGIC	'B'

#define BASE_IOCTL_GET_SLOTNUM		0x10
#define BASE_IOCTL_GET_MEMWINCOUNT	0x11
#define BASE_IOCTL_GET_MEMIOCOUNT	0x12
#define BASE_IOCTL_INTERRUPT_ON		0x13
#define BASE_IOCTL_INTERRUPT_OFF	0x14
#define BASE_IOCTL_DBG_RESET_USAGE	0x15
#define BASE_IOCTL_GET_IRQNUM		0x16
#define BASE_IOCTL_PORT_RDB_SINGLE	0x20
#define BASE_IOCTL_PORT_WRB_SINGLE	0x21
#define BASE_IOCTL_PORT_RDW_SINGLE	0x74
#define BASE_IOCTL_PORT_WRW_SINGLE	0x75
#define BASE_IOCTL_GET_VENDORID		0x70
#define BASE_IOCTL_GET_DEVICEID		0x71
#define BASE_IOCTL_GET_VENDORSTR	0x72
#define BASE_IOCTL_GET_DEVICESTR	0x73
#define BASE_IOCTL_INTERRUPT_PARAM	0x76
#define BASE_IOCTL_GET_CARDTYPE		0x77
#define BASE_IOCTL_DMA_INSTALL		0x80
#define BASE_IOCTL_DMA_UNINSTALL	0x81
#define BASE_IOCTL_DMAEX_INSTALL	0x82
#define BASE_IOCTL_DMAEX_UNINSTALL	0x83
#define BASE_IOCTL_MEM_RDB_SINGLE	0x90
#define BASE_IOCTL_MEM_WRB_SINGLE	0x91
#define BASE_IOCTL_MEM_RDW_SINGLE	0x92
#define BASE_IOCTL_MEM_WRW_SINGLE	0x93
#define BASE_IOCTL_MEM_RDL_SINGLE	0x94
#define BASE_IOCTL_MEM_WRL_SINGLE	0x95
#define BASE_IOCTL_MEM_RDLL_SINGLE	0x96
#define BASE_IOCTL_MEM_WRLL_SINGLE	0x97
#define BASE_IOCTL_GET_PARENT 		0x9A
#define BASE_IOCTL_GET_SUBVENDORID	0x9B
#define BASE_IOCTL_GET_SUBDEVICEID	0x9C

#define	BASE_IOCTL_MEMWINSIZE		0x30
#define BASE_IOCTL_MEMWINBASE		(BASE_IOCTL_MEMWINSIZE  + MAX_WINDOWS_MEM)
#define BASE_IOCTL_VIRTWINBASE		(BASE_IOCTL_MEMWINBASE  + MAX_WINDOWS_MEM)
#define BASE_IOCTL_IOWINSIZE		(BASE_IOCTL_VIRTWINBASE + MAX_WINDOWS_MEM)
#define BASE_IOCTL_IOWINBASE		(BASE_IOCTL_IOWINSIZE   + MAX_WINDOWS_IO)

/*
*	All of IOCTL_ codes in Window BTIKRNLI.H are in here...some #defined
*	to '#error Unsupported.'
*/

#define	IOCTL_KERNEL_OPEN	#error Unsupported
#define	IOCTL_KERNEL_CLOSE	#error Unsupported
#define	IOCTL_KERNEL_STATUS	#error Unsupported

/**
*	Return the physical slot number of the card.
*/

#define IOCTL_GET_SLOTNUM		_IOR( BTI_MAGIC, BASE_IOCTL_GET_SLOTNUM,     unsigned char )
#define IOCTL_GET_MEMWINCOUNT	_IOR( BTI_MAGIC, BASE_IOCTL_GET_MEMWINCOUNT, unsigned char )
#define IOCTL_GET_MEMIOCOUNT	_IOR( BTI_MAGIC, BASE_IOCTL_GET_MEMIOCOUNT,  unsigned char )

/**
*	Claim/release the IRQ line that PCI allocated to our device.
*/

#define	IOCTL_INTERRUPT_ON		_IO( BTI_MAGIC, BASE_IOCTL_INTERRUPT_ON )
#define	IOCTL_INTERRUPT_OFF 	_IO( BTI_MAGIC, BASE_IOCTL_INTERRUPT_OFF )

#ifdef _DEBUG
#define IOCTL_DBG_RESET_USAGE	_IO( BTI_MAGIC, BASE_IOCTL_DBG_RESET_USAGE )
#endif

#define IOCTL_GET_IRQNUM		_IOR( BTI_MAGIC, BASE_IOCTL_GET_IRQNUM, unsigned char )

#define	IOCTL_INTERRUPT_CLEAR	#error Unsupported
#define	IOCTL_INTERRUPT_PARAM	_IOWR( BTI_MAGIC, BASE_IOCTL_INTERRUPT_PARAM, unsigned long * )

#define	IOCTL_PORT_RDB_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_PORT_RDB_SINGLE, unsigned int )
#define	IOCTL_PORT_WRB_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_PORT_WRB_SINGLE, unsigned int )
#define	IOCTL_PORT_RDW_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_PORT_RDW_SINGLE, unsigned int )
#define	IOCTL_PORT_WRW_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_PORT_WRW_SINGLE, unsigned int )
#define	IOCTL_PORT_RDB_BLOCK	#error Unsupported
#define	IOCTL_PORT_WRB_BLOCK	#error Unsupported

//
//	DMA
//

#define	IOCTL_DMA_INSTALL		_IOWR( BTI_MAGIC, BASE_IOCTL_DMA_INSTALL, unsigned int *)
#define	IOCTL_DMA_UNINSTALL		_IOWR( BTI_MAGIC, BASE_IOCTL_DMA_UNINSTALL, unsigned int *)
#define	IOCTL_DMAEX_INSTALL		_IOWR( BTI_MAGIC, BASE_IOCTL_DMAEX_INSTALL, unsigned int *)
#define	IOCTL_DMAEX_UNINSTALL	_IOWR( BTI_MAGIC, BASE_IOCTL_DMAEX_UNINSTALL, unsigned int *)

//
//	Vendor and device id
//

#define	IOCTL_GET_VENDORID		_IOR( BTI_MAGIC, BASE_IOCTL_GET_VENDORID, unsigned short )
#define	IOCTL_GET_DEVICEID		_IOR( BTI_MAGIC, BASE_IOCTL_GET_DEVICEID, unsigned short )

#define	IOCTL_GET_VENDORSTR		_IOR( BTI_MAGIC, BASE_IOCTL_GET_VENDORSTR, char * )
#define	IOCTL_GET_DEVICESTR		_IOR( BTI_MAGIC, BASE_IOCTL_GET_DEVICESTR, char * )

#define	IOCTL_GET_CARDTYPE		_IOR( BTI_MAGIC, BASE_IOCTL_GET_CARDTYPE, unsigned long )

/*
*	ALL memory access is via memory mapping on Linux.
*/

#define IOCTL_MEM_RDB_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_MEM_RDB_SINGLE, unsigned int * )
#define IOCTL_MEM_WRB_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_MEM_WRB_SINGLE, unsigned int * )
#define IOCTL_MEM_RDW_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_MEM_RDW_SINGLE, unsigned int * )
#define IOCTL_MEM_WRW_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_MEM_WRW_SINGLE, unsigned int * )
#define IOCTL_MEM_RDL_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_MEM_RDL_SINGLE, unsigned int * )
#define IOCTL_MEM_WRL_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_MEM_WRL_SINGLE, unsigned int * )
#define IOCTL_MEM_RDLL_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_MEM_RDLL_SINGLE, unsigned long long * )
#define IOCTL_MEM_WRLL_SINGLE	_IOWR( BTI_MAGIC, BASE_IOCTL_MEM_WRLL_SINGLE, unsigned long long * )

#define	IOCTL_MEM_RD_SINGLE		#error Unsupported
#define	IOCTL_MEM_WR_SINGLE		#error Unsupported
#define	IOCTL_MEM_RD_BLOCK		#error Unsupported
#define	IOCTL_MEM_WR_BLOCK		#error Unsupported

#define	IOCTL_PCCARD_VER		#error Unsupported
#define	IOCTL_PCCARD_CALL		#error Unsupported

#define MAX_WINDOWS_MEM	4
#define MAX_WINDOWS_IO	2

#define WINTYPE_MEM	 0
#define WINTYPE_VIRT 1
#define WINTYPE_IO	 2

/**
*	Returns the size of each memory region
*/

#define IOCTL_GET_MEMWINSIZE(x) _IOR( BTI_MAGIC, BASE_IOCTL_MEMWINSIZE + x, unsigned long )

/**
*	Returns the base physical (high-memory) address of each memory region
*/

#define IOCTL_GET_MEMWINBASE(x) _IOR( BTI_MAGIC, BASE_IOCTL_MEMWINBASE + x, unsigned long )

/**
*	Returns virtual mapping of memory address
*/

#define IOCTL_GET_VIRTWINBASE(x) _IOR( BTI_MAGIC, BASE_IOCTL_VIRTWINBASE + x, unsigned long )

/**
*	Returns the size of each I/O port region
*/

#define IOCTL_GET_IOWINSIZE(x) _IOR( BTI_MAGIC, BASE_IOCTL_IOWINSIZE + x, unsigned long )

/**
*	Returns the base of each I/O port region
*/

#define IOCTL_GET_IOWINBASE(x) _IOR( BTI_MAGIC, BASE_IOCTL_IOWINBASE + x, unsigned long )

#define MAX_WINDOWS	10

/**
*	Note on interrupts:
*	Interrupts are *detected* in the IFGA's 16-bit status register, but
*	must be *cleared* in both the IFGA's clear register and the PLX's
*	(32-bit) interrupt control register.
*	This IFGA and PLX are mapped to different windows: the PLX obviously
*	to its own. The IFGA sits at an offset in the interface window.
*/

/**
*	Contains all device (not module) state info.
*	Types and ordering chosen for optimal alignment.
*/

struct bti_pci_card
{
	int inuse;

	struct pci_dev* pdev;

	//
	//	Vendor and device IDs read from the card
	//

	unsigned short vendor_id;
	unsigned short device_id;
	unsigned short subvendor_id;
	unsigned short subdevice_id;

	char vendor_str[32];
	char device_str[32];

	int cardtype;

	int	slot;	// a.k.a. device
	unsigned short n_mem_win;
	unsigned short n_io_win;

	unsigned char irq;

	unsigned char irqEnabled;

	/**
	*	A list of processes that have requested SIGIO for asynchronous input.
	*	This list is managed by (convenience) kernel routines.
	*/

	struct fasync_struct* fasync_list;

	/**
	*	A wait_queue is used for the poll system call.
	*/

	wait_queue_head_t poll_wq;
	unsigned char pollwq_valid;

	/**
	*	Flags for skipping certain file operations.
	*	These are used by interrupt notification files.
	*/

	unsigned char skip_ioctl;
	unsigned char skip_mmap;
	unsigned char skip_fasync;

	/**
	*	Number of times the card has been 'open'ed.
	*/

	int references;

	/**
	*	PCI bus number
	*/

	unsigned char bus;

	/**
	*	PCI parent pointer
	*/

	void* parent;

	/**
	*	The address-space length of each window.
	*/

	size_t length[MAX_WINDOWS_MEM];

	/**
	*	The physical completely un-mucked-with address read from PCI
	*/

	unsigned long phys[MAX_WINDOWS_MEM];

	/**
	*	Mapped to *kernel* context. (For ISR's use only.)
	*/

	unsigned long virt[MAX_WINDOWS_MEM];

	/**
	*	Parameters for detecting and clearing interrupt
	*/

	unsigned char clrstatflag;

	unsigned long statoffset;
	int           statindex;
	int           statwidth;
	unsigned int  statmask;
	unsigned int  statvalue;

	unsigned long clroffset;
	int           clrindex;
	int           clrwidth;
	unsigned int  clrmask;
	unsigned int  clrvalue;

	/**
	*	DMA buffer variables
	*/

	int           dma_installed;
	unsigned long dmabase_phys[MAX_DMAS];
	unsigned long dmabase_virt[MAX_DMAS];
	unsigned long dmabase_map[MAX_DMAS];
	unsigned int  dmasize[MAX_DMAS];

	/**
	*	Fields for multi interrupt support
	*/

	unsigned char         multi_int;
	struct bti_pci_card * pIntDevs[MAX_CORES];
	int                   isr_hitcount;
	int                   poll_hitcount;

	/**
	*
	*	Pointer to device in class
	*
	**/

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
	struct device* pClassDevice;
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
	struct class_device* pClassDevice;
#endif

	/**
	*
	*	Device name and number
	*
	**/

	char devname[64];
	int devnum;
	int cardnum;

	/**
	*
	*	Multi flag
	*
	**/

	bool multi_core;

	struct cdev cdev;

	struct device *deviceptr;
};

extern int MAJOR_NUM;
extern int DEBUG_ENABLE;

/**
*	A static array of device structures that will be filled by
*	(Avoiding use of kmalloc for dynamic stuff that is small
*	enough we don't need to sweat its mem consumption.)
*/

extern struct bti_pci_card bti_pci_cards[MAX_DEVICES];
extern struct bti_pci_card bti_pci_ints[MAX_DEVICES][MAX_CORES];
extern int pci_count;

extern int isValidMemoryRange( const struct bti_pci_card* pCard, unsigned long base, size_t len );

extern int pci_alloc_devnamenum(char* devbase,char* devnameptr,int* devnumptr);

/*
*
*/
extern int findPCIDevices(void);
extern void unfindPCIDevices(void);

int btidev_translate_addr(unsigned char clearflag,unsigned int width,unsigned long address,unsigned long* poffset,unsigned int* pindex,struct bti_pci_card* pCard);

int btiget_user16(unsigned short* value,unsigned short* ptr);
int btiput_user16(unsigned short value,unsigned short* ptr);
int btiget_user32(unsigned int* value,unsigned int* ptr);
int btiput_user32(unsigned int value,unsigned int* ptr);
int btiget_user64(unsigned long long* value,unsigned long long* ptr);
int btiput_user64(unsigned long long value,unsigned long long* ptr);

struct bti_pci_card *btidev_open(dev_t d);
int btidev_close(void* pv);

void *btidev_get_parent(void *pv);

unsigned int btidev_get_irqnum(void *pv);
unsigned int btidev_get_slotnum(void *pv);
unsigned int btidev_get_vendorid(void *pv);
unsigned int btidev_get_deviceid(void *pv);
unsigned int btidev_get_subvendorid(void *pv);
unsigned int btidev_get_subdeviceid(void *pv);
const char * btidev_get_vendorstr(void *pv);
const char * btidev_get_devicestr(void *pv);
unsigned int btidev_get_cardtype(void *pv);
unsigned int btidev_get_wincount(void *pv,int type);
unsigned long btidev_get_winsize(void *pv,int type,int index);
unsigned long btidev_get_winbase(void *pv,int type,int index);

int btidev_peekb(void *pv,unsigned int* arg);
int btidev_pokeb(void *pv,unsigned int* arg);
int btidev_peekw(void *pv,unsigned int* arg);
int btidev_pokew(void *pv,unsigned int* arg);
int btidev_peekl(void *pv,unsigned int* arg);
int btidev_pokel(void *pv,unsigned int* arg);
int btidev_peekll(void *pv,unsigned long long* arg);
int btidev_pokell(void *pv,unsigned long long* arg);
int btidev_inb(void *pv,unsigned short* arg);
int btidev_outb(void *pv,unsigned long port_and_val);
int btidev_inw(void *pv,unsigned short* arg);
int btidev_outw(void *pv,unsigned long port_and_val);

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,19)
irqreturn_t btipci_isr(int irq,void* pInfo);
#else
irqreturn_t btipci_isr(int irq,void* pInfo,struct pt_regs* regs);
#endif

int btidev_enable_irq(void *pv);
int btidev_disable_irq(void *pv);
int btidev_parameter_irq(void *pv,unsigned int* arg);
int btidev_poll_ready(void *pv);
int btidev_translate_addr(unsigned char clearflag,unsigned int width,unsigned long address,unsigned long* poffset,unsigned int* pindex,struct bti_pci_card* pCard);

unsigned int btidev_dma_install32(void *pv,unsigned int* arg);
unsigned int btidev_dma_install64(void *pv,unsigned long long* arg);
unsigned int btidev_dma_uninstall32(void *pv,unsigned int* arg);
unsigned int btidev_dma_uninstall64(void *pv,unsigned long long* arg);
unsigned int btidev_dmaex_install32(void *pv,unsigned int* arg);
unsigned int btidev_dmaex_install64(void *pv,unsigned long long* arg);
unsigned int btidev_dmaex_uninstall32(void *pv,unsigned int* arg);
unsigned int btidev_dmaex_uninstall64(void *pv,unsigned long long* arg);

int btidev_validate_mmap_request(const void* pv,void** virt,unsigned long base,size_t len,int* isdma);
int btipci_init(void);
void btipci_exit(void);

#endif
