
/**
*
*	Copyright 2001-2023 Astronics Advanced Electronic Systems Corp.
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

#include "btipci.h"

#define DRV_VERSION "2.12.0"
const char* MODULE_NAME = "btipci";

struct btipci_cardtype
{
	int cardtype;			//Card type
	int multi_core;			//Multi-core flag
	int multi_int;			//Multi-int flag
	char devbase[16];		//Data private to the driver
	char cardname[16];		//Data private to the driver
};

#define CARDTYPE_BUSBOX		0x00000001L
#define CARDTYPE_PCI4G		0x00000002L
#define CARDTYPE_cPCI4G		0x00000003L
#define CARDTYPE_RPC		0x00000004L
#define CARDTYPE_PMC4G		0x00000005L
#define CARDTYPE_PLX9056	0x00000010L
#define CARDTYPE_PM42		0x00000011L
#define CARDTYPE_PCIE5G		0x00000012L
#define CARDTYPE_USB5G		0x00000013L
#define CARDTYPE_PCI5GV6	0x00000014L
#define CARDTYPE_PM15		0x00000015L
#define CARDTYPE_AB3000		0x00000016L
#define CARDTYPE_PE1000		0x00000017L
#define CARDTYPE_PCI6G		0x00000018L
#define CARDTYPE_PXI6G		0x00000019L
#define CARDTYPE_OBB6G		0x0000001AL
#define CARDTYPE_OBB2USB	0x0000001BL
#define CARDTYPE_WEBCS		0x0000001CL
#define CARDTYPE_AB3SN		0x0000001DL
#define CARDTYPE_ME1000		0x0000001EL
#define CARDTYPE_NG3		0x0000001FL
//CARDTYPE_WA2 - 0x20
#define CARDTYPE_NG1		0x00000021L

//these need to match BTICardi.h constants

static struct btipci_cardtype btipci_cardtypes[] =
{
	{CARDTYPE_AB3000,	0,	1,	"bti-pci",		"AB3000"},		//AB3000
	{-1,				0,	0,	"bti-lp13",		"LP1553-3"},	//LP1553-3
	{-1,				0,	0,	"bti-lc13",		"LC1553-3"},	//LC1553-3
	{-1,				0,	0,	"bti-lp43",		"LP429-3"},		//LP429-3
	{-1,				0,	0,	"bti-lc43",		"LC429-3"},		//LC429-3
	{-1,				0,	0,	"bti-lp71",		"LP708-1"},		//LP708-1
	{-1,				0,	0,	"bti-lc71",		"LC708-1"},		//LC708-1
	{CARDTYPE_PCI4G,	0,	4,	"bti-pci",		"OmniBus"},		//OmniBus
	{-1,				0,	0,	"bti-ax1",		"Lx-AFDX-1"},	//Lx-AFDX-1
	{CARDTYPE_PM42,		0,	1,	"bti-pci",		"PM429-2"},		//PM429-2
	{CARDTYPE_PCIE5G,	0,	1,	"bti-pci",		"LP429-5"},		//LP429-5
	{CARDTYPE_PCIE5G,	0,	1,	"bti-pci",		"LE429-5"},		//LE429-5
	{CARDTYPE_PCIE5G,	0,	1,	"bti-pci",		"LP1553-5"},	//LP1553-5
	{CARDTYPE_PCIE5G,	0,	1,	"bti-pci",		"LE1553-5"},	//LE1553-5
	{CARDTYPE_PCI5GV6,	0,	1,	"bti-pci",		"MX5"},			//MX5
	{CARDTYPE_PM15,		0,	1,	"bti-pci",		"PM15"},		//PM15
	{CARDTYPE_PCI5GV6,	0,	1,	"bti-pci",		"MX664-5"},		//MX664-5
	{CARDTYPE_PE1000,	0,	1,	"bti-pci",		"PE1000"},		//PE1000
	{CARDTYPE_PCI6G,	1,	1,	"bti-pcim",		"OB2PCIE"},		//OB2PCIE
	{CARDTYPE_PCI6G,	1,	1,	"bti-pcim",		"OB2PCIE"},		//OB2PCIE
	{CARDTYPE_PCI6G,	1,	1,	"bti-pcim",		"OB2PCIE"},		//OB2PCIE
	{CARDTYPE_PCI6G,	1,	1,	"bti-pcim",		"OB2PCIE"},		//OB2PCIE
	{CARDTYPE_PXI6G,	1,	1,	"bti-pcim",		"OB2PXIE"},		//OB2PXIE
	{CARDTYPE_PXI6G,	1,	1,	"bti-pcim",		"OB2PXIE"},		//OB2PXIE
	{CARDTYPE_PXI6G,	1,	1,	"bti-pcim",		"OB2PXIE"},		//OB2PXIE
	{CARDTYPE_PXI6G,	1,	1,	"bti-pcim",		"OB2PXIE"},		//OB2PXIE
	{CARDTYPE_OBB6G,	1,	1,	"bti-pcim",		"OBB6G"},		//OBB6G
	{CARDTYPE_OBB6G,	1,	1,	"bti-pcim",		"OBB6G"},		//OBB6G
	{CARDTYPE_OBB6G,	1,	1,	"bti-pcim",		"OBB6G"},		//OBB6G
	{CARDTYPE_OBB6G,	1,	1,	"bti-pcim",		"OBB6G"},		//OBB6G
	{CARDTYPE_WEBCS,	0,	1,	"bti-pci",		"webCS"},		//webCS
	{CARDTYPE_AB3SN,	0,	1,	"bti-pci",		"AB3SN"},		//AB3SN
	{CARDTYPE_ME1000,	0,	1,	"bti-pci",		"ME1000"},		//ME1000
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIO1553
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIO1553
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIO1553
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIO1553
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIO429
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIO429
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIO429
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIO429
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIODIO
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIODIO
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIODIO
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIODIO
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIODIO48
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIODIO48
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIODIO48
	{CARDTYPE_NG3,		1,	1,	"bti-pcim",		"NG3"},			//NG3 BIODIO48
	{CARDTYPE_NG1,		0,	1,	"bti-pci",		"NG1"},			//NG1
	{CARDTYPE_PCIE5G,	0,	1,	"bti-pci",		"LE429-5"},		//LE429-5 (2022)
	{CARDTYPE_PCIE5G,	0,	1,	"bti-pci",		"LE1553-5"}		//LE1553-5 (2022)
};

static const struct pci_device_id btipci_table[] =
{
	//
	//	vendor, device, subvendor, subdevice, class, class_mask, driver_data
	//

	{0x1BD0, 0x1004, 0x1BD0, 0x1004, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 0]},	//AB3000
	{0x10B5, 0x1066, 0x10B5, 0x1066, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 1]},	//LP1553-3
	{0x10B5, 0x2073, 0x10B5, 0x2073, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 2]},	//LC1553-3
	{0x10B5, 0x1098, 0x10B5, 0x1098, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 3]},	//LP429-3
	{0x10B5, 0x2024, 0x10B5, 0x2024, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 4]},	//LC429-3
	{0x10B5, 0x2074, 0x10B5, 0x2074, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 5]},	//LP708-1
	{0x10B5, 0x2075, 0x10B5, 0x2075, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 6]},	//LC708-1
	{0x1014, 0x0156, 0x0000, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 7]},	//OmniBus
	{0x1014, 0x027F, 0x0000, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 8]},	//Lx-AFDX-1
	{0x10B5, 0x9056, 0x10B5, 0x3336, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[ 9]},	//PM429-2
	{0x10B5, 0x9056, 0x10B5, 0x3416, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[10]},	//LP429-5
	{0x10B5, 0x9056, 0x10B5, 0x3418, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[11]},	//LE429-5
	{0x10B5, 0x9056, 0x10B5, 0x3417, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[12]},	//LP1553-5
	{0x10B5, 0x9056, 0x10B5, 0x3419, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[13]},	//LE1553-5
	{0x1BD0, 0x1001, 0x1BD0, 0x1001, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[14]},	//MX5
	{0x1BD0, 0x1002, 0x1BD0, 0x1002, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[15]},	//PM15
	{0x1BD0, 0x1003, 0x1BD0, 0x1003, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[16]},	//MX664-5
	{0x1BD0, 0x1005, 0x1BD0, 0x1005, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[17]},	//PE1000
	{0x1BD0, 0x1101, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[18]},	//OB2PCIE
	{0x1BD0, 0x1101, 0x1BD0, 0x0001, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[19]},	//OB2PCIE
	{0x1BD0, 0x1101, 0x1BD0, 0x0002, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[20]},	//OB2PCIE
	{0x1BD0, 0x1101, 0x1BD0, 0x0003, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[21]},	//OB2PCIE
	{0x1BD0, 0x1103, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[22]},	//OB2PXIE
	{0x1BD0, 0x1103, 0x1BD0, 0x0001, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[23]},	//OB2PXIE
	{0x1BD0, 0x1103, 0x1BD0, 0x0002, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[24]},	//OB2PXIE
	{0x1BD0, 0x1103, 0x1BD0, 0x0003, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[25]},	//OB2PXIE
	{0x1BD0, 0x1102, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[26]},	//OBB6G
	{0x1BD0, 0x1102, 0x1BD0, 0x0001, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[27]},	//OBB6G
	{0x1BD0, 0x1102, 0x1BD0, 0x0002, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[28]},	//OBB6G
	{0x1BD0, 0x1102, 0x1BD0, 0x0003, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[29]},	//OBB6G
	{0x1BD0, 0x1006, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[30]},	//webCS
	{0x1BD0, 0x1007, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[31]},	//AB3SN
	{0x1BD0, 0x1008, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[32]},	//ME1000
	{0x1BD0, 0x1200, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[33]},	//NG3 BIO1553
	{0x1BD0, 0x1200, 0x1BD0, 0x0001, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[34]},	//NG3 BIO1553
	{0x1BD0, 0x1200, 0x1BD0, 0x0002, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[35]},	//NG3 BIO1553
	{0x1BD0, 0x1200, 0x1BD0, 0x0003, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[36]},	//NG3 BIO1553
	{0x1BD0, 0x1201, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[37]},	//NG3 BIO429
	{0x1BD0, 0x1201, 0x1BD0, 0x0001, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[38]},	//NG3 BIO429
	{0x1BD0, 0x1201, 0x1BD0, 0x0002, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[39]},	//NG3 BIO429
	{0x1BD0, 0x1201, 0x1BD0, 0x0003, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[40]},	//NG3 BIO429
	{0x1BD0, 0x1202, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[41]},	//NG3 BIODIO
	{0x1BD0, 0x1202, 0x1BD0, 0x0001, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[42]},	//NG3 BIODIO
	{0x1BD0, 0x1202, 0x1BD0, 0x0002, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[43]},	//NG3 BIODIO
	{0x1BD0, 0x1202, 0x1BD0, 0x0003, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[44]},	//NG3 BIODIO
	{0x1BD0, 0x1203, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[45]},	//NG3 BIODIO48
	{0x1BD0, 0x1203, 0x1BD0, 0x0001, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[46]},	//NG3 BIODIO48
	{0x1BD0, 0x1203, 0x1BD0, 0x0002, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[47]},	//NG3 BIODIO48
	{0x1BD0, 0x1203, 0x1BD0, 0x0003, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[48]},	//NG3 BIODIO48
	{0x1BD0, 0x100A, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[49]},	//NG1
	{0x1BD0, 0x100B, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[50]},	//LE429-5 (2022)
	{0x1BD0, 0x100C, 0x1BD0, 0x0000, 0x0000, 0x0000, (unsigned long)&btipci_cardtypes[51]},	//LE1553-5 (2022)
	{0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000}								//Terminator
};

int MAJOR_NUM = 0;
int DEBUG_ENABLE = 0;

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,10)
#ifndef _LINUX_MODULE_PARAMS_H
#include <linux/moduleparam.h>
#endif /* _LINUX_MODULE_PARAMS_H */
module_param(MAJOR_NUM,    int, S_IRUGO);
module_param(DEBUG_ENABLE, int, S_IRUGO);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
#ifndef _LINUX_MODULE_PARAMS_H
#include <linux/moduleparam.h>
#endif /* _LINUX_MODULE_PARAMS_H */
module_param(MAJOR_NUM,    int,  S_IRUGO);
module_param(DEBUG_ENABLE, int, S_IRUGO);
#else
MODULE_PARM(MAJOR_NUM,    "i");
MODULE_PARM(DEBUG_ENABLE, "i");
#endif /* KERNEL_VERSION >= 2.6.0 */

MODULE_PARM_DESC(MAJOR_NUM,    "The driver's \"major number\" (auto-assigned if not set)");
MODULE_PARM_DESC(DEBUG_ENABLE, "Non-zero value turns on debug output to console");

MODULE_AUTHOR("Astronics AES");
MODULE_DEVICE_TABLE(pci,btipci_table);
MODULE_DESCRIPTION("Driver for Ballard PCI cards");
MODULE_LICENSE("GPL");
MODULE_VERSION(DRV_VERSION);

/**
*
*	Pointer to class.
*
**/

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
struct class* pClass=NULL;
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
struct class_simple* pClass=NULL;
#endif

/**
*
*	A static array of device structures that will be filled by
*	cacheDeviceInfo().
*	(Avoiding use of kmalloc for dynamic stuff that is small
*	enough that we don't need to sweat its mem consumption.)
*
**/

struct bti_pci_card bti_pci_cards[MAX_DEVICES]={{0}};
struct bti_pci_card bti_pci_ints[MAX_DEVICES][MAX_CORES]={{{0}}};

/**
*
*	The number of bti_pci_cards actually filled in.
*
**/

int pci_count=0;

// *****************************************************************************
// HELPERS
// *****************************************************************************

int btiget_user16(unsigned short* value, unsigned short* ptr)
{
	int err;
	unsigned short j;

//	printk(KERN_INFO "btipci: btiget_user16 - sizeof(*value) = %lu\n",sizeof(*value));
//	printk(KERN_INFO "btipci: btiget_user16 - sizeof(temp)   = %lu\n",sizeof(j));
//	printk(KERN_INFO "btipci: btiget_user16 - sizeof(*ptr)   = %lu\n",sizeof(*ptr));

	err = get_user(j,ptr);
	if (value) *value = j;
	return(err);
}

int btiput_user16(unsigned short value, unsigned short* ptr)
{
	int err;

//	printk(KERN_INFO "btipci: btiput_user16 - sizeof(value)  = %lu\n",sizeof(value));
//	printk(KERN_INFO "btipci: btiput_user16 - sizeof(*ptr)   = %lu\n",sizeof(*ptr));

	err = put_user(value,ptr);
	return(err);
}

int btiget_user32(unsigned int* value, unsigned int* ptr)
{
	int err;
	unsigned long j;

//	printk(KERN_INFO "btipci: btiget_user32 - sizeof(*value) = %lu\n",sizeof(*value));
//	printk(KERN_INFO "btipci: btiget_user32 - sizeof(temp)   = %lu\n",sizeof(j));
//	printk(KERN_INFO "btipci: btiget_user32 - sizeof(*ptr)   = %lu\n",sizeof(*ptr));

	err = get_user(j,ptr);
	if (value) *value = j;
	return(err);
}

int btiput_user32(unsigned int value, unsigned int* ptr)
{
	int err;

//	printk(KERN_INFO "btipci: btiput_user32 - sizeof(value)  = %lu\n",sizeof(value));
//	printk(KERN_INFO "btipci: btiput_user32 - sizeof(*ptr)   = %lu\n",sizeof(*ptr));

	err = put_user(value,ptr);
	return(err);
}

int btiget_user64(unsigned long long* value, unsigned long long* ptr)
{
	int err;
	unsigned long long j;

//	printk(KERN_INFO "btipci: btiget_user32 - sizeof(*value) = %lu\n",sizeof(*value));
//	printk(KERN_INFO "btipci: btiget_user32 - sizeof(temp)   = %lu\n",sizeof(j));
//	printk(KERN_INFO "btipci: btiget_user32 - sizeof(*ptr)   = %lu\n",sizeof(*ptr));

	err = copy_from_user(&j,ptr,sizeof(*value));
	if (value) *value = j;
	return(err);
}

int btiput_user64(unsigned long long value, unsigned long long* ptr)
{
	int err;

//	printk(KERN_INFO "btipci: btiput_user64 - sizeof(value)  = %lu\n",sizeof(value));
//	printk(KERN_INFO "btipci: btiput_user64 - sizeof(*ptr)   = %lu\n",sizeof(*ptr));

	err = copy_to_user(ptr,&value,sizeof(value));
	return(err);
}

// *****************************************************************************
// OPEN/CLOSE
// *****************************************************************************


// *****************************************************************************
// STATS
// *****************************************************************************

void *btidev_get_parent(void *pv)
{
	struct bti_pci_card* pDev = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_parent - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_parent - Returning %p\n",pDev->parent);

	return(pDev->parent);
}

unsigned int btidev_get_irqnum(void *pv)
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_irqnum - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_irqnum - Returning %u\n",pCard->irq);

	return(pCard->irq);
}

unsigned int btidev_get_slotnum(void *pv)
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_slotnum - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_slotnum - Returning %u\n",pCard->slot);

	return(pCard->slot);
}

unsigned int btidev_get_vendorid(void *pv)
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_vendorid - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_vendorid - Returning %04X\n",pCard->vendor_id);

	return(pCard->vendor_id);
}

unsigned int btidev_get_deviceid(void *pv)
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_deviceid - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_deviceid - Returning %04X\n",pCard->device_id);

	return(pCard->device_id);
}

unsigned int btidev_get_subvendorid(void *pv)
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_subvendorid - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_subvendorid - Returning %04X\n",pCard->subvendor_id);

	return(pCard->subvendor_id);
}

unsigned int btidev_get_subdeviceid(void *pv)
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_subdeviceid - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_subdeviceid - Returning %04X\n",pCard->subdevice_id);

	return(pCard->subdevice_id);
}

const char * btidev_get_vendorstr(void *pv)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_vendorstr - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_vendorstr - Returning %s\n",pCard->vendor_str);

	return(pCard->vendor_str);
}

const char * btidev_get_devicestr(void *pv)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_devicestr - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_devicestr - Returning %s\n",pCard->device_str);

	return(pCard->device_str);
}

unsigned int btidev_get_cardtype(void *pv)
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_cardtype - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_cardtype - Returning %04X\n",pCard->cardtype);

	return(pCard->cardtype);
}

unsigned int btidev_get_wincount(void *pv, int type)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_wincount - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_wincount - type=%u\n", type);

	if (WINTYPE_IO==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_wincount - returning %u\n", 0);

		return(0);
	}

	if (WINTYPE_VIRT==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_wincount - returning %u\n", pCard->n_mem_win);

		return(pCard->n_mem_win);
	}

	if (WINTYPE_MEM==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_wincount - returning %u\n", pCard->n_mem_win);

		return(pCard->n_mem_win);
	}

	return(0);
}

unsigned long btidev_get_winsize(void *pv, int type, int index)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_winsize - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_winsize - type=%u\n",  type);
 //	printk(KERN_INFO "btipci: btidev_get_winsize - index=%u\n", index);

	if (index >= pCard->n_mem_win) return(0);

	if (WINTYPE_IO==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_winsize - returning %04X\n", 0);
		return(0);
	}

	if (WINTYPE_VIRT==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_winsize - returning %08zX\n", pCard->length[index]);

		return(pCard->length[index]);
	}

	if (WINTYPE_MEM==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_winsize - returning %08zX\n", pCard->length[index]);

		return(pCard->length[index]);
	}

	return(0);
}

unsigned long btidev_get_winbase(void *pv, int type, int index)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_get_winbase - Entering\n");
//	printk(KERN_INFO "btipci: btidev_get_winbase - type=%u\n",  type);
//	printk(KERN_INFO "btipci: btidev_get_winbase - index=%u\n", index);

	if (index >= pCard->n_mem_win) return(0);

	if (WINTYPE_IO==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_winbase - returning %08X\n", 0);

		return(0);
	}

	if (WINTYPE_VIRT==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_winbase - returning %08lX\n", pCard->virt[index]);

		return(pCard->virt[index]);
	}

	if (WINTYPE_MEM==type)
	{
//		printk(KERN_INFO "btipci: btidev_get_winbase - returning %08lX\n", pCard->phys[index]);

		return(pCard->phys[index]);
	}

	return(0);
}

// *****************************************************************************
// MEMORY I/O
// *****************************************************************************

int btidev_peekb(void *pv,unsigned int* arg)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;
	unsigned int index,offset,value;
	unsigned long addr;
	int err = 0;

	err = btiget_user32(&index, &arg[0]); if (err) return(err);
	err = btiget_user32(&offset,&arg[1]); if (err) return(err);
	err = btiget_user32(&value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_peekb - index=%u\n",  index);
//	printk(KERN_INFO "btipci: btidev_peekb - offset=%x\n", offset);

	addr = pCard->virt[index];
//	printk(KERN_INFO "btipci: btidev_peekb - baseaddr=%lx\n", addr);
	addr += offset;
//	printk(KERN_INFO "btipci: btidev_peekb - actualaddr=%lx\n", addr);

#ifdef PPC
	value = ppc_in8(addr);
#else
	value = readb((void*)addr);
#endif

	err = btiput_user32(value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_peekb - value=%x\n",  value);

	return(err);
}

int btidev_pokeb(void *pv,unsigned int* arg)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;
	unsigned int index,offset,value;
	unsigned long addr;
	int err = 0;

	err = btiget_user32(&index, &arg[0]); if (err) return(err);
	err = btiget_user32(&offset,&arg[1]); if (err) return(err);
	err = btiget_user32(&value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_pokeb - index=%u\n",  index);
//	printk(KERN_INFO "btipci: btidev_pokeb - offset=%x\n", offset);
//	printk(KERN_INFO "btipci: btidev_pokeb - value=%x\n",  value);

	addr = pCard->virt[index];
//	printk(KERN_INFO "btipci: btidev_pokeb - baseaddr=%lx\n", addr);
	addr += offset;
//	printk(KERN_INFO "btipci: btidev_pokeb - actualaddr=%lx\n", addr);

#ifdef PPC
	ppc_out8(value,addr);
#else
	writeb(value,(void*)addr);
#endif

	return(err);
}

int btidev_peekw(void *pv,unsigned int* arg)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;
	unsigned int index,offset,value;
	unsigned long addr;
	int err = 0;

	err = btiget_user32(&index, &arg[0]); if (err) return(err);
	err = btiget_user32(&offset,&arg[1]); if (err) return(err);
	err = btiget_user32(&value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_peekw - index=%u\n",  index);
//	printk(KERN_INFO "btipci: btidev_peekw - offset=%x\n", offset);

	addr = pCard->virt[index];
//	printk(KERN_INFO "btipci: btidev_peekw - baseaddr=%lx\n", addr);
	addr += offset;
//	printk(KERN_INFO "btipci: btidev_peekw - actualaddr=%lx\n", addr);

#ifdef PPC
	value = ppc_in16r(addr);
#else
	value = readw((void*)addr);
#endif

	err = btiput_user32(value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_peekw - value=%x\n",  value);

	return(err);
}

int btidev_pokew(void *pv,unsigned int* arg)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;
	unsigned int index,offset,value;
	unsigned long addr;
	int err = 0;

	err = btiget_user32(&index, &arg[0]); if (err) return(err);
	err = btiget_user32(&offset,&arg[1]); if (err) return(err);
	err = btiget_user32(&value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_pokew - index=%u\n",  index);
//	printk(KERN_INFO "btipci: btidev_pokew - offset=%x\n", offset);
//	printk(KERN_INFO "btipci: btidev_pokew - value=%x\n",  value);

	addr = pCard->virt[index];
//	printk(KERN_INFO "btipci: btidev_pokew - baseaddr=%lx\n", addr);
	addr += offset;
//	printk(KERN_INFO "btipci: btidev_pokew - actualaddr=%lx\n", addr);

#ifdef PPC
	ppc_out16r(value,addr);
#else
	writew(value,(void*)addr);
#endif

	return(err);
}

int btidev_peekl(void *pv,unsigned int* arg)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;
	unsigned int index,offset,value;
	unsigned long addr;
	int err = 0;

	err = btiget_user32(&index, &arg[0]); if (err) return(err);
	err = btiget_user32(&offset,&arg[1]); if (err) return(err);
	err = btiget_user32(&value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_peekl - index=%u\n",  index);
//	printk(KERN_INFO "btipci: btidev_peekl - offset=%x\n", offset);

	addr = pCard->virt[index];
//	printk(KERN_INFO "btipci: btidev_peekl - baseaddr=%lx\n", addr);
	addr += offset;
//	printk(KERN_INFO "btipci: btidev_peekl - actualaddr=%lx\n", addr);

#ifdef PPC
	value = ppc_in32r(addr);
#else
	value = readl((void*)addr);
#endif

	err = btiput_user32(value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_peekl - value=%x\n",  value);

	return(err);
}

int btidev_pokel(void *pv,unsigned int* arg)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;
	unsigned int index,offset,value;
	unsigned long addr;
	int err = 0;

	err = btiget_user32(&index, &arg[0]); if (err) return(err);
	err = btiget_user32(&offset,&arg[1]); if (err) return(err);
	err = btiget_user32(&value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_pokel - index=%u\n",  index);
//	printk(KERN_INFO "btipci: btidev_pokel - offset=%x\n", offset);
//	printk(KERN_INFO "btipci: btidev_pokel - value=%x\n",  value);

	addr = pCard->virt[index];
//	printk(KERN_INFO "btipci: btidev_pokel - baseaddr=%lx\n", addr);
	addr += offset;
//	printk(KERN_INFO "btipci: btidev_pokel - actualaddr=%lx\n", addr);

#ifdef PPC
	ppc_out32r(value,addr);
#else
	writel(value,(void*)addr);
#endif

	return(err);
}

int btidev_peekll(void *pv,unsigned long long* arg)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;
	unsigned long long index,offset,value;
	unsigned long addr;
	int err = 0;

	err = btiget_user64(&index, &arg[0]); if (err) return(err);
	err = btiget_user64(&offset,&arg[1]); if (err) return(err);
	err = btiget_user64(&value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_peekll - index=%llu\n",  index);
//	printk(KERN_INFO "btipci: btidev_peekll - offset=%llx\n", offset);

	addr = pCard->virt[index];
//	printk(KERN_INFO "btipci: btidev_peekll - baseaddr=%lx\n", addr);
	addr += offset;
//	printk(KERN_INFO "btipci: btidev_peekll - actualaddr=%lx\n", addr);

#ifdef PPC
	value = ppc_in32r(addr);
#else
	value = readl((void*)addr);
#endif

	err = btiput_user64(value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_peekll - value=%llx\n",  value);

	return(err);
}

int btidev_pokell(void *pv,unsigned long long* arg)
{
	const struct bti_pci_card* pCard = (struct bti_pci_card*)pv;
	unsigned long long index,offset,value;
	unsigned long addr;
	int err = 0;

	err = btiget_user64(&index, &arg[0]); if (err) return(err);
	err = btiget_user64(&offset,&arg[1]); if (err) return(err);
	err = btiget_user64(&value, &arg[2]); if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_pokell - index=%llu\n",  index);
//	printk(KERN_INFO "btipci: btidev_pokell - offset=%llx\n", offset);
//	printk(KERN_INFO "btipci: btidev_pokell - value=%llx\n",  value);

	addr = pCard->virt[index];
//	printk(KERN_INFO "btipci: btidev_pokell - baseaddr=%lx\n", addr);
	addr += offset;
//	printk(KERN_INFO "btipci: btidev_pokell - actualaddr=%lx\n", addr);

#ifdef PPC
	ppc_out32r(value,addr);
#else
	writel(value,(void*)addr);
#endif

	return(err);
}

// *****************************************************************************
// PORT I/O
// *****************************************************************************

int btidev_inb(void *pv,unsigned short* arg)
{
	unsigned short port,value;
	int err = 0;

#ifdef GUARDED_IO

	struct bti_pcmcia_card* pCard = (struct bti_pcmcia_card*)pv;

	if (pCard->stop) return(-EIO);

#endif

	err = btiget_user16(&port, arg);
	if (err) return(err);

	value = inb(port);

	err = btiput_user16(value, arg);
	return(err);
}

int btidev_outb(void *pv, unsigned long port_and_val)
{

#ifdef GUARDED_IO

	struct bti_pcmcia_card* pCard = (struct bti_pcmcia_card*)pv;
	if (pCard->stop) return(-EIO);

#endif

	outb(0xFF & port_and_val, 0xFFFF & (port_and_val>>8));

	return(0);
}

int btidev_inw(void *pv,unsigned short* arg)
{
	unsigned short port,value;
	int err = 0;

#ifdef GUARDED_IO

	struct bti_pcmcia_card* pCard = (struct bti_pcmcia_card*)pv;

	if (pCard->stop) return(-EIO);

#endif

	err = btiget_user16(&port, arg);
	if (err) return(err);

	value = inw(port);

	err = btiput_user16(value, arg);
	return(err);
}

int btidev_outw(void *pv, unsigned long port_and_val)
{

#ifdef GUARDED_IO

	struct bti_pcmcia_card* pCard = (struct bti_pcmcia_card*)pv;
	if (pCard->stop) return(-EIO);

#endif

	outw(0xFFFF & port_and_val, 0xFFFF & (port_and_val>>8));

	return(0);
}

// *****************************************************************************
// INTERRUPT
// *****************************************************************************

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,19)
irqreturn_t btipci_isr(int irq, void* pInfo)
#else
irqreturn_t btipci_isr(int irq, void* pInfo, struct pt_regs* regs)
#endif
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pInfo;
	struct bti_pci_card* pIntDev;
	int hit;
	int done;
	int j;
	int handled = 0;

//	printk(KERN_INFO "btipci: isr - Entering\n");

#ifdef _DEBUG

	/*
	* Should be able to trust the OS will never lose our *pInfo, but to
	* preclude a REALLY catastrophic crash during development...
	*/

	if (!pCard)
	{
		printk(KERN_ALERT "btipci: ISR received NULL client pointer\n");
		return IRQ_NONE;
	}

#endif

	for (j=0,done=0;j<MAX_CORES && !done;j++)
	{
		unsigned long stataddr;
		unsigned long statoffset;
		int statindex;
		int statwidth;
		unsigned int statmask;
		unsigned int statvalue;

		unsigned long clraddr;
		unsigned long clroffset;
		int clrindex;
		int clrwidth;
		unsigned int clrmask;
		unsigned int clrvalue;

		volatile unsigned char  valueb;
		volatile unsigned short valuew;
		volatile unsigned int   valuel;

		if (pCard->multi_int)
		{
			pIntDev = pCard->pIntDevs[j];
		}
		else
		{
			pIntDev = pCard;
			done = 1;
		}

//		printk(KERN_INFO "isr - index = %u\n",j);


		if (!pIntDev->clrstatflag) continue;

		hit = 0;

		statoffset = pIntDev->statoffset;
		statindex  = pIntDev->statindex;
		statwidth  = pIntDev->statwidth;
		statmask   = pIntDev->statmask;
		statvalue  = pIntDev->statvalue;

		//
		//	Calculate status address
		//

		stataddr=0;

		if (statwidth==0 || statwidth==1 || statwidth==2)
		{
			stataddr = pCard->virt[statindex]+statoffset;
		}
		else if (statwidth==8 || statwidth==16 || statwidth==32)
		{
			stataddr = pCard->virt[statindex]+statoffset;
		}

		//
		//	Test status if interrupt is for us
		//

//		printk(KERN_INFO "isr - stataddr   = %08lX\n",stataddr);
//		printk(KERN_INFO "isr - statoffset = %08lX\n",statoffset);
//		printk(KERN_INFO "isr - statindex  = %u\n",   statindex);
//		printk(KERN_INFO "isr - statwidth  = %u\n",   statwidth);
//		printk(KERN_INFO "isr - statmask   = %08X\n", statmask);
//		printk(KERN_INFO "isr - statvalue  = %08X\n", statvalue);

		switch(statwidth)
		{
			case  0: {valueb =   inb(                  stataddr); /*printk(KERN_INFO "isr - read=%02X\n",valueb);*/ if ((valueb & ((unsigned char) (statmask))) == (unsigned char) (statvalue)) hit=1; break;}
			case  1: {valuew =   inw(                  stataddr); /*printk(KERN_INFO "isr - read=%04X\n",valuew);*/ if ((valuew & ((unsigned short)(statmask))) == (unsigned short)(statvalue)) hit=1; break;}
			case  2: {valuel =   inl(                  stataddr); /*printk(KERN_INFO "isr - read=%08X\n",valuel);*/ if ((valuel & ((unsigned int)  (statmask))) == (unsigned int)  (statvalue)) hit=1; break;}
			case  8: {valueb = readb((unsigned char  *)stataddr); /*printk(KERN_INFO "isr - read=%02X\n",valueb);*/ if ((valueb & ((unsigned char) (statmask))) == (unsigned char) (statvalue)) hit=1; break;}
			case 16: {valuew = readw((unsigned short *)stataddr); /*printk(KERN_INFO "isr - read=%04X\n",valuew);*/ if ((valuew & ((unsigned short)(statmask))) == (unsigned short)(statvalue)) hit=1; break;}
			case 32: {valuel = readl((unsigned int   *)stataddr); /*printk(KERN_INFO "isr - read=%08X\n",valuel);*/ if ((valuel & ((unsigned int)  (statmask))) == (unsigned int)  (statvalue)) hit=1; break;}
		}

		if (!hit)
		{
//			printk(KERN_INFO "btipci: isr - no hit (%d)\n",j);
			continue;
		}

		clroffset  = pIntDev->clroffset;
		clrindex   = pIntDev->clrindex;
		clrwidth   = pIntDev->clrwidth;
		clrmask    = pIntDev->clrmask;
		clrvalue   = pIntDev->clrvalue;

		//
		//	Calculate clear address
		//

		clraddr=0;

		if (clrwidth==0 || clrwidth==1 || clrwidth==2)
		{
			clraddr = pCard->virt[clrindex]+clroffset;
		}
		else if (clrwidth==8 || clrwidth==16 || clrwidth==32)
		{
			clraddr = pCard->virt[clrindex]+clroffset;
		}

//		printk(KERN_INFO "isr - clraddr   = %08lX\n",clraddr);
//		printk(KERN_INFO "isr - clroffset = %08lX\n",clroffset);
//		printk(KERN_INFO "isr - clrindex  = %u\n",   clrindex);
//		printk(KERN_INFO "isr - clrwidth  = %u\n",   clrwidth);
//		printk(KERN_INFO "isr - clrmask   = %08X\n", clrmask);
//		printk(KERN_INFO "isr - clrvalue  = %08X\n", clrvalue);

		switch(clrwidth)
		{
			case  8: *((unsigned char  *)(clraddr)) = (unsigned char) (clrvalue); break;
			case 16: *((unsigned short *)(clraddr)) = (unsigned short)(clrvalue); break;
			case 32: *((unsigned int   *)(clraddr)) = (unsigned int)  (clrvalue); break;
		}

		switch(clrwidth)
		{
			case  0: {valueb =   inb(clraddr);                   /*printk(KERN_INFO "isr - read=%02X\n",valueb);*/ valueb &= (unsigned char )clrmask; /*printk(KERN_INFO "isr - mod=%02X\n",valueb);*/ valueb |= (unsigned char )clrvalue; /*printk("isr - wr=%02X\n",valueb);*/   outb(valueb,                  clraddr); break;}
			case  1: {valuew =   inw(clraddr);                   /*printk(KERN_INFO "isr - read=%04X\n",valuew);*/ valuew &= (unsigned short)clrmask; /*printk(KERN_INFO "isr - mod=%04X\n",valuew);*/ valuew |= (unsigned short)clrvalue; /*printk("isr - wr=%04X\n",valuew);*/   outw(valuew,                  clraddr); break;}
			case  2: {valuel =   inl(clraddr);                   /*printk(KERN_INFO "isr - read=%08X\n",valuel);*/ valuel &= (unsigned int  )clrmask; /*printk(KERN_INFO "isr - mod=%08X\n",valuel);*/ valuel |= (unsigned int  )clrvalue; /*printk("isr - wr=%08X\n",valuel);*/   outl(valuel,                  clraddr); break;}
			case  8: {valueb = readb((unsigned char  *)clraddr); /*printk(KERN_INFO "isr - read=%02X\n",valueb);*/ valueb &= (unsigned char )clrmask; /*printk(KERN_INFO "isr - mod=%02X\n",valueb);*/ valueb |= (unsigned char )clrvalue; /*printk("isr - wr=%02X\n",valueb);*/ writeb(valueb,(unsigned char  *)clraddr); break;}
			case 16: {valuew = readw((unsigned short *)clraddr); /*printk(KERN_INFO "isr - read=%04X\n",valuew);*/ valuew &= (unsigned short)clrmask; /*printk(KERN_INFO "isr - mod=%04X\n",valuew);*/ valuew |= (unsigned short)clrvalue; /*printk("isr - wr=%04X\n",valuew);*/ writew(valuew,(unsigned short *)clraddr); break;}
			case 32: {valuel = readl((unsigned int   *)clraddr); /*printk(KERN_INFO "isr - read=%08X\n",valuel);*/ valuel &= (unsigned int  )clrmask; /*printk(KERN_INFO "isr - mod=%08X\n",valuel);*/ valuel |= (unsigned int  )clrvalue; /*printk("isr - wr=%08X\n",valuel);*/ writel(valuel,(unsigned int   *)clraddr); break;}
			case 99: break;
		}

		/* Dummy read to "sync" PCI write */
		switch(statwidth)
		{
			case  0: {valueb =   inb(                  stataddr); break;}
			case  1: {valuew =   inw(                  stataddr); break;}
			case  2: {valuel =   inl(                  stataddr); break;}
			case  8: {valueb = readb((unsigned char  *)stataddr); break;}
			case 16: {valuew = readw((unsigned short *)stataddr); break;}
			case 32: {valuel = readl((unsigned int   *)stataddr); break;}
		}

		handled = 1;
		pIntDev->isr_hitcount++;

		/* Signal wait_queue (if any) */
		if (pIntDev->pollwq_valid)
		{
//			printk(KERN_INFO "btipci: isr - wake up queue\n");
			wake_up_interruptible(&pIntDev->poll_wq);
		}

		/**
		* Signal any interested processes. (Don't worry. The name "kill" is
		* a historical artifact which actually *means* "send signal."
		*/

		if (pIntDev->fasync_list)
		{
//			printk(KERN_INFO "btipci: isr - signal fasync\n");
#if (LINUX_VERSION_CODE < KERNEL_VERSION(2,2,16))
			kill_fasync((pIntDev->fasync_list),SIGIO);
#elif (LINUX_VERSION_CODE < KERNEL_VERSION(2,4,0))
			kill_fasync(pIntDev->fasync_list),SIGIO,0);
#else
			kill_fasync(&(pIntDev->fasync_list),SIGIO,0);
#endif
		}
	}

	if (handled)
	{
//		printk(KERN_INFO "btipci: isr - handled\n");
		return IRQ_HANDLED;
	}

//	printk(KERN_INFO "btipci: isr - not for us\n");
	return IRQ_NONE;
}

/**
* The "public" version...called via an ioctl.
* This function must:
*	1) Map the memory windows containing interrupt registers to kernel space
*	2) Physically claim the IRQ line.
*/

int btidev_enable_irq(void *pv)
{
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;
	int err = 0;

//	printk(KERN_INFO "btipci: btidev_enable_irq - Entering\n");

	/**
	* Does the device even have in IRQ line?...
	*/

	if (!(pCard->irq>0))
	{
//		printk(KERN_ERR "btipci: no IRQ assigned\n");
		return(-EINVAL);
	}

	/**
	* Finally, actually take the IRQ line...
	*/

//	printk(KERN_INFO "btipci: btidev_enable_irq - Requesting irq %u\n",pCard->irq);

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,19)
	err = request_irq(pCard->irq,					// IRQ number
					  btipci_isr,					// ISR
					  IRQF_SHARED,					// It's a shared handler
					  "btipci",						// the /proc fs name
					  (pCard));						// "client info"
#else
	err = request_irq(pCard->irq,					// IRQ number
					  btipci_isr,					// ISR
					  SA_INTERRUPT | SA_SHIRQ,		// It's a shared handler
					  "btipci",						// the /proc fs name
					  (pCard));						// "client info"
#endif

	if (!err)
	{
		pCard->irqEnabled = 1;
	}
	else
	{
//		printk(KERN_ERR "btipci: failed to claim interrupt\n");
	}

	return(err);
}

/**
* Reverses btidev_enable_irq
*/

int btidev_disable_irq(void *pv)
{
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_disable_irq - Entering\n");

	if (!pCard->irqEnabled)
	{
//		printk(KERN_WARNING "btipci: attempted release of unowned interrupt\n");
		return(0);
	}

//	printk(KERN_INFO "btipci: btidev_disable_irq - Releasing irq %u\n",pCard->irq);

	free_irq(pCard->irq, pCard);
	pCard->irqEnabled = 0;
	return(0);
}

/**
* Sets the interrupt parameters
*/

int btidev_parameter_irq(void *pv,unsigned int* arg)
{
	int j;
	int err = 0;
	unsigned int templ;
	unsigned int corenum;

	unsigned long stataddr;
	unsigned long statoffset;
	int           statindex;
	int           statwidth;
	unsigned int  statmask;
	unsigned int  statvalue;

	unsigned long clraddr;
	unsigned long clroffset;
	int           clrindex;
	int           clrwidth;
	unsigned int  clrmask=0;
	unsigned int  clrvalue;

	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;
	struct bti_pci_card *pIntDev;

//	printk(KERN_INFO "btipci: btidev_parameter_irq - Entering (%p)\n",pv);

	for (j=0;j<10;++j)
	{
		err = btiget_user32(&templ, &arg[j]);
		if (err) return(err);

//		printk(KERN_INFO "btipci: btidev_parameter_irq - index=%u value=%08X\n",j,templ);
	}

	/* Handle OmniBus multi interrupts */
	if (pCard->multi_int)
	{
		err = btiget_user32(&templ, &arg[0]);
		if (err) return(err);
		corenum = templ;
		if (corenum >= MAX_CORES) return(-EINVAL);

		/* Set new pCard and adjust arg pointer */
		pIntDev = pCard->pIntDevs[corenum];
		arg++;

//		printk(KERN_INFO "btipci: btidev_parameter_irq - Multi-Int device (pIntDev=%p)\n",pIntDev);
	}
	else
	{
		pIntDev = pCard;

//		printk(KERN_INFO "btipci: btidev_parameter_irq - Single-Int device (pIntDev=%p)\n",pIntDev);
	}

	err = btiget_user32(&templ,&arg[0]); if (err) return(err); clraddr   = templ;
	err = btiget_user32(&templ,&arg[1]); if (err) return(err); clrwidth  = templ;
	err = btiget_user32(&templ,&arg[2]); if (err) return(err); clrvalue  = templ;
	err = btiget_user32(&templ,&arg[3]); if (err) return(err); stataddr  = templ;
	err = btiget_user32(&templ,&arg[4]); if (err) return(err); statwidth = templ;
	err = btiget_user32(&templ,&arg[5]); if (err) return(err); statvalue = templ;
	err = btiget_user32(&templ,&arg[6]); if (err) return(err); statmask  = templ;

	if (!clraddr || !stataddr)
	{
		pIntDev->clrstatflag = 0;
		pIntDev->statoffset  = 0;
		pIntDev->statindex   = 0;
		pIntDev->statwidth   = 0;
		pIntDev->statmask    = 0;
		pIntDev->statvalue   = 0;
		pIntDev->clroffset   = 0;
		pIntDev->clrindex    = 0;
		pIntDev->clrwidth    = 0;
		pIntDev->clrmask     = 0;
		pIntDev->clrvalue    = 0;

//		printk(KERN_INFO "btidev_parameter_irq - Clearing parameters\n");
		return(0);
	}

	//
	//	Translate status address and width
	//

	err = btidev_translate_addr(0,statwidth,stataddr,&statoffset,&statindex,pCard);

	if (err)
	{
//		printk(KERN_INFO "btipci: btidev_parameter_irq - Unable to translate status address %08lX.\n",stataddr);
		return(err);
	}

	//
	//	Translate clear address and width
	//

	err = btidev_translate_addr(1,clrwidth,clraddr,&clroffset,&clrindex,pCard);

	if (err)
	{
//		printk(KERN_INFO "btipci: btidev_parameter_irq - Unable to translate clear address %08lX.\n",clraddr);
		return(err);
	}

	pIntDev->statoffset = statoffset;
	pIntDev->statindex  = statindex;
	pIntDev->statwidth  = statwidth;
	pIntDev->statmask   = statmask;
	pIntDev->statvalue  = statvalue;

	pIntDev->clroffset  = clroffset;
	pIntDev->clrindex   = clrindex;
	pIntDev->clrwidth   = clrwidth;
	pIntDev->clrmask    = clrmask;
	pIntDev->clrvalue   = clrvalue;

	pIntDev->clrstatflag = 1;

	/* Clear the counts */
	pCard->isr_hitcount = 0;
	pCard->poll_hitcount = 0;

	return(0);
}

int btidev_poll_ready(void *pv)
{
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_poll_ready - Entering (%p)\n",pv);

	if (pCard->poll_hitcount != pCard->isr_hitcount)
	{
		pCard->poll_hitcount++;
		return(1);
	}

	return (0);
}

int btidev_translate_addr(unsigned char clearflag,unsigned int width,unsigned long address,unsigned long* poffset,unsigned int* pindex,struct bti_pci_card* pCard)
{
	unsigned short j;
	unsigned long virt_l;
	unsigned long virt_h;
	int hits=0;

	if (!poffset || !pindex)
	{
//		printk(KERN_ERR "btidev_translate_addr - Cannot pass NULL pointers.\n");
		return(-EIO);
	}

	//
	//	Validate width
	//

	switch(width)
	{
		default:
//			printk(KERN_ERR "btidev_translate_addr - Invalid width %u\n",width);
			return(-EIO);

		case  0: /*printk(KERN_INFO "btidev_translate_addr - Translate %08lX, width 8-bit port (%u)\n",   address,width);*/ break;
		case  1: /*printk(KERN_INFO "btidev_translate_addr - Translate %08lX, width 16-bit port (%u)\n",  address,width);*/ break;
		case  2: /*printk(KERN_INFO "btidev_translate_addr - Translate %08lX, width 32-bit port (%u)\n",  address,width);*/ break;
		case  8: /*printk(KERN_INFO "btidev_translate_addr - Translate %08lX, width 8-bit memory (%u)\n", address,width);*/ break;
		case 16: /*printk(KERN_INFO "btidev_translate_addr - Translate %08lX, width 16-bit memory (%u)\n",address,width);*/ break;
		case 32: /*printk(KERN_INFO "btidev_translate_addr - Translate %08lX, width 32-bit memory (%u)\n",address,width);*/ break;
		case 99:
			if (!clearflag)
			{
//				printk(KERN_ERR "btidev_translate_addr - Invalid width %u\n",width);
				return(-EIO);
			}

			*poffset = 0;
			*pindex  = 0;
//			printk(KERN_INFO "btidev_translate_addr - Width 32-bit memory (%u)\n",width);
			return(0);
	}

	//
	//	Validate width
	//

	if ((width==0 || width==1 || width==2) && !pCard->n_io_win)
	{
//		printk(KERN_ERR "btidev_translate_addr - Width is port (%u), but no port windows are available.\n",width);
		return(-EIO);
	}
	else if ((width==8 || width==16 || width==32) && !pCard->n_mem_win)
	{
//		printk(KERN_ERR "btidev_translate_addr - Width is memory (%u), but no memory windows are available.\n",width);
		return(-EIO);
	}

	//
	//	Figure out offset
	//

	if (width==0 || width==1 || width==2)
	{
		for (j=0;j<pCard->n_io_win;++j)
		{
			virt_l = (pCard->virt[j])                   & 0xFFFFFFFFL;
			virt_h = (pCard->virt[j] + pCard->length[j]) & 0xFFFFFFFFL;

//			printk(KERN_INFO "btidev_translate_addr - virt[%u]=%08lX-%08lX\n",j,virt_l,virt_h);

			if (address>=virt_l && address<virt_h)
			{
				*poffset = address-virt_l;
				*pindex  = j;

//				printk(KERN_INFO "btidev_translate_addr - Port #%u: base=%08lX size=%08zX offset=%08lX\n",j,pCard->virt[j],pCard->length[j],*poffset);

				++hits;
			}
		}
	}
	else if (width==8 || width==16 || width==32)
	{
		for (j=0;j<pCard->n_mem_win;++j)
		{
			virt_l = (pCard->virt[j])                   & 0xFFFFFFFFL;
			virt_h = (pCard->virt[j] + pCard->length[j]) & 0xFFFFFFFFL;

//			printk(KERN_INFO "btidev_translate_addr - virt[%u]=%08lX-%08lX\n",j,virt_l,virt_h);

			if (address>=virt_l && address<virt_h)
			{
				*poffset = address-virt_l;
				*pindex  = j;

//				printk(KERN_INFO "btidev_translate_addr - Mem #%u: base=%08lX size=%08zX offset=%08lX\n",j,pCard->virt[j],pCard->length[j],*poffset);

				++hits;
			}
		}
	}

	//
	//	Did we find it?
	//

	if (hits!=1)
	{
//		printk(KERN_ERR "btidev_translate_addr - Unable to figure index and offset from address %08lX of width %u\n",address,width);
		return(-EIO);
	}

	return(0);
}

// *****************************************************************************
// DMA
// *****************************************************************************

/**
* Installs a DMA buffer
*/

unsigned int btidev_dma_install32(void *pv, unsigned int* arg)
{
	int err;
	unsigned int index;
	unsigned int dmasize;
	void* virt;
	void* phys;
	unsigned long temp;
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_dma_install32 - Entering (%p)\n",pv);

	// Get index
	err = btiget_user32(&index, &arg[0]);
	if (err) return(err);
	if (index >= MAX_DMAS)  return(-EINVAL);
//	printk(KERN_INFO "btipci: btidev_dma_install32 - index=%u\n",index);

	// Check for previous dma allocation
	if (pCard->dmabase_virt[index]) btidev_dma_uninstall32(pv,arg);

	// Get allocation size
	err = btiget_user32(&dmasize, &arg[1]);
	if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_dma_install32 - dmasize=%08X\n",dmasize);

	//
	//	Allocate DMA memory
	//

#if 1
	virt = dma_alloc_coherent(	pCard->deviceptr,
								(size_t)dmasize,
								(dma_addr_t*)&phys,
								GFP_KERNEL);

	if (!virt)
	{
//		printk(KERN_INFO "btipci: btidev_dma_install32 - dma_alloc_coherent() failed\n");
		return (-EINVAL);
	}
#else
	virt = kmalloc((size_t)dmasize,GFP_KERNEL|__GFP_DMA);

	phys = dma_map_single(	pCard->deviceptr,
							virt,
							(size_t)dmasize,
							DMA_FROM_DEVICE);

	if (dma_mapping_error(pCard->deviceptr,phys))
	{
//		printk(KERN_INFO "btipci: btidev_dma_install32 - dma_map_single() failed\n");
		kfree(virt);
		return(-EINVAL);
	}
#endif

//	printk(KERN_INFO "btipci: btidev_dma_install32 - phys=%p\n",phys);
//	printk(KERN_INFO "btipci: btidev_dma_install32 - virt=%p\n",virt);

	// Return addresses
	temp = (unsigned long)phys;
//	printk(KERN_INFO "btipci: btidev_dma_install32 - phystemp=%08lX\n",temp);
	err = btiput_user32(temp,&arg[2]);
	if (err) return(err);
//	printk(KERN_INFO "btipci: btidev_dma_install32 - phys=%p\n",phys);

	temp = (unsigned long)virt;
//	printk(KERN_INFO "btipci: btidev_dma_install32 - virttemp=%08lX\n",temp);
	err = btiput_user32(temp,&arg[3]);
	if (err) return(err);
//	printk(KERN_INFO "btipci: btidev_dma_install32 - virt=%p\n",virt);

	pCard->dmasize[index]      = dmasize;
	pCard->dmabase_phys[index] = (unsigned long)phys;
	pCard->dmabase_virt[index] = (unsigned long)virt;
	pCard->dma_installed         = 1;

//	printk(KERN_INFO "btipci: btidev_dma_install32 - exiting\n");
	return (0);
}

unsigned int btidev_dma_install64(void *pv, unsigned long long* arg)
{
	int err;
	unsigned long long index;
	unsigned long long dmasize;
	void* virt;
	void* phys;
	unsigned long long temp;
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_dma_install64 - Entering (%p)\n",pv);

	// Get index
	err = btiget_user64(&index, &arg[0]);
	if (err) return(err);
	if (index >= MAX_DMAS)  return(-EINVAL);
//	printk(KERN_INFO "btipci: btidev_dma_install64 - index=%llu\n",index);

	// Check for previous dma allocation
	if (pCard->dmabase_virt[index])
	{
//		printk(KERN_INFO "btipci: btidev_dma_install64 - btidev_dma_uninstall64 got called\n");
		btidev_dma_uninstall64(pv,arg);
	}

	// Get allocation size
	err = btiget_user64(&dmasize, &arg[1]);
	if (err) return(err);
//	printk(KERN_INFO "btipci: btidev_dma_install64 - dmasize=%08llX\n",dmasize);

	// Allocate DMA memory

#if 1
	virt = dma_alloc_coherent(	pCard->deviceptr,
								(size_t)dmasize,
								(dma_addr_t*)&phys,
								GFP_KERNEL);

	if (!virt)
	{
//		printk(KERN_INFO "btipci: btidev_dma_install64 - dma_alloc_coherent() failed\n");
		return (-EINVAL);
	}
#else
	virt = kmalloc((size_t)dmasize,GFP_KERNEL|__GFP_DMA);

	phys = dma_map_single(	pCard->deviceptr,
							virt,
							(size_t)dmasize,
							DMA_FROM_DEVICE);

	if (dma_mapping_error(pCard->deviceptr,phys))
	{
//		printk(KERN_INFO "btipci: btidev_dma_install64 - dma_map_single() failed\n");
		kfree(virt);
		return(-EINVAL);
	}
#endif

//	printk(KERN_INFO "btipci: btidev_dma_install64 - phys=%p\n",phys);
//	printk(KERN_INFO "btipci: btidev_dma_install64 - virt=%p\n",virt);

	// Return addresses
	temp = (unsigned long)phys;
	err = btiput_user64(temp,&arg[2]);
	if (err) return(err);
//	printk(KERN_INFO "btipci: btidev_dma_install64 - phys=%p\n",phys);

	temp = (unsigned long)virt;
	err = btiput_user64(temp,&arg[3]);
	if (err) return(err);
//	printk(KERN_INFO "btipci: btidev_dma_install64 - virt=%p\n",virt);

	pCard->dmasize[index]      = dmasize;
	pCard->dmabase_phys[index] = (unsigned long)phys;
	pCard->dmabase_virt[index] = (unsigned long)virt;
	pCard->dma_installed       = 1;

//	printk(KERN_INFO "btipci: btidev_dma_install64 - exiting\n");
	return (0);
}

/**
* Uninstalls a DMA buffer
*/

unsigned int btidev_dma_uninstall32(void *pv, unsigned int* arg)
{
	int err;
	unsigned int index;
	unsigned int dmasize;
	void* virt;
	void* phys;
	int j;
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_dma_uninstall32 - Entering (%p)\n",pv);

	// Get index
	err = btiget_user32(&index, &arg[0]);
	if (err) return(err);
	if (index >= MAX_DMAS)  return(-EINVAL);
//	printk(KERN_INFO "btipci: btidev_dma_uninstall32 - index=%08X\n",index);

	dmasize = pCard->dmasize[index];
	if (!dmasize) return(0);
//	printk(KERN_INFO "btipci: btidev_dma_uninstall32 - size=%08X\n",dmasize);

	virt = (void*)pCard->dmabase_virt[index];
	if (!virt) return(0);
//	printk(KERN_INFO "btipci: btidev_dma_uninstall32 - virt=%p\n",virt);

	phys = (void*)pCard->dmabase_phys[index];
	if (!phys) return(0);
//	printk(KERN_INFO "btipci: btidev_dma_uninstall32 - phys=%p\n",phys);

	//	Free DMA memory

#if 1
	dma_free_coherent(
			pCard->deviceptr,
			(size_t)dmasize,
			virt,
			(dma_addr_t)phys);
#else
	dma_unmap_single(
			pCard->deviceptr,
			phys,
			(size_t)dmasize,
			DMA_FROM_DEVICE);
	kfree(virt);
#endif

	pCard->dmabase_virt[index] = 0;
	pCard->dmabase_phys[index] = 0;
	pCard->dmabase_map[index]  = 0;

	// Check to see if any other core has DMA installed

	for (j=0;j<MAX_DMAS;j++)
	{
		if (pCard->dmabase_virt[j]) break;
	}

	if (j==MAX_DMAS)
	{
		pCard->dma_installed = 0;
	}

//	printk(KERN_INFO "btipci: btidev_dma_uninstall32 - exiting\n");
	return(0);
}

unsigned int btidev_dma_uninstall64(void *pv, unsigned long long* arg)
{
	int err;
	unsigned long long index;
	unsigned long long dmasize;
	void* virt;
	void* phys;
	int j;
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_dma_uninstall64 - Entering (%p)\n",pv);

	// Get index
	err = btiget_user64(&index, &arg[0]);
	if (err) return(err);
	if (index >= MAX_DMAS)  return(-EINVAL);
//	printk(KERN_INFO "btipci: btidev_dma_uninstall64 - index=%08llX\n",index);

	dmasize = pCard->dmasize[index];
	if (!dmasize) return(0);
//	printk(KERN_INFO "btipci: btidev_dma_uninstall64 - size=%08llX\n",dmasize);

	virt = (void*)pCard->dmabase_virt[index];
	if (!virt) return(0);
//	printk(KERN_INFO "btipci: btidev_dma_uninstall64 - virt=%p\n",virt);

	phys = (void*)pCard->dmabase_phys[index];
	if (!phys) return(0);
//	printk(KERN_INFO "btipci: btidev_dma_uninstall64 - phys=%p\n",phys);

	//	Free DMA memory

#if 1
	dma_free_coherent(
			pCard->deviceptr,
			(size_t)dmasize,
			virt,
			(dma_addr_t)phys);
#else
	dma_unmap_single(
			pCard->deviceptr,
			phys,
			(size_t)dmasize,
			DMA_FROM_DEVICE);
	kfree(virt);
#endif

	pCard->dmabase_virt[index] = 0;
	pCard->dmabase_phys[index] = 0;
	pCard->dmabase_map[index]  = 0;
	pCard->dmasize[index]      = 0;

	// Check to see if any other core has DMA installed

	for (j=0;j<MAX_DMAS;j++)
	{
		if (pCard->dmabase_virt[j]) break;
	}

	if (j==MAX_DMAS)
	{
		pCard->dma_installed = 0;
	}

//	printk(KERN_INFO "btipci: btidev_dma_uninstall64 - exiting\n");
	return(0);
}

unsigned int btidev_dmaex_install32(void *pv, unsigned int* arg)
{
	int err;
	unsigned int index;
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_dmaex_install32 - Entering (%p)\n",pv);

	// Find unused index

	for (index=0;index<MAX_DMAS;++index)
	{
		if (!pCard->dmabase_virt[index]) break;
	}

	if (index>=MAX_DMAS) return(-EINVAL);			//No open slots

//	printk(KERN_INFO "btipci: btidev_dmaex_install32 - index=%u\n",index);

	// Replace arg with actual index

	err = btiput_user32(index,&arg[0]);
	if (err) return(err);

	// Proceed to original function

	return(btidev_dma_install32(pv,arg));
}

unsigned int btidev_dmaex_install64(void *pv, unsigned long long* arg)
{
	int err;
	unsigned long long index;
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_dmaex_install64 - Entering (%p)\n",pv);

	// Find unused index

	for (index=0;index<MAX_DMAS;++index)
	{
		if (!pCard->dmabase_virt[index]) break;
	}

	if (index>=MAX_DMAS) return(-EINVAL);			//No open slots

//	printk(KERN_INFO "btipci: btidev_dmaex_install64 - index=%llu\n",index);

	// Replace arg with actual index

	err = btiput_user64(index,&arg[0]);
	if (err) return(err);

	// Proceed to original function

	return(btidev_dma_install64(pv,arg));
}

unsigned int btidev_dmaex_uninstall32(void *pv, unsigned int* arg)
{
	int err;
	unsigned int index;
	unsigned int phys;
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_dmaex_uninstall32 - Entering (%p)\n",pv);

	// Get phys address
	err = btiget_user32(&phys,&arg[1]);
	if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_dmaex_uninstall32 - phys=%08X\n",phys);

	// Find the index

	for (index=0;index<MAX_DMAS;++index)
	{
		if (pCard->dmabase_phys[index]==phys) break;
	}

	if (index>=MAX_DMAS) return(-EINVAL);			//No open slots

//	printk(KERN_INFO "btipci: btidev_dmaex_uninstall32 - index=%08X\n",index);

	// Replace arg with actual index

	err = btiput_user32(index,&arg[0]);
	if (err) return(err);

	// Proceed to original function

	return(btidev_dma_uninstall32(pv,arg));
}

unsigned int btidev_dmaex_uninstall64(void *pv,unsigned long long* arg)
{
	int err;
	unsigned long long index;
	unsigned long long phys;
	struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btipci: btidev_dmaex_uninstall64 - Entering (%p)\n",pv);

	// Get phys address

	err = btiget_user64(&phys,&arg[1]);
	if (err) return(err);

//	printk(KERN_INFO "btipci: btidev_dmaex_uninstall64 - phys=%08llX\n",phys);

	// Find the index

	for (index=0;index<MAX_DMAS;++index)
	{
		if (pCard->dmabase_phys[index]==phys) break;
	}

	if (index>=MAX_DMAS)
	{
		printk(KERN_ERR "btipci: btidev_dmaex_uninstall64 - Unable to find phys=%08llX\n",phys);
		return(-EINVAL);			//No open slots
	}

//	printk(KERN_INFO "btipci: btidev_dmaex_uninstall64 - index=%08llX\n",index);

	// Replace arg with actual index

	err = btiput_user64(index,&arg[0]);
	if (err) return(err);

	// Proceed to original function

	return(btidev_dma_uninstall64(pv,arg));
}

/**
*
*	Verifies that a requested memory mapping actually lies inside one of the
*	specified device's memory regions.
*
**/

int btidev_validate_mmap_request(const void* pv,void** virt,unsigned long base,size_t len,int* isdma)
{
	int i;
	unsigned long windowBase;
	const struct bti_pci_card *pCard = (struct bti_pci_card*)pv;

//	printk(KERN_INFO "btidev_validate_mmap_request - Entering\n");
//	printk(KERN_INFO "btidev_validate_mmap_request - base=%08lX len=%08zX\n",base,len);

	for (i=0;i<pCard->n_mem_win;++i)
	{
		windowBase = pCard->phys[i];

//		printk(KERN_INFO "btidev_validate_mmap_request - Checking phys[%u] = %08lX\n",i,windowBase);

		/**
		*
		* If the device's memory window is small (PAGE_SIZE*2 for allignment), then
		* verify the memory region falls within the requested size.  Otherwise, verify
		* the requested region falls within the device's memory window.
		*
		**/

		if (pCard->length[i] <= (PAGE_SIZE*2))
		{
			if ((base <= windowBase) && ((windowBase + pCard->length[i]) <= (base + len)))
			{
				if (isdma) *isdma=0;
//				printk(KERN_INFO "btidev_validate_mmap_request - Succeeded (is PCI)\n");
				return(1);
			}
		}
		else
		{
			if ((windowBase <= base) && ((base + len) <= (windowBase + pCard->length[i])))
			{
				if (isdma) *isdma=0;
//				printk(KERN_INFO "btidev_validate_mmap_request - Succeeded (is PCI)\n");
				return(1);
			}
		}
	}

	for (i=0;pCard->dma_installed && i<MAX_DMAS;i++)
	{
		if (!(pCard->dmasize[i])) continue;

		windowBase = pCard->dmabase_phys[i];

//		printk(KERN_INFO "btidev_validate_mmap_request - Checking dmaphys[%u] = %08lX\n",i,windowBase);

		/**
		*
		* If the device's memory window is small (PAGE_SIZE*2 for allignment), then
		* verify the memory region falls within the requested size.  Otherwise, verify
		* the requested region falls within the device's memory window.
		*
		**/

		if (pCard->dmasize[i] <=(PAGE_SIZE*2))
		{
			if ((base <= windowBase) && ((windowBase + pCard->dmasize[i]) <= (base + len)))
			{
				if (isdma) *isdma=1;
//				printk(KERN_INFO "btidev_validate_mmap_request - Succeeded (is DMA)\n");
				if (virt) *virt=(void*)pCard->dmabase_virt[i];
				return(1);
			}
		}
		else
		{
			if ((windowBase <= base) && ((base + len) <= (windowBase + pCard->dmasize[i])))
			{
				if (isdma) *isdma=1;
//				printk(KERN_INFO "btidev_validate_mmap_request - Succeeded (is DMA)\n");
				if (virt) *virt=(void*)pCard->dmabase_virt[i];
				return(1);
			}
		}
	}

//	printk(KERN_INFO "btidev_validate_mmap_request - Failed\n");

	return(0);
}

static int btipci_open(struct inode* pn,struct file* pf)
{
	int devnum;
	struct bti_pci_card *pCard=NULL;
	unsigned int devIndex;
	unsigned int cardnum;
	unsigned int corenum;
	unsigned int fIntFile;

//	printk(KERN_INFO "open - Entering\n");

	devnum = pn->i_rdev;

	devIndex = MINOR(devnum);
	fIntFile = 0;

//	printk(KERN_INFO "btidev_open - Entering\n");
//	printk(KERN_INFO "btidev_open - %d %d\n",MAJOR(devnum),MINOR(devnum));
//	printk(KERN_INFO "btidev_open - devIndex=%d\n",devIndex);

	//
	//	Handle special interrupt nodes

	if (devIndex >= BTIPCI_INT_MINOR)
	{
		fIntFile = 1;
		cardnum = (devIndex-BTIPCI_INT_MINOR) / MAX_CORES;
		corenum = (devIndex-BTIPCI_INT_MINOR) % MAX_CORES;

		if (cardnum < MAX_DEVICES)
		{
			pCard = &(bti_pci_ints[cardnum][corenum]);
		}
	}
	else if ((devIndex<MAX_DEVICES) && (devIndex<pci_count))
	{
		cardnum = devIndex;
		corenum = 0;
		pCard = &(bti_pci_cards[cardnum]);
	}
	else
	{
		cardnum = devIndex;
		corenum = 0;
		pCard = NULL;
	}

//	printk(KERN_INFO "btidev_open - cardnum=%d\n",cardnum);

	if (!pCard)
	{
//		printk(KERN_INFO "btipci: Unable to open PCI card #%u\n",cardnum);
		return(-ENODEV);
	}

	pCard->references++;

	//
	//	If this is an interrupt mode, initialize the poll_wq
	//	and the associated pollwq_valid flag, and disable some
	//	of the file operations that don't make sense
	//

	if (fIntFile)
	{
		init_waitqueue_head(&pCard->poll_wq);
		pCard->pollwq_valid  = 1;

		pCard->skip_ioctl  = 1;
		pCard->skip_mmap   = 1;
		pCard->skip_fasync = 1;

//		printk("%s" "btipci: Opened Interrupt for card #%u core #%u\n",DEBUG_ENABLE > 0 ? KERN_ALERT : KERN_INFO, cardnum, corenum);
	}
	else
	{
//		printk("%s" "btipci: Opened PCI card #%u core #%u, vendor %04X, device %04X, subvendor %04X, subdevice %04X\n",DEBUG_ENABLE > 0 ? KERN_ALERT : KERN_INFO, cardnum, corenum, pCard->vendor_id, pCard->device_id, pCard->subvendor_id, pCard->subdevice_id);
	}

//	printk(KERN_INFO "btipci: btidev_open - pCard=%p\n",pCard);

	pf->private_data = pCard;

	return(0);
}

static int btipci_release(struct inode* pn,struct file* pf)
{
	struct bti_pci_card *pCard;

//	printk(KERN_INFO "btipci: release - Entering\n");

	pCard = (struct bti_pci_card*)pf->private_data;

	if (--pCard->references<1)
	{
		/**
		* All processes are letting go, so make sure interrupts are
		* turned off.
		*/

		if (pCard->irqEnabled)
		{
//			printk(KERN_NOTICE "device closed with interrupts enabled, disabling now\n");
			btidev_disable_irq(pCard);
		}
	}

//	printk(KERN_INFO "btipci: release - Closing card\n");

	pf->private_data = NULL;

	return(0);
}

static int btipci_ioctl(struct inode* pn,struct file* pf,unsigned int cmd,unsigned long arg)
{
	struct bti_pci_card* pCard = (struct bti_pci_card*)pf->private_data;

	int err = 0;
	void *pv = pf->private_data;
	const int nr = _IOC_NR(cmd);
	const int argsize = _IOC_SIZE(cmd);

	if (!pCard)
	{
//		printk(KERN_ALERT "btipci: device private data missing\n");
		return(-ENODEV);
	}

	if (pCard->skip_ioctl)
	{
//		printk(KERN_ALERT "btipci: ioctl - Skipping because of skip_ioctl flag\n");
		return(-EPERM);
	}

	if (BTI_MAGIC!=_IOC_TYPE(cmd))
	{
		return(-EBADRQC);
	}

//	printk(KERN_INFO "ioctl -     cmd=%08X\n",  cmd);
//	printk(KERN_INFO "ioctl -     arg=%08lX\n", arg);
//	printk(KERN_INFO "ioctl -      nr=%02X\n",  nr);
//	printk(KERN_INFO "ioctl -   magic=%02X\n",  _IOC_TYPE(cmd));
//	printk(KERN_INFO "ioctl - argsize=%03X\n",  argsize);
//	printk(KERN_INFO "ioctl -     dir=%u\n",    _IOC_DIR(cmd));

	switch(nr)
	{
		case BASE_IOCTL_MEM_RDB_SINGLE:
//			printk(KERN_INFO "ioctl - Mem byte read\n");
			err = btidev_peekb(pv,(unsigned int*)arg);
			break;

		case BASE_IOCTL_MEM_WRB_SINGLE:
//			printk(KERN_INFO "ioctl - Mem byte write\n");
			err = btidev_pokeb(pv,(unsigned int*)arg);
			break;

		case BASE_IOCTL_MEM_RDW_SINGLE:
//			printk(KERN_INFO "ioctl - Mem word read\n");
			err = btidev_peekw(pv,(unsigned int*)arg);
			break;

		case BASE_IOCTL_MEM_WRW_SINGLE:
//			printk(KERN_INFO "ioctl - Mem word write\n");
			err = btidev_pokew(pv,(unsigned int*)arg);
			break;

		case BASE_IOCTL_MEM_RDL_SINGLE:
//			printk(KERN_INFO "ioctl - Mem long read\n");
			err = btidev_peekl(pv,(unsigned int*)arg);
			break;

		case BASE_IOCTL_MEM_WRL_SINGLE:
//			printk(KERN_INFO "ioctl - Mem long write\n");
			err = btidev_pokel(pv,(unsigned int*)arg);
			break;

		case BASE_IOCTL_MEM_RDLL_SINGLE:
//			printk(KERN_INFO "ioctl - Mem long long read\n");
			err = btidev_peekll(pv,(unsigned long long*)arg);
			break;

		case BASE_IOCTL_MEM_WRLL_SINGLE:
//			printk(KERN_INFO "ioctl - Mem long long write\n");
			err = btidev_pokell(pv,(unsigned long long*)arg);
			break;

		case BASE_IOCTL_PORT_RDB_SINGLE:
			ASSERT(argsize==4);
//			printk(KERN_INFO "ioctl - Port byte read\n");
			err = btidev_inb(pv,(unsigned short*)arg);
			break;

		case BASE_IOCTL_PORT_WRB_SINGLE:
			ASSERT(argsize==4);
//			printk(KERN_INFO "ioctl - Port byte write\n");
			err = btidev_outb(pv,arg);
			break;

		case BASE_IOCTL_PORT_RDW_SINGLE:
			ASSERT(argsize==4);
//			printk(KERN_INFO "ioctl - Port word read\n");
			err = btidev_inw(pv,(unsigned short*)arg);
			break;

		case BASE_IOCTL_PORT_WRW_SINGLE:
			ASSERT(argsize==4);
//			printk(KERN_INFO "ioctl - Port word write\n");
			err = btidev_outw(pv,arg);
			break;

		case BASE_IOCTL_INTERRUPT_ON:
//			printk(KERN_INFO "ioctl - Interrupt on\n");
			err = btidev_enable_irq(pv);
			break;

		case BASE_IOCTL_INTERRUPT_OFF:
//			printk(KERN_INFO "ioctl - Interrupt off\n");
			err = btidev_disable_irq(pv);
			break;

		case BASE_IOCTL_INTERRUPT_PARAM:
//			printk(KERN_INFO "ioctl - Interrupt param\n");
			err = btidev_parameter_irq(pv,(unsigned int*)arg);
			break;

		case BASE_IOCTL_DMA_INSTALL:
			ASSERT(argsize==4 || argsize==8);
//			printk(KERN_INFO "ioctl - DMA Install\n");
			if (8==argsize)
			{
				err = btidev_dma_install64(pv,(unsigned long long*)arg);
			}
			else
			{
				err = btidev_dma_install32(pv,(unsigned int*)arg);
			}
			break;

		case BASE_IOCTL_DMA_UNINSTALL:
			ASSERT(argsize==4 || argsize==8);
//			printk(KERN_INFO "ioctl - DMA Uninstall\n");
			if (8==argsize)
			{
				err = btidev_dma_uninstall64(pv,(unsigned long long*)arg);
			}
			else
			{
				err = btidev_dma_uninstall32(pv,(unsigned int*)arg);
			}
			break;


		case BASE_IOCTL_DMAEX_INSTALL:
			ASSERT(argsize==4 || argsize==8);
//			printk(KERN_INFO "ioctl - DMAEX Install\n");
			if (8==argsize)
			{
				err = btidev_dmaex_install64(pv,(unsigned long long*)arg);
			}
			else
			{
				err = btidev_dmaex_install32(pv,(unsigned int*)arg);
			}
			break;

		case BASE_IOCTL_DMAEX_UNINSTALL:
			ASSERT(argsize==4 || argsize==8);
//			printk(KERN_INFO "ioctl - DMAEX Uninstall\n");
			if (8==argsize)
			{
				err = btidev_dmaex_uninstall64(pv,(unsigned long long*)arg);
			}
			else
			{
				err = btidev_dmaex_uninstall32(pv,(unsigned int*)arg);
			}
			break;

		case BASE_IOCTL_GET_SLOTNUM:
			ASSERT(argsize==1);
//			printk(KERN_INFO "ioctl - Get slot number\n");
			err = btiput_user32(btidev_get_slotnum(pv),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got slot number\n");
			break;

		case BASE_IOCTL_GET_MEMIOCOUNT:
			ASSERT(argsize==1);
//			printk(KERN_INFO "ioctl - Get IO count\n");
			err = btiput_user32(btidev_get_wincount(pv,WINTYPE_IO),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got IO count\n");
			break;

		case BASE_IOCTL_GET_MEMWINCOUNT:
			ASSERT(argsize==1);
//			printk(KERN_INFO "ioctl - Get MEM count\n");
			err = btiput_user32(btidev_get_wincount(pv,WINTYPE_MEM),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got MEM count\n");
			break;

		case BASE_IOCTL_GET_VENDORID:
			ASSERT(argsize==2);
//			printk(KERN_INFO "ioctl - Get vendor id\n");
			err = btiput_user32(btidev_get_vendorid(pv),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got vendor id\n");
			break;

		case BASE_IOCTL_GET_DEVICEID:
			ASSERT(argsize==2);
//			printk(KERN_INFO "ioctl - Get device id\n");
			err = btiput_user32(btidev_get_deviceid(pv),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got device id\n");
			break;

		case BASE_IOCTL_GET_SUBVENDORID:
			ASSERT(argsize==2);
//			printk(KERN_INFO "ioctl - Get subvendor id\n");
			err = btiput_user32(btidev_get_subvendorid(pv),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got subvendor id\n");
			break;

		case BASE_IOCTL_GET_SUBDEVICEID:
			ASSERT(argsize==2);
//			printk(KERN_INFO "ioctl - Get subdevice id\n");
			err = btiput_user32(btidev_get_subdeviceid(pv),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got subdevice id\n");
			break;

		case BASE_IOCTL_GET_VENDORSTR:
			ASSERT(argsize==4 || argsize==8);
//			printk(KERN_INFO "ioctl - Get vendor str\n");
			err = copy_to_user((char*)arg, btidev_get_vendorstr(pv), 32);
//			printk(KERN_INFO "ioctl - Got vendor str\n");
			break;

		case BASE_IOCTL_GET_DEVICESTR:
			ASSERT(argsize==4 || argsize==8);
//			printk(KERN_INFO "ioctl - Get device str\n");
			err = copy_to_user((char*)arg, btidev_get_devicestr(pv), 32);
//			printk(KERN_INFO "ioctl - Got device str\n");
			break;

		case BASE_IOCTL_GET_CARDTYPE:
			ASSERT(argsize==4 || argsize==8);
//			printk(KERN_INFO "ioctl - Get card type\n");
			err = btiput_user32(btidev_get_cardtype(pv),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got card type\n");
			break;

		case BASE_IOCTL_GET_IRQNUM:
			ASSERT(argsize==1);
//			printk(KERN_INFO "ioctl - Get irq number\n");
			err = btiput_user32(btidev_get_irqnum(pv),(unsigned int*)arg);
//			printk(KERN_INFO "ioctl - Got irq number\n");
			break;

		case BASE_IOCTL_GET_PARENT:
			ASSERT(argsize==4 || argsize==8);
//			printk(KERN_INFO "ioctl - Get parent\n");

#ifdef __LP64__
			err = btiput_user64((unsigned long long)btidev_get_parent(pv),(unsigned long long*)arg);
#else
			err = btiput_user32((unsigned int)btidev_get_parent(pv),(unsigned int*)arg);
#endif

//			printk(KERN_INFO "ioctl - Got parent\n");
			break;

#ifdef _DEBUG

		// In the event of an Oops in the kernel this allows us to forcibly lower
		// the module's usage count, so we can get the offending mess unloaded.

		case BASE_IOCTL_DBG_RESET_USAGE:
//			printk(KERN_INFO "ioctl - Force usage count to zero\n");
//			__this_module.uc.usecount.counter = 1;
			// ...not 0, because the process performing this call must still release!
			break;

#endif

		default:
			// mem window queries

			if (BASE_IOCTL_MEMWINSIZE <= nr && nr < (BASE_IOCTL_MEMWINSIZE+MAX_WINDOWS_MEM))
			{
				unsigned long size;
				ASSERT(argsize==4 || argsize==8);
//				printk(KERN_INFO "ioctl - Get MEM window size\n");
				size = btidev_get_winsize(pv,WINTYPE_MEM, nr - BASE_IOCTL_MEMWINSIZE);
				err = btiput_user32(size,(unsigned int*)arg);
//				printk(KERN_INFO "ioctl - Got MEM window size %08lX\n",size);
			}
			else if (BASE_IOCTL_MEMWINBASE <= nr && nr < (BASE_IOCTL_MEMWINBASE+MAX_WINDOWS_MEM))
			{
				unsigned long base;
				ASSERT(argsize==4 || argsize==8);
//				printk(KERN_INFO "ioctl - Get MEM window base\n");
				base = btidev_get_winbase(pv, WINTYPE_MEM, nr - BASE_IOCTL_MEMWINBASE);
				if (argsize==4) err = btiput_user32(base,(unsigned int*) arg);
				if (argsize==8) err = btiput_user64(base,(unsigned long long*)arg);
//				printk(KERN_INFO "ioctl - Got MEM window base %08lX\n",base);
			}
			else if (BASE_IOCTL_VIRTWINBASE <= nr && nr < (BASE_IOCTL_VIRTWINBASE+MAX_WINDOWS_MEM))
			{
				unsigned long base;
				ASSERT(argsize==4 || argsize==8);
//				printk(KERN_INFO "ioctl - Get VIRT window base\n");
				base = btidev_get_winbase(pv, WINTYPE_VIRT,nr - BASE_IOCTL_VIRTWINBASE);
				if (argsize==4) err = btiput_user32(base,(unsigned int*)arg);
				if (argsize==8) err = btiput_user64(base,(unsigned long long*)arg);
//				printk(KERN_INFO "ioctl - Got VIRT window base %08lX\n",base);
			}
			else if (BASE_IOCTL_IOWINSIZE <= nr && nr < (BASE_IOCTL_IOWINSIZE+MAX_WINDOWS_IO))	// I/O window queries
			{
				unsigned long size;
				ASSERT(argsize==4);
//				printk(KERN_INFO "ioctl - Get IO window size\n");
				size = btidev_get_winsize(pv,WINTYPE_IO, nr - BASE_IOCTL_IOWINSIZE);
				err = btiput_user32(size,(unsigned int*)arg);
//				printk(KERN_INFO "ioctl - Got IO window size %08lX\n",size);
			}
			else if (BASE_IOCTL_IOWINBASE <= nr && nr < (BASE_IOCTL_IOWINBASE+MAX_WINDOWS_IO))
			{
				unsigned long base;
				ASSERT(argsize==4 || argsize==8);
//				printk(KERN_INFO "ioctl - Get IO window base\n");
				base = btidev_get_winbase(pv,WINTYPE_IO,nr - BASE_IOCTL_IOWINBASE);
				if (argsize==4) err = btiput_user32(base,(unsigned int*)arg);
				if (argsize==8) err = btiput_user64(base,(unsigned long long*)arg);
//				printk(KERN_INFO "ioctl - Got IO window base %08lX\n",base);
			}
			else
			{
				err = -EBADRQC;
			}

			break;
	}

	return(err);
}

#if defined(HAVE_UNLOCKED_IOCTL) || (LINUX_VERSION_CODE >= KERNEL_VERSION(5,0,0))

static long btipci_unlocked_ioctl(struct file* pf,unsigned int cmd,unsigned long arg)
{
	return(btipci_ioctl(NULL,pf,cmd,arg));
}

#endif

#if defined(HAVE_COMPAT_IOCTL) || (LINUX_VERSION_CODE >= KERNEL_VERSION(5,0,0))

static long btipci_compat_ioctl(struct file* pf,unsigned int cmd,unsigned long arg)
{
	return(btipci_ioctl(NULL,pf,cmd,arg));
}

#endif

/**
*
*	Notice that vm_pgoff member of vm_area_struct is not interpreted
*	by the kernel. It is up to the driver handling the "file system"
*	to interpret it.
*	vm_pgoff is the (PCI high-memory) physical address to map.
*
*	FYI: You can get an the inode in here via: pf->f_dentry->d_inode.
*
**/

static int btipci_mmap(struct file* pf,struct vm_area_struct* pVMA)
{
	int isdma=0;

	void* virt;

	struct bti_pci_card* pCard = (struct bti_pci_card*)pf->private_data;

	const unsigned long vm_size = pVMA->vm_end - pVMA->vm_start;
	const dma_addr_t phys = pVMA->vm_pgoff<<PAGE_SHIFT;

	int err = 0;

//	printk(KERN_INFO "btipci: mmap -     vm_start=%08lX\n",pVMA->vm_start);
//	printk(KERN_INFO "btipci: mmap -       vm_end=%08lX\n",pVMA->vm_end);
//	printk(KERN_INFO "btipci: mmap -     vm_pgoff=%08lX\n",pVMA->vm_pgoff);
//	printk(KERN_INFO "btipci: mmap -      vm_size=%08lX\n",vm_size);
//	printk(KERN_INFO "btipci: mmap - vm_page_prot=%08X\n", pVMA->vm_page_prot);

	if (!pCard)
	{
		printk(KERN_ALERT "btipci: mmap - Device private data missing\n");
		return(-ENODEV);
	}

	if (pCard->skip_mmap)
	{
		printk(KERN_INFO "btipci: mmap - Skipping because of skip_mmap flag\n");
		return(-EPERM);
	}

	/**
	*	Calculate offset depending upon kernel version.
	*/

//	printk(KERN_INFO "btipci: mmap - Mapping physical 0x%08lX - 0x%08lX to virtual 0x%08lX\n",pVMA->vm_pgoff,pVMA->vm_pgoff + vm_size - 1,pVMA->vm_start);

	if (!btidev_validate_mmap_request(pf->private_data,&virt,phys,vm_size,&isdma))
	{
//		printk(KERN_ERR "btipci: mmap - Validate failed\n");
		return(-EINVAL);	//isValidMemoryRange logs its own msg.
	}

	if (0 != (vm_size % PAGE_SIZE))
	{
//		printk(KERN_ERR "btipci: mmap - Requested memmory range not PAGE_SIZE multiple\n");
		return(-EINVAL);
	}

	err=dma_set_mask_and_coherent(pCard->deviceptr,DMA_BIT_MASK(32));

	if (err)
	{
		printk(KERN_ERR "btipci: mmap - Unable set DMA mask to 32\n");
		return(err);
	}

	if (!isdma)
	{
		// Disable caching on buffer

		pVMA->vm_page_prot = pgprot_noncached(pVMA->vm_page_prot);

		// Perform the mapping...

		err = remap_pfn_range(pVMA,pVMA->vm_start,pVMA->vm_pgoff,vm_size,pVMA->vm_page_prot);

		if (err)
		{
			printk(KERN_ERR "btipci: mmap - remap_page_range() failed err=%d\n",err);
			return(err);
		}
	}
	else
	{
		//Reset offset to start of page

		pVMA->vm_pgoff=0;

		// Perform the mapping...

		err=dma_mmap_coherent(pCard->deviceptr,pVMA,virt,phys,vm_size);

		if (err)
		{
			printk(KERN_ERR "btipci: mmap - dma_mmap_coherent() failed err=%d\n",err);
			return(err);
		}
	}

	/**
	*	Following just guarantees that this driver isn't unloaded before
	*	munmap() is called. Subsequent mappings occur in the open vm_op.
	*/

#if LINUX_VERSION_CODE < KERNEL_VERSION(2,6,0)

	MOD_INC_USE_COUNT;	// ...since l13_vma_open wasn't called this time.

#endif

//	printk(KERN_INFO "btipci: mmap - Exiting %d\n",err);

	return(err);
}

static int btipci_fasync(int v,struct file* pf,int i)
{
	struct bti_pci_card *pCard = (struct bti_pci_card*)pf->private_data;

//	printk(KERN_INFO "btipci: fasync - Entering (%i,%p,%i)\n",v,pf,i);

	if (!pCard)
	{
//		printk(KERN_ALERT "btipci: device private data missing\n");
		return(-ENODEV);
	}

	if (pCard->skip_fasync)
	{
//		printk(KERN_INFO "fasync - Skipping because of skip_fasync flag\n");
		return(-EPERM);
	}

	/**
	*
	* Kernel provides convenience API for the very generic work of
	* notifying interested processes of async I/O. We hold a
	* struct fasync_struct**, but the kernel does all the linked list
	* maintenance. Just defer to kernel...
	*
	**/

	return(fasync_helper(v,pf,i,&(pCard->fasync_list)));
}

static unsigned int btipci_poll(struct file* pf,poll_table* wait)
{
	struct bti_pci_card *pCard = (struct bti_pci_card*)pf->private_data;

	unsigned int flags = 0;

//	printk(KERN_INFO "btipci: poll - Entering (%p,%p)\n",pf,wait);

	if (!pCard)
	{
//		printk(KERN_ALERT "btipci: device private data missing\n");
		return(-ENODEV);
	}

	if (!pCard->pollwq_valid)
	{
//		printk(KERN_INFO "btipci: poll - Skipping because poll_wq is not valid\n");
		return(-EPERM);
	}

	poll_wait(pf, &pCard->poll_wq, wait);

	if (btidev_poll_ready((void *)pCard))
	{
		flags |= POLLIN;
	}

//	printk(KERN_INFO "btipci: poll - Exiting (flags=%08lX)\n", (unsigned long)flags);

	return(flags);
}

/**
*
*/

struct file_operations btipci_methods =
{

#if defined(HAVE_UNLOCKED_IOCTL) || (LINUX_VERSION_CODE >= KERNEL_VERSION(5,0,0))
	.unlocked_ioctl = btipci_unlocked_ioctl,
#else
	.ioctl = btipci_ioctl,
#endif

	.mmap    = btipci_mmap,
	.open    = btipci_open,
	.release = btipci_release,
	.fasync  = btipci_fasync,
	.poll    = btipci_poll,

#if defined(HAVE_COMPAT_IOCTL) || (LINUX_VERSION_CODE >= KERNEL_VERSION(5,0,0))
	.compat_ioctl = btipci_compat_ioctl,
#endif

};

static int btipci_probe(struct pci_dev* pdev,const struct pci_device_id* ent)
{
	int err;
	int hit;
	int j;
	int jj;
	int cardnum;
	int devnum;
	int intnum;
	char devname[64];
	char intname[64];
	int devminornum;
	struct bti_pci_card *pCard;
	void* pvmem;

	struct btipci_cardtype* cardtypeptr = (struct btipci_cardtype*)ent->driver_data;

//	printk(KERN_INFO "btipci: btipci_probe - Entering\n");

//	printk(KERN_INFO "btipci: btipci_probe -     vendor=%04X\n",ent->vendor);
//	printk(KERN_INFO "btipci: btipci_probe -     device=%04X\n",ent->device);
//	printk(KERN_INFO "btipci: btipci_probe -  subvendor=%04X\n",ent->subvendor);
//	printk(KERN_INFO "btipci: btipci_probe -  subdevice=%04X\n",ent->subdevice);
//	printk(KERN_INFO "btipci: btipci_probe -      class=%04X\n",ent->class);
//	printk(KERN_INFO "btipci: btipci_probe -       mask=%04X\n",ent->class_mask);
//	printk(KERN_INFO "btipci: btipci_probe -   cardtype=%d\n",  cardtypeptr->cardtype);
//	printk(KERN_INFO "btipci: btipci_probe -   cardname=%s\n",  cardtypeptr->cardname);
//	printk(KERN_INFO "btipci: btipci_probe -    devbase=%s\n",  cardtypeptr->devbase);
//	printk(KERN_INFO "btipci: btipci_probe - multi_core=%d\n",  cardtypeptr->multi_core);
//	printk(KERN_INFO "btipci: btipci_probe -  multi_int=%d\n",  cardtypeptr->multi_int);
//	printk(KERN_INFO "btipci: btipci_probe -        irq=%d\n",  pdev->irq);
//	printk(KERN_INFO "btipci: btipci_probe -        irq=%d\n",  pdev->irq);

	//
	//	Enable PCI device before touching it
	//

//	printk(KERN_INFO "btipci: btipci_probe - Enabling PCI card");

	err = pci_enable_device(pdev);
	if (err) return(err);

	//
	//	Enable bus mastering
	//

//	printk(KERN_INFO "btipci: btipci_probe - Enabling bus mastering");

	pci_set_master(pdev);

	//
	//	Get an available card number (number to the right of the period in the device name)
	//

//	printk(KERN_INFO "btipci: btipci_probe - Getting next card number for %s\n",cardtypeptr->devbase);

	for (cardnum=0;cardnum<MAX_DEVICES;++cardnum)
	{
		sprintf(devname,"%s.%d",cardtypeptr->devbase,cardnum);

		for (hit=0,j=0;j<MAX_DEVICES;++j)
		{
			pCard = &(bti_pci_cards[j]);

			if (pCard->inuse)
			{
//				printk(KERN_INFO "btipci: btipci_probe - %d Comparing %s to %s\n",j,devname,pCard->devname);

				if (!strcmp(devname,pCard->devname))
				{
					hit=1;
				}
			}
		}

		if (!hit) break;
	}

	if (hit)
	{
//		printk(KERN_INFO "btipci: btipci_probe - Unable to find a card number for %s\n",cardtypeptr->devbase);
		return(1);
	}

//	printk(KERN_INFO "btipci: btipci_probe - Using devname %s with cardnum #%d\n",cardtypeptr->devbase,cardnum);

	//
	//	Find an unused minor number
	//

//	printk(KERN_INFO "btipci: btipci_probe - Finding an available minor number for %s\n",devname);

	for (devminornum=-1,j=0;j<MAX_DEVICES;++j)
	{
		pCard = &(bti_pci_cards[j]);

		if (!(pCard->inuse))
		{
			devminornum = j;
			break;
		}
	}

	if (devminornum<0)
	{
//		printk(KERN_INFO "btipci: btipci_probe - Unable to find available minor number\n");
		return(1);
	}

//	printk(KERN_INFO "btipci: btipci_probe - Using minor number %d for %s\n",devminornum,devname);

	//
	//	Use the selected device struct
	//

	pCard = &(bti_pci_cards[devminornum]);

	for (j=0;j<MAX_CORES;j++)
	{
		pCard->pIntDevs[j] = &(bti_pci_ints[devminornum][j]);
	}

	devnum = MKDEV(MAJOR(MAJOR_NUM),devminornum);
	pCard->inuse = 1;
	pCard->pdev  = pdev;
	strcpy(pCard->devname,devname);
	pCard->devnum  = devnum;
	pCard->cardnum = cardnum;

	pCard->irq          = pdev->irq;
	pCard->bus          = pdev->bus->number;
	pCard->slot         = PCI_SLOT(pdev->devfn);
	pCard->parent       = pdev->bus->parent;
	pCard->vendor_id    = ent->vendor;
	pCard->device_id    = ent->device;
	pCard->subvendor_id = ent->subvendor;
	pCard->subdevice_id = ent->subdevice;
	pCard->multi_core   = cardtypeptr->multi_core;
	pCard->multi_int    = cardtypeptr->multi_int;
	pCard->cardtype     = cardtypeptr->cardtype;
	pCard->deviceptr    = &(pdev->dev);

	//
	//	Retrieve base address of memory windows
	//

	for (pCard->n_mem_win=0,jj=0,j=0;j<DEVICE_COUNT_RESOURCE;++j)
	{
		if (pdev->resource[j].name && pdev->resource[j].start && (IORESOURCE_MEM & pdev->resource[j].flags))
		{
//			printk(KERN_INFO "btipci: btipci_probe - %d %08zX-%08zX\n",j,pdev->resource[j].start,pdev->resource[j].end);

			pCard->virt[jj]   = 0;
			pCard->phys[jj]   = pdev->resource[j].start;
			pCard->length[jj] = pdev->resource[j].end - pdev->resource[j].start + 1L;

			++(pCard->n_mem_win);

			//
			//	Map to non-cacheable virtual memory
			//

#if LINUX_VERSION_CODE >= KERNEL_VERSION(3,0,0)
			pvmem = ioremap(pCard->phys[jj],pCard->length[jj]);
#else
			pvmem = ioremap_nocache(pCard->phys[jj],pCard->length[jj]);
#endif

			if (pvmem)
			{
//				printk(KERN_INFO "btipci: btipci_probe - Mapping Phys:%08lX to Virt:%08lX of window %u\n",pCard->phys[j],(unsigned long)pvmem,j);

				pCard->virt[jj] = (unsigned long)pvmem;
			}

			++jj;
		}
	}

	//
	//	Create device node
	//

//	printk(KERN_INFO "btipci: btipci_probe - Create device node %s %08X\n",pCard->devname,pCard->devnum);

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,27)
	pCard->pClassDevice = device_create(pClass,NULL,pCard->devnum,NULL,pCard->devname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,18)
	pCard->pClassDevice = device_create(pClass,NULL,pCard->devnum,pCard->devname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
	pCard->pClassDevice = class_device_create(pClass,pCard->devnum,NULL,pCard->devname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
	pCard->pClassDevice = class_simple_device_add(pClass,pCard->devnum,NULL,pCard->devname);
#endif

	cdev_init(&(pCard->cdev),&btipci_methods);
	pCard->cdev.owner = THIS_MODULE;
	err = cdev_add(&(pCard->cdev),pCard->devnum,1);

	if (err)
		printk(KERN_INFO "btipci: btipci_probe - error %i\n",err);

	//
	//	Create interrupt nodes
	//

	if (pCard->multi_int)
	{
		for (j=0;j<MAX_CORES && j<pCard->multi_int;++j)
		{
			if (pCard->multi_core)
			{
				sprintf(intname,"%s_int.%d",cardtypeptr->devbase,cardnum);
			}
			else
			{
				sprintf(intname,"%s_int%c.%d",cardtypeptr->devbase,'a'+j,cardnum);
			}

			intnum = MKDEV(MAJOR(pCard->devnum),BTIPCI_INT_MINOR+(MINOR(pCard->devnum)*MAX_CORES)+j);

			strcpy(pCard->pIntDevs[j]->devname,intname);
			pCard->pIntDevs[j]->devnum = intnum;

//			printk(KERN_INFO "btipci: btipci_probe - %s intnum=%08X %d.%d\n",intname,intnum,MAJOR(intnum),MINOR(intnum));

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,27)
			pCard->pClassDevice = device_create(pClass,NULL,intnum,NULL,intname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,18)
			pCard->pClassDevice = device_create(pClass,NULL,intnum,intname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
			pCard->pClassDevice = class_device_create(pClass,intnum,NULL,intname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
			pCard->pClassDevice = class_simple_device_add(pClass,intnum,NULL,intname);
#endif

			cdev_init(&(pCard->pIntDevs[j]->cdev),&btipci_methods);
			pCard->cdev.owner = THIS_MODULE;
			err = cdev_add(&(pCard->pIntDevs[j]->cdev),pCard->pIntDevs[j]->devnum,1);
		}
	}
	else
	{
		sprintf(intname,"%s_int.%d",cardtypeptr->devbase,cardnum);

		intnum = MKDEV(MAJOR(pCard->devnum),BTIPCI_INT_MINOR+(MINOR(pCard->devnum)*MAX_CORES));

		strcpy(pCard->pIntDevs[0]->devname,intname);
		pCard->pIntDevs[0]->devnum = intnum;

//		printk(KERN_INFO "btipci: btipci_probe - %s intnum=%08X %d.%d\n",intname,intnum,MAJOR(intnum),MINOR(intnum));

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,27)
		pCard->pClassDevice = device_create(pClass,NULL,intnum,NULL,intname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,18)
		pCard->pClassDevice = device_create(pClass,NULL,intnum,intname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
		pCard->pClassDevice = class_device_create(pClass,intnum,NULL,intname);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
		pCard->pClassDevice = class_simple_device_add(pClass,intnum,NULL,intname);
#endif

		cdev_init(&(pCard->pIntDevs[0]->cdev),&btipci_methods);
		pCard->cdev.owner = THIS_MODULE;
		err = cdev_add(&(pCard->pIntDevs[0]->cdev),pCard->pIntDevs[0]->devnum,1);
	}

	++pci_count;

	printk(KERN_INFO "btipci: btipci_probe - Found %s\n",cardtypeptr->cardname);

//	printk(KERN_INFO "btipci: btipci_probe - pci_count=%d\n",pci_count);

//	printk(KERN_INFO "btipci: btipci_probe - Exiting\n");

	return(0);
}

static void btipci_remove(struct pci_dev* pdev)
{
	int hit;
	int j;
	struct bti_pci_card *pCard;

//	printk(KERN_INFO "btipci: btipci_remove - Entering\n");

	for (hit=0,j=0;j<MAX_DEVICES;++j)
	{
		pCard = &(bti_pci_cards[j]);

//		printk(KERN_INFO "btipci: btipci_remove - %d inuse=%d\n",j,pCard->inuse);
//		printk(KERN_INFO "btipci: btipci_remove - %d pCard->pdev=%p\n",j,pCard->pdev);
//		printk(KERN_INFO "btipci: btipci_remove - %d pdev=%p\n",j,pdev);

		if (pCard->inuse && pdev==pCard->pdev)
		{
			hit=1;
			break;
		}
	}

	if (!hit)
	{
//		printk(KERN_INFO "btipci: btipci_remove - %p not found\n",pdev);
		return;
	}

	cdev_del(&(pCard->cdev));

	if (pCard->multi_int)
	{
		for (j=0;j<MAX_CORES && j<pCard->multi_int;++j)
		{
//			printk(KERN_INFO "btipci: btipci_remove - %s intdevnum=%08X %d.%d\n",pCard->pIntDevs[j]->devname,pCard->pIntDevs[j]->devnum,MAJOR(pCard->pIntDevs[j]->devnum),MINOR(pCard->pIntDevs[j]->devnum));

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,18)
			device_destroy(pClass,pCard->pIntDevs[j]->devnum);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
			class_simple_device_remove(pCard->pIntDevs[j]->devnum);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
			class_simple_device_remove(pCard->pIntDevs[j]->devnum);
#endif
		}
	}
	else
	{
//		printk(KERN_INFO "btipci: btipci_remove - %s intdevnum=%08X %d.%d\n",pCard->pIntDevs[j]->devname,pCard->pIntDevs[j]->devnum,MAJOR(pCard->pIntDevs[j]->devnum),MINOR(pCard->pIntDevs[j]->devnum));

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,18)
		device_destroy(pClass,pCard->pIntDevs[0]->devnum);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
		class_simple_device_remove(pCard->pIntDevs[0]->devnum);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
		class_simple_device_remove(pCard->pIntDevs[0]->devnum);
#endif
	}

//	printk(KERN_INFO "btipci: btipci_remove - Destroy %08X\n",pCard->devnum);

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,18)
	device_destroy(pClass,pCard->devnum);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
	class_simple_device_remove(pCard->devnum);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
	class_simple_device_remove(pCard->devnum);
#endif

	pci_clear_master(pdev);

	pci_disable_device(pdev);

	for (j=0;j<MAX_WINDOWS_MEM;++j)
	{
		if (pCard->virt[j])
		{
			iounmap((void*)pCard->virt[j]);
			pCard->virt[j] = 0;
		}
	}

	pCard->inuse = 0;

	--pci_count;

//	printk(KERN_INFO "btipci: btipci_remove - pci_count=%d",pci_count);

//	printk(KERN_INFO "btipci: btipci_remove - Exiting\n");
}

struct pci_driver btipci_driver =
{
	.name       = "btipci",
	.id_table   = btipci_table,
	.probe      = btipci_probe,
	.remove     = btipci_remove,
	.suspend    = NULL,
	.resume     = NULL
};

int btipci_init(void)
{
	int err;
	dev_t dev_num;

//	printk(KERN_INFO "btipci: btipci_init - Entering\n");

	//
	//	Register char device
	//

//	printk(KERN_INFO "btipci: btipci_init - Registering char device\n");

//	printk(KERN_INFO "btipci: btipci_init - Starting with MAJOR_NUM %d\n",MAJOR_NUM);

	if (MAJOR_NUM)
	{
//		printk(KERN_INFO "btipci: btipci_init - Registering predefined major number %d\n",MAJOR_NUM);

		dev_num=MAJOR_NUM;
		err = register_chrdev_region(dev_num,1,MODULE_NAME);
	}
	else
	{
//		printk(KERN_INFO "btipci: btipci_init - Dynamically allocating major number\n");

		err = alloc_chrdev_region(&dev_num,0,1,MODULE_NAME);
	}

	if (err)
	{
		printk(KERN_ERR "btipci: Unable to register char device\n");
		return(err);
	}

	MAJOR_NUM = dev_num;

	printk(KERN_INFO "btipci: btipci_init - Using major number %u\n",MAJOR(MAJOR_NUM));

	//
	//	Create the device class
	//

#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,4,0) || defined(CLASS_CREATE_WITHOUT_OWNER)
	pClass = class_create("btipci");
	if (!pClass) return(-ENODEV);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
	pClass = class_create(THIS_MODULE,"btipci");
	if (!pClass) return(-ENODEV);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
	pClass = class_simple_create(THIS_MODULE,"btipci");
	if (!pClass) return(-ENODEV);
#endif

	//
	//	Register driver
	//

//	printk(KERN_INFO "btipci: btipci_init - Registering driver\n");

	err = pci_register_driver(&btipci_driver);

	if (err)
	{
#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
		class_destroy(pClass);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
		class_simple_destroy(pClass);
#endif

		return(err);
	}

//	printk(KERN_INFO "btipci: btipci_init - Exiting\n");

	return(0);
}

void btipci_exit(void)
{
//	printk(KERN_INFO "btipci: btipci_exit - Entering\n");

	//
	//	Unregister driver
	//

//	printk(KERN_INFO "btipci: btipci_exit - Unregistering driver\n");

	pci_unregister_driver(&btipci_driver);

	//
	//	Destroy the device class
	//

//	printk(KERN_INFO "btipci: btipci_exit - Destroying class\n");

#if LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,13)
	class_destroy(pClass);
#elif LINUX_VERSION_CODE >= KERNEL_VERSION(2,6,0)
	class_simple_destroy(pClass);
#endif

	printk(KERN_INFO "btipci: btipci_exit - Unregistering major number %u, minor number %u\n",MAJOR(MAJOR_NUM),MINOR(MAJOR_NUM));

	unregister_chrdev_region(MAJOR_NUM,1);
}

module_init(btipci_init);
module_exit(btipci_exit);
