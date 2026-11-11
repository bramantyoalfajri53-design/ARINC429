# BTIDriver Python 
    Copyright © 2025 Astronics Advanced Electronic Systems Corp.

<!-- 
  This README is best read in a Markdown viewer 
  Hint: If using VSCode, right click the markdown (.md) file and select 'Open Preview' 
-->

 Welcome to the BTIDriver Python API Tutorial! This guide will teach you how to utilize the Ballard unified API library (BTIDriver) in Python with the Python BTIDriver Package. The Python API for BTIDriver offers a subset of the functions available in the BTIDriver C API, with those functions maintaining nearly identical functionality to their C counterparts. 

 This tutorial is not a replacement for the BTIDriver Programming manuals, but is designed to help you translate between the C and Python API's. It is assumed you have prior experience using the BTIDriver C API. For comprehensive details about the BTIDriver API, please refer to the Ballard BTIDriver Programming Manuals.

## Safety Warning
 Ballard products are not intended, warranted, or certified for any particular use or application or for use in any application where failure of the products could lead directly to death, personal injury, or damage to property. Customers, licensees, and/or users are responsible for establishing and assuring suitability and proper use of Ballard products for their particular use or application.

## Trademarks
 BTIDriver is a trademark of Astronics Advanced Electronic Systems Corp. Windows is a trademark of Microsoft Corporation. All other product names or trademarks are the property of their respective owners.

## License
 The software contained in the BTIDriver Python Package is licensed according to the terms and conditions contained in the LICENSE file found within. By installing or using this software, you agree to these terms and conditions.

## Contact Astronics
Please contact us with your questions, comments, and suggestions concerning this product.

 Astronics AES, 12950 Willows Road NE, Kirkland, WA 98034 USA 
 - Phone: +1.425.339.0281 
 - Email: Ballard.Support@astronics.com
 - Web: www.astronics.com/BallardSupport

----------------------------------------

# Table of Contents
<!-- Generated with markdown-toc -->

<!-- toc -->

- [Supported Protocols](#supported-protocols)
- [Requirements](#requirements)
- [Installation](#installation)
- [About the Python Examples](#about-the-python-examples)
- [Using the BTIDriver Python Module](#using-the-btidriver-python-module)
  * [Function Names](#function-names)
  * [Using The BTIDriver Functions](#using-the-btidriver-functions)
    + [Exceptions](#exceptions)
      - [*DriverError Exception*](#drivererror-exception)
    + [Output Parameters](#output-parameters)
    + [Arrays](#arrays)
    + [Buffers vs. Arrays](#buffers-vs-arrays)
    + [Structs](#structs)
  * [Special Behaviors](#special-behaviors)
    + [Card Handle Verification](#card-handle-verification)
    + [Struct Buffers](#struct-buffers)
    + [BTICard_SeqBufferStatus](#bticard_seqbufferstatus)
    + [SeqFindNext](#seqfindnext)

<!-- tocstop -->

----------------------------------------

# Supported Protocols
The BTIDriver Python API supports the following BTIDriver Protocols:
- MIL-STD-1553 Programming API  (BTI1553)
- ARINC 429 Programming API (BTI429)
- BTIDriver protocol-independent Ballard Device functions (BTICard)

----------------------------------------

# Requirements
**API Requirements**
- 64-bit Windows or Linux 
- Python 3 version 3.9 or above
- Python 3 Pip
- BTIDriver Library installed

> To run the examples on Windows, the *windows-curses* Python package is required

----------------------------------------

# Installation
> Before installing the package, consider creating a Python venv. Python suggests installing non-standard packages within a venv for best compatibility. 

To install the BTIDriver Python Package, do the following: 
- Download the BTIDriver Python .whl package to your PC
    - Windows: btidriver-x.x.x+x-py3-none-win_amd64.whl
    - Linux: btidriver-x.x.x+x-py3-none-linux_x86_64.whl
- Use pip to install the package
    `pip install /path/to/package/file`

----------------------------------------

# About the Python Examples

The Python examples included in this package have been directly adapted from the corresponding C examples provided with the BTIDriver C API. Each Python example closely replicates the logic of its C counterpart, enabling users familiar with the original C examples to readily understand and transition to the Python-based workflow.

**Example Code Structure:**
- **Argument Parsing:** Examples use standard Python argument parsing (`argparse`). All protocol examples offer a `--cardnum` argument to select which Ballard device to use. (uses `0` by default)
- **Console Output:** Some ARINC 429 and MIL-STD-1553 examples utilize the `curses` module for interactive console output.

**Running Examples**
- Launch an example using the Python runtime, providing arguments as needed. For example:
  ```bash
  python BTI1553/bc_xmit_once.py --cardnum 0
  ```

**Example Overviews**

| C Example # | Python Example File                  | Description |
|----------------------|-------------------------------------|-------------------------|
| **BTICard**  |
| Examp1       | `find_devices.py`            | Scans for all BTIDriver-compatible devices on the system, reports card info and found protocol channels. |
| **BTI1553**  |
| Examp1       | `bc_xmit_once.py`            | Transmit a single unscheduled BC message to a remote terminal and displays the response if the message completes successfully. |
| Examp2       | `bc_sched.py`                | Schedule three BC messages at defined frequencies (100Hz/50Hz/25Hz). Updates message data dynamically as 'hit' bits are set. |
| Examp3       | `rt_rcv.py`                  | Simulates a remote terminal (RT) for receiving BC-RT data. It continuously receives and displays the data words. |
| Examp4       | `bm_rcv.py`                  | Configures a Bus Monitor terminal and prints the time-tag, command words, and status words for each monitor record. |
| **BTI429**   |
| Examp1       | `label_rcv.py`               | Receives 2 GPS messages into separate Message Records, and receives all other messages into a default Message Record. |
| Examp2       | `xmit_sched.py`              | Builds a transmit schedule for multiple messages using interval info. Transmits with changing data each cycle. |
| Examp3       | `xmit_rcv.py`                | Builds/transmits scheduled messages, sets up receive filters, and monitors bus activity using sequential buffer.|
| Examp4       | `xmit_rcv_explicit.py`       | Builds transmit schedule with explicit timing, enables self-test wraparound, receives filtered messages and displays min/max elapsed time per label. |
| Examp5       | `xmit_rcv_listbuf.py`        | Configures transmit and receive list buffers, transmits ramping airspeed data continuously, and displays received data.
| Examp8       | `rcv_eventlog.py`            | Enables ARINC 429 Event Log. Polls for new event log list entries and reads message data associated with logged events for multiple filters. |
| Examp10      | `xmit_rcv_mon_all.py`        | Configures all ARINC 429 cores to simultaneously transmit, receive, and monitor. Uses sequential monitor to report activity across all channels and cores. |
| Examp12      | `xmit_rcv_irig.py`           | Enables IRIG timer, synchronizes IRIG to local system time, builds schedules with explicit timing, displays IRIG-based timestamps and elapsed times. |

These examples are ideal starting points for understanding typical BTIDriver workflows and best practices in Python. Compared to C, you will find the function calls and configuration sequences similar. Aside from the obvious language differences, the primary change you will notice is the structured error handling using Python exceptions, but if you compare the Python examples to their C counterparts, you should have a good understanding of how to use the BTIDriver Python API.   

----------------------------------------

# Using the BTIDriver Python Module
Similar to a C header file, a Python module is a file containing Python code, such as functions, classes, or variables, that can be imported and used in other Python programs. The BTIDriver module is a special case: it’s a Python module generated from a C API using SWIG (Simplified Wrapper and Interface Generator), allowing you to call C functions and access C data structures directly from Python. While every effort has been made to maintain a pythonic API, some functions may exhibit C-like behavior.

> SWIG website: https://www.swig.org/

The BTIDriver module contains submodules directly corelating to the BTIDriver C API Headers. These submodules contain the functions, classes, and variables defined for that API protocol, which correspond to the functionality from the original C header files.

> Note: All module and submodule names are lowercase (Example: BTI1553 becomes `bti1553`)

To import the submodules for use in Python, use the from/import commands:
``` py3
from btidriver import bticard, bti1553, bti429
```
## Function Names
---
All functions in the BTIDriver Python API have the same names as their C counterparts, but have removed the protocol prefix. For example, `BTICard_CardOpen` is is renamed to just `CardOpen`. To Call the function in Python you can do 1 of the following:
- Import it using a from/import statement: `from bticard import CardOpen'
- Call it directly from the bticard submodule: `bticard.CardOpen` 

## Using The BTIDriver Functions
Beneath the surface, the BTIDriver Python API calls the BTIDriver C API functions. For the most part, functions are unchanged and can be called exactly as you would the C function. All the type conversions are handled by the API Wrapper runtime.

Example:
```py3
oldvalue = 0xA154BF  
startbit = 8  
endbit = 15  
    
result = bticard.ValGetBits(oldvalue, startbit, endbit)
print(f"Result: {result:04X}") # Outputs "Result: 0054"
```

While this will work as expected for most functions, many functions (especially ones that use pointers) will be handled slightly differently from the way they work in C. The rest of this section will cover how to handle these situations. 

### Exceptions
---
Many functions in the BTIDriver API make use of integer error values (ERRVAL) to report if an error occurred in the Driver. Python, has an exception handler, and BTIDriver Python API can throw exceptions. **All functions that return ERRVAL in C will now throw an exception in Python and the ERRVAL is removed from the returned object.** This typically results in the function returning `None`, but this is not always true, as you will see in future sections (See [Output Parameters](#output-parameters)). 

> Note: functions returning `0` as an error in C will now throw a `btidriver.DriverError` exception with code `ERR_UNKNOWN (-1)`. Typically this applies to any function returning an Address type (Like MSGADDR).

> Note: Functions returning SCHNDX that report an error will also throw an exception if they return an error value. 

#### **`DriverError` Exception**

To support Python, the `btidriver.DriverError` exception class was created, and can be used to check if the driver threw an exception. Simply wrap your BTIDriver function in a try block and except on the `btidriver.DriverError` class. 

> Note: unhandled exceptions will block program execution and output the error. 

The `DriverError` `code` field contains the BTIDriver error code that caused the exception. Additionally, when an exception is called, the exception string is populated with the BTIDriver Error String, so calling `str(error)` is equivalent to calling `BTICard_ErrDesc(errval, hcard)`. 


Example: using `DriverError` in a `try`/`except`: 
```py3
from btidriver import bticard, DriverError

# Program Setup...

try:
    bticard.CardStart(hCard)
except DriverError as error:
    if error.code != bticard.ERR_NOCARD:
      bticard.CardClose(hCard)
    print(f"Driver Error: {error.code} - {str(error)}")
    exit(1)
except Exception as e:
    print(f"A different type of exception occurred: {e}")
    exit(1)
else:
    print("No exception occurred.")

# Continue Progam...
```

> Note: Only errors specifically returned by BTIDriver will be of type `DriverError`. If an error is detected by the Python runtime (Example: `TypeError`), it will not be caught if excepting on the `DriverError` class. 

### Output Parameters
---
BTIDriver API functions often have more than one output. In C this is handled by passing in a pointer that acts as an Output Parameter. However, this is not an issue in Python, as it can handle multiple output values using Python tuples. As such, all functions with an output parameter in C will now return a tuple instead. 

The structure of the returned value is as follows:

`[ReturnValue, OutputParam1, OutputParam2, ..., OutputParamN]` where N is the total number of output parameters the function takes. `ReturnValue` will not exist if the function has no return type (i.e. VOID).

**Example: A Return Value and Single Output Parameter**
An example of `MsgBlockRd` where `addr` is the `ReturnValue` and `msg` is `OutputParam1`

```py3
# Use a ',' to directly iterate the output into variables
addr, msg = bti1553.MsgBlockRd(msgaddr, handleval)
```

> Note: Assigning a single variable to a functions that outputs multiple values will give you a tuple that can be accessed like a list 

```py3
# Use a single variable to get the full tuple
output = bti1553.MsgBlockRd(msgaddr, handleval)
addr = output[0]
msg = output[1] 
```

> Note: Returned tuple elements can be suppressed using an `_`

```py3
# Suppress the first element of the tuple
_, msg = bti1553.MsgBlockRd(msgaddr, handleval)
```

**Example: Output Parameter with ERRVAL**
```py3
cardnum = 0

# Notice only 1 return value, since ERRVAL is not returned in Python
hcard = bticard.CardOpen(cardnum) 
hcore = bticard.CoreOpen(0, hcard)
```

**Example: Multiple Output Parameters**
```py3
# The output parameters are in the order they appear in the C function signature
addr, typeval, infoval, channel = bticard.EventLogRd(handleval)
```

### Arrays
**Input Arrays**
Functions that take an array as input will typically just take a Python list. If the C API function also took a count, it will now just use the lists length, so no need to pass in a count variable. This makes functions like this easier to use. 

> Note: Where possible, the Python API will verify that your lists are valid. Passing in a bad datatype will typically result in a Python `ValueError` exception. 

> Functions that have 1 count value but receive 2 arrays will verify the lists are the same length before calling the API.  

**Example: Input array**
```py3
# Using "garbage" input to show how assigning the array would work
data = [1,2,3,4,5,6]

# Notice no count parameter provided
result = bti1553.BCCreateMsg(configval, cwd1, cwd2, data, handleval)
```

**Output Arrays**
Functions that output an array will return the list within a tuple, similar to other output parameters. If the function took a count value, you now pass the count into the function and it will only read that many values into the list. 

> Note: The count value must be passed in where the array pointer was in the parameters of the function. This means the order of parameters in the functions may be slightly different than expected. Additionally, functions with an input array and an output array will use the count of the input array. 

**Example: Output Array**
```py3
# Read 16 items into buf
count = 16

result, buf = bti1553.ListDataRd(count, listaddr, handleval)
```

```py3
# Returns a list of 3 MSGFIELDS1553 into msginfo since msgaddrs has 3 elements
msgaddrs = [1, 2, 3]

msginfo = bti1553.MsgGroupRd(msgaddrs, handleval)
```

### Buffers vs. Arrays
---
Some BTIDriver functions output arrays that are not intended for users to have to interact directly. In such cases, the array is kept as an opaque buffer rather than converted to a Python list for performance reasons. A set of buffer classes are used for these situations: `int_buffer`, `uint16_buffer`, and `uint32_buffer`. 

> Note: While you can Read and Write from the buffers, the ability to manipulate them is greatly reduced in comparison to a Python list.

Under the hood, these buffers are just handles to a C arrays that are managed by the Python runtime. As a result, functions accepting a buffer instead of a Python list will act much more similar to the C counterparts, at the expense of not being as flexible or compact as a Python list.

Example: `SeqFindNext1553`

```py3
# Open the Card and Core 

# Create a UINT16 buffer of size 2048
seqbuf = bticard.uint16_buffer(2048) 

# Read from the Sequential Monitor into seqbuf
seqcount, _ = bticard.SeqBlkRd(seqbuf, 2048, hCore) # `_` is used to ignore a return value

# Create the sfinfo from seqbuf
sfinfo = bticard.SeqFindInit(seqbuf, seqcount)

while True:
    pRec1553 = bticard.SeqFindNext1553(sfinfo)

    if pRec1553: 
      # If the record exists, do something with it 
    else: 
      # If the record does not exist, we have read all records from the buffer
      break

```

The following functions use buffers instead of Python lists: 
- `SeqFindInit`
- `PlayBlockWr`
- `PlayPutData`
- `PlayPutGap`
- `PlayPutLog`
- `PlayPutPulse0`
- `PlayPutPulse1`

### Structs
---
Structs from the BTIDriver C API are now Python classes and can be found in the module that correlates to their original header file. 

**Example: Declaring a struct variable**
```py3
msg = bti1553.MSGFIELDS1553()

msg.datacount = 10
print(msg.datacount)
```

> Note: Structs in the BTIDriver Python API are often created or modified by API functions and are not expected to be directly modified by the user. The example above is just for explaining the struct behavior. 

**Struct Arrays**

--- 
> **WARNING** Arrays within structs cannot be modified in place. Attempting to modify the array in place will not modify the underlying Array despite no error being shown. To modify such arrays, you must use an assignment operation. 

```py3
msg = bticard.MSGFIELDS1553()
data = [10, 23, 45, 16]

# This Works
msg.data = data

# This does *NOT* work and will not throw an exception
msg.data[0] = 67 # DO NOT DO THIS

print(msg.data) # Output: [10, 23, 45, 16]

# To modify, copy the list out, change it, and copy back in
newdata = msg.data
newdata[0] = 67
msg.data = newdata

print(msg.data) # Output: [67, 23, 45, 16]

```

## Special Behaviors

The following is a list of special behaviors in Python that are related to specific functions. Please keep these differences in mind when creating Python applications. 

---
### Card Handle Verification
Affected Functions:
`bticard.CardOpen`, `bticard.CardOpenStr`, `bticard.CoreOpen`, `bticard.CardClose`

Python verifies card/core handles before passing them to any functions. If a handle is used that was not previously opened by the active Python runtime, it will pass a NULL handle to the function which will typically result in an exception being generated.

Additionally, if you attempt to use a handle after calling bticard.CardClose on the handle, it is considered invalid and should not be used. 

---
### Struct Buffers
Many functions in the C API use a `USHORT` (`UINT16`) buffer for input/output, however, for some of these functions, the buffer is actually a representation of a struct (or an array of structs). In such cases, Python converts the `USHORT` buffer into a buffer of that struct. 

> Note: Some structs have internal arrays that are of variable size when stored in a BTIDriver buffer to maximize storage capacity. In such cases, BTIDriver Python will attempt to manage the internal list with an accurate `datacount` field.

Affected Functions: `bti1553.ListBlock(Rd/Wr)`, `bti1553.ListMultiBlock(Rd/Wr)`, `bti1553.PlayWr`

---
### BTICard_SeqBufferStatus
Only available on Windows

---
### SeqFindNext
SeqFindNext and SeqFindMore functions return a **copy** of a single record. If no more records are available (i.e. the end of the buffer was reached), it simply returns `None`.

Affected Functions: `bticard.SeqFindNext1553`, `bticard.SeqFindMore1553`, `bticard.SeqFindNext429`, `bticard.SeqFindNext`
