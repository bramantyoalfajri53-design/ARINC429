# Aeroflex JcAIR T1200 Operation Manual

**Source:** `Aeroflex_JcAIR_T1200_Manual_2021421122744.pdf`
**Pages:** 30–60 (Manual pages 1-4-3 through 1-4-33)
**Document:** T1200B Rev. 0 – February 8, 2007

---

## Chapter One — General Information and Operating Instructions

### Section 4. Operating Instructions

#### A. General Operation Description (cont.)

**Figure 5A — POWER UP & SELF-TEST SCREEN**

```
JcAIR TEST EQUIPMENT
SELF TEST COMPLETE
MODEL T1200 SOFTWARE VERSION x.xx
STANDARD MODE | CFDS MODE | CMC MODE
```

##### DFIU Security Feature

The T1200B incorporates a security feature to verify the correct DFIU is connected for the menu selected. Figure 4 shows the menus that may require a DFIU with a security device.

The security is only active for specific menu selections in the LRU AVIONICS, CFDS and CMC menus. The presence of a DFIU is not checked when the USER CONFIGURE menu has been selected. When a LRU is selected that requires a security feature, the CPU Board requests that the SBC checks the DFIU type. The SBC attempts to find the DFIU. If a DFIU is connected, the type is checked and reported back to the CPU. If the DFIU is not connected or an incorrect DFIU is connected, an error message is displayed and the user is not allowed to continue.

A warning screen similar to Figure 5B is displayed if a menu is selected that requires a different DFIU than the one attached.

**Figure 5B — SECURITY WARNING SCREEN**

```
WARNING: THE T1207 DOES NOT SUPPORT THE 716 VHF
         PLEASE CORRECT THE HARDWARE SETUP
         OR SELECT A DIFFERENT LRU.
```

An error screen similar to Figure 5C is displayed if a hardware error is detected. Error code 52 is the most common error indicating that no DFIU is attached or the security token is missing.

**Figure 5C — SECURITY ERROR SCREEN**

```
ERROR: THE T1200B SECURITY FEATURE HAS RETURNED
       ERROR CODE: XX
       REFER TO MANUAL FOR ERROR CODE DESCRIPTION.
PRESS THE PREV PAGE KEY TO RETURN TO THE LRU MENU.
```

One of the following error codes should be displayed if there is a failure detected in the security hardware:

| Code | Description |
|------|-------------|
| 50 | Could not open com port |
| 51 | Could not find security coprocessor |
| 52 | Could not find DFIU security token |
| 53 | Could not validate DFIU security token |
| 54 | Single Board Computer did not respond to the security check in the allotted time |

#### B. Standard Mode

This selection is made to gain access to the Standard Mode Select Menu Screen shown in Figure 6. The two selections on this screen are: USER CONFIGURE MENU and the AVIONICS LRU MENU. Pressing the PRIOR PAGE key on the keypad will return you to the Power Up & Self Test Screen shown in Figure 5.

##### USER CONFIGURE MENU

This selection is made to gain access to the Configure Channels Screen shown in Figure 7. The Configure Channels Screen allows the operator to configure the transmit and receive channels. Additionally, each transmitted ARINC 429 word may be individually configured for label, data, SDI, PAD, SSM, parity, and transmit rate. The receiver channels may be programmed to trap words and view their data.

Pressing the PRIOR PAGE key on the keypad twice will return you to the Standard Mode Select Menu Screen shown in Figure 6.

**Figure 6 — STANDARD MODE SELECT MENU SCREEN**

```
SELECT MENU:
  USER CONFIGURE MENU
  AVIONICS LRU MENU
```

**Figure 7 — CONFIGURE CHANNELS SCREEN**

```
CONFIGURE CHANNELS:
  TX-A  RX-A  TX-B  RX-B  TX-C  RX-C  TX-D  RX-D
  BIT RATE: 12.5 KBPS / 100 KBPS
  XMTR SELECT / RCVR SELECT
  TRANSMITTER ENABLE: A B C D (ON/OFF)
  DISPLAY MODE: ENG | BIN | HEX
```

There are several touch areas on the screen which allow the operator to configure the channels. The following is a description of these areas:

**BIT RATE** — The bit rate for each transmitter is displayed above each transmitter select area. When the number is pressed, the rate scrolls through a list of low speed transmitter rates: 20.0, 18.5, 17.2, 15.1, 13.9, 12.5, 11.1, 9.4, and 8.1 KBPS, or high speed transmitter rates: 125, 100, and 83 KBPS.

**XMTR SELECT** — These touch areas will display one of the three Transmitter Screens as seen in Figures 8 through 10. The transmitter select areas are highlighted if any non-zero labels have been programmed.

**RCVR SELECT** — These touch areas will display one of the three Receiver Screens as seen in Figures 11 through 13. Like the transmitter select areas, the receiver select areas will be highlighted if the channel has been configured.

**TRANSMITTER ENABLE** — Pressing the area below the transmitter designator A, B, C, or D will toggle the transmitter channel off and on. The current state of the channel is shown in highlighted inverse video.

**DISPLAY MODE** — Pressing one of the DISPLAY MODE areas will select the manner in which the ARINC 429 data will be displayed in the Transmitter, Receiver, and Display screens. The currently selected mode is shown in highlighted inverse video. The ENG selection displays the data in engineering format, while the BIN displays the data in binary format, and HEX displays it in hexadecimal format.

**DISPLAY** — This touch area will display a Transmitter screen. However, line 1 contains the last configured transmitter channel and line 2 contains the last configured receiver channel. If no channels have been configured, then transmitter channel A and receiver channel A are displayed.

##### TRANSMITTER SCREEN

Figures 8 through 11 show the three different data display formats used in the Transmitter Screen. Any of the fields within any of the transmitted words can be changed by the operator without interrupting transmission.

A word can be added to the transmitter by pressing an OFF in the label list located in the center of the screen. The current label line, located at the top of the screen, will erase and the label field is highlighted. The label may be entered using the keyboard and pressing the ENTER key when finished. The remaining fields in the current label line are filled in with default data and are ready for additional editing.

Any word in the label list may be edited by simply pressing it. The label will then occupy the current label line. The label, SDI, data, PAD, SSM, parity, and transmit rate may all be changed using the touch screen and keyboard. A word may be deleted from the transmit label list by editing the label and entering the label 000.

**Figure 8 — TRANSMITTER (BIN) SCREEN**
**Figure 9 — TRANSMITTER (HEX) SCREEN**
**Figure 10 — TRANSMITTER (ENG) SCREEN**

**DATA FIELD** — The data field can be edited in two ways. First by pressing the data field and entering the data via the keyboard and pressing the ENTER key. The second way is to press the DISP CURSOR field. This displays an arrow below the data field (see Figure 10). The digit to be altered is selected by repeatedly pressing the DISP CURSOR field until the arrow is directly below it. The direction in which to alter the digit can be selected by pressing the INC./DECR field. Then, by pressing the DATA STEP field, the digit is incremented or decremented, as selected by the INC./DECR field. The data will continuously increment/decrement if the operator presses and holds the DATA STEP field. This feature is handy when using the ENG display mode to change the data.

**SDI FIELD** — The SDI field can be edited in two ways. First by pressing the SDI field and entering the SDI via the keyboard and pressing the ENTER key. The second way is to press the DISP CURSOR field, then press the SDI field. This displays an arrow below the SDI field. The digit to be altered is selected by repeatedly pressing the DISP CURSOR field until the arrow is directly below it. The direction of which to alter the digit can be selected by pressing the INC./DECR field. Then, by pressing the DATA STEP field, the digit is incremented or decremented as selected by the INC./DECR field. The data will continuously increment/decrement if the operator presses and holds the DATA STEP field.

**PAD FIELD** — Same editing method as SDI field.

**SSM FIELD** — Same editing method as SDI field.

**PAR FIELD** — When pressed, toggles the transmitted word from even to odd or from odd to even parity.

**RATE FIELD** — Can be edited by pressing the RATE field and entering the RATE via the keyboard and pressing the ENTER key.

**TX/RX FIELD** — Allows the operator to select whether the line 1 (LN 1) or line 2 (LN 2) fields will select transmit or receive channels the next time they are edited. The highlighted area indicates the current selection. Pressing the area will toggle the current selection.

**LN 1 FIELD** — Allows the operator to select what will be displayed on line 1. A transmitter or receiver and channel may be selected. This field changes depending on the TX/RX field.

**LN 2 FIELD** — Allows the operator to select what will be displayed on line 2. A transmitter or receiver and channel may be selected. This field changes depending on the TX/RX field.

**MORE WORDS FIELD** — Used to scroll through a list of labels received. A receiver must be active on the screen and have more than 10 labels being received before pressing this area. Each time this area is pressed, a label shown on the screen is replaced by a label not shown on the screen. If more than 10 labels are being received, a message displayed on the right side of the screen will indicate the number of labels being received.

##### RECEIVER SCREEN

Figures 11 through 13 show the three different data display formats in the Receiver screen. Once one of these screens is displayed, any label listed in the received labels list may be examined. This is accomplished by pressing on the screen just below the "ENTER LABEL/SDI TO SET TRAP" message on the right side of the screen. Enter the label and press the ENTER key. Next, enter a specific SDI. If the SDI doesn't matter, then simply press the ENTER key. The label is added to the label list with a preceding asterisk which denotes the trap status. The T1200B waits until the receiver channel receives the selected word. Until it is received, the "XXX WAITING FOR TRIGGER" message is displayed (XXX is the octal label). When the word is received, the real time data received is displayed. To remove the trap from a label, press the screen just below the "ENTER LABEL TO CLEAR TRAP" message on the right side of the screen. Enter the label and press the ENTER key. The label is removed from the trap mode.

**Figure 11 — RECEIVER (BIN) SCREEN**
**Figure 12 — RECEIVER (HEX) SCREEN**
**Figure 13 — RECEIVER (ENG) SCREEN**

##### LRU SELECTION SCREEN

Pressing the AVIONICS LRU MENU area of the Standard Mode Select Menu Screen will display the LRU Selection Screen as shown in Figure 14.

**Figure 14 — LRU SELECTION SCREEN**

Available LRU selections:

| Code | LRU Type |
|------|----------|
| 712 | ADF |
| 711 | VOR |
| 710 | ILS |
| 709 | DME |
| 718 | ATC |
| 707 | LRA |
| 716 | VHF |
| 719 | HF |
| 753 | HFDU |
| 750 | VDR |
| 753 | HFDR |
| 719 | HF RMP |
| 719 | HF ACARS |
| 753 | HFDU RMP |
| 753 | HFDR RMP |
| 716 | 8.33 |
| 755 | MMR |
| — | VHF ALIGN |
| — | VDL MODE |
| 579 | VOR |
| — | TIME CONSTANT |

The purpose of this screen is to allow the operator to select the type of LRU being tested. When any one of the LRU selections is pressed, the T1200B advances to another selection menu or displays a Standard LRU Format Screen with the appropriate default words being transmitted and the receivers programmed to look for specific words from the LRU.

##### Standard LRU Format Screen

Figure 15 shows an example of the Standard LRU Format Screen. This screen allows the operator to quickly identify and view transmitted and received words when testing the selected LRU.

Abbreviations of the ARINC 429 words being transmitted and received are displayed in the upper portion of the screen. Any received or transmitted words may be selected, to view its data, by pressing its abbreviation. The abbreviation of each word being actively received are highlighted. If a word has not been received within 2.5 s, it is displayed using normal intensity and the receive rate is 0.

**Figure 15 — STANDARD LRU FORMAT SCREEN**

Any transmitter words in the label list may be edited by simply pressing its abbreviation at the top of the screen. The word will then occupy the transmitter line. The label, data, SDI, PAD, SSM, parity, and rate may all be changed using the touch screen and keyboard. A word may be deleted from the transmit label list by editing the label and entering the label 000. When a label is turned off, the abbreviation for that label displays OFF.

**SLOT FIELD** — Used to scroll through 10 transmitter slots numbered 0–9. Each slot contains one transmit word which can be modified. If SLOTS 0, 1, or 2 contains a non-zero label, an abbreviation for that label will be displayed at the top under the TRANSMITTED WORDS heading. The SLOT field is not available on 719 HF, 753 HFDU, and 753 HFDR screens.

**TX-A/TX-B FIELD** — Allows the operator to select which transmitter channel is used to transmit the words.

**RX-A/RX-B FIELD** — Allows the operator to select which receiver channel is used to receive words.

**MORE WORDS FIELD** — Used to scroll through the list of labels received. The receiver must have more than 6 labels being received before pressing this area.

**BIT RATE FIELD** — Used to set the bit rate of the transmitter. When pressed, the rate increments or decrements through: 8.1, 9.4, 11.1, 12.5, 13.9, 15.1, 17.2, 18.5, and 20.0 KBPS.

**TIME CONSTANT FIELD** — Used to setup a first order low pass software filter. The T1200B will filter received data when testing VOR, ILS, and ADF LRUs. Pressing the TIME CONSTANT area will select the time constants of: OFF (0), 0.4, 0.8, 1.6, 3.2, 6.4, and 12.8 s.

The higher the time constant, the lower the rate of change of the data displayed. The data displayed is an average of the data from the labels that were received in the selected time period. As new data is received, the old data is purged, creating a running average. When the filter is inactive (off), whatever data that is currently in the receiver buffer is displayed without averaging. The display is updated up to four times a second.

Filtered labels:

| LRU Type | Label |
|----------|-------|
| VOR | 222 |
| ADF | 162 |
| ILS | 173, 174 |

##### ARINC 712 ADF

When selected from the LRU Selection Screen, the Standard LRU Format Screen is displayed with the following default transmitted words:

- **Function:** ADF Frequency | **Label:** 032 | **Data:** 577.0 kHz
  - SDI: 00 | PAD: 000 | SSM: NML | PAR: ODD | Rate: 150 ms

The word may be edited as described in Chapter 1-3, Section 3, Paragraph B. The first two words recognized by receiver channel A will be displayed both in the label list and listed next to the RX-A area. Any more labels received will be added to the labels list.

##### ARINC 711 VOR

When selected from the LRU Selection Screen, the Standard LRU Format Screen is displayed with the following default transmitted words:

- **Function:** VOR Frequency | **Label:** 034 | **Data:** 108.00 MHz
  - SDI: 00 | PAD: 0000 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** Sel Coarse #1 BCD | **Label:** 024 | **Data:** 0E
  - SDI: 00 | PAD: 00000000 | SSM: PLS | PAR: ODD | Rate: 200 ms
- **Function:** Sel Coarse #2 BCD | **Label:** 027 | **Data:** 0E
  - SDI: 00 | PAD: 00000000 | SSM: PLS | PAR: ODD | Rate: 200 ms
- **Function:** Sel Coarse #1 BNR | **Label:** 100 | **Data:** 0.00E
  - SDI: 00 | PAD: 00000000 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** Sel Coarse #2 BNR | **Label:** 110 | **Data:** 0.00E
  - SDI: 00 | PAD: 00000000 | SSM: NML | PAR: ODD | Rate: 200 ms

The word may be edited as described in Chapter 1-3, Section 3, Paragraph B. The first two words recognized by receiver channel A will be displayed both in the label list and listed next to the RX-A area. Any more labels received will be added to the labels list.

##### ARINC 710 ILS

When selected from the LRU Selection Screen, the Standard LRU Format Screen is displayed with the following default transmitted words:

- **Function:** ILS Frequency | **Label:** 033 | **Data:** 110.30 MHz
  - SDI: 00 | PAD: 0000 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** Runway Heading BCD | **Label:** 017 | **Data:** 0.0E
  - SDI: 00 | PAD: 0000 | SSM: PLS | PAR: ODD | Rate: 200 ms
- **Function:** ISO ALPHA #5 | **Label:** 357 | **Data:** KQE
  - SDI: — | PAD: — | SSM: INT | PAR: ODD | Rate: 100 ms
- **Function:** Runway Heading BNR | **Label:** 105 | **Data:** 0.00E
  - SDI: 00 | PAD: 00000000 | SSM: NML | PAR: ODD | Rate: 200 ms

The word may be edited as described in Chapter 1-3, Section 3, Paragraph B. The first two words recognized by receiver channel A will be displayed both in the label list and listed next to the RX-A area. Any more labels received will be added to the labels list.

##### ARINC 718 ATC

When selected from the LRU Selection Screen, the Standard LRU Format Screen is displayed with the following default transmitted words:

- **Function:** ATC Reply | **Label:** 031 | **Data:** 1234 SQWK
  - SDI: 00 | PAD: 0000001 | SSM: NML | PAR: ODD | Rate: 150 ms
- **Function:** Pressure Altitude | **Label:** 203 | **Data:** 0 FT
  - SDI: 00 | PAD: 0 | SSM: NML | PAR: ODD | Rate: 50 ms

The word may be edited as described in Chapter 1-3, Section 3, Paragraph B. The first two words recognized by receiver channel A will be displayed both in the label list and listed next to the RX-A area. Any more labels received will be added to the labels list.

##### ARINC 707 LRA

When selected from the LRU Selection Screen, the Standard LRU Format Screen is displayed with the following default transmitted words:

- **Function:** Radio Altitude BCD | **Label:** 165 | **Data:** 1000.0 FT
  - SDI: 00 | PAD: — | SSM: PLS | PAR: ODD | Rate: 100 ms
- **Function:** Radio Altitude BNR | **Label:** 164 | **Data:** 125.0000 FT
  - SDI: 00 | PAD: 00 | SSM: NML | PAR: ODD | Rate: 37 ms

The word may be edited as described in Chapter 1-3, Section 3, Paragraph B. The first two words recognized by receiver channel A will be displayed both in the label list and listed next to the RX-A area. Any more labels received will be added to the labels list.

##### ARINC 716 8.33

When selected from the LRU Selection Screen, the Standard LRU Format Screen is displayed with the following default transmitted words:

- **Function:** VHF COMM 8.33 KHz Frequency | **Label:** 047 | **Data:** 117.992 MHz
  - SDI: 00 | PAD: — | SSM: NML | PAR: ODD | Rate: 150 ms

The word may be edited as described in Chapter 1-3, Section 3, Paragraph B. The first two words recognized by receiver channel A will be displayed both in the label list and listed next to the RX-A area. Any more labels received will be added to the labels list.

##### ARINC 716 VHF

When selected from the LRU Selection Screen, the Standard LRU Format Screen is displayed with the following default transmitted words:

- **Function:** VHF COMM Frequency | **Label:** 030 | **Data:** 118.000 MHz
  - SDI: 00 | PAD: — | SSM: NML | PAR: ODD | Rate: 150 ms

The word may be edited as described in Chapter 1-3, Section 3, Paragraph B. The first two words recognized by receiver channel A will be displayed both in the label list and listed next to the RX-A area. Any more labels received will be added to the labels list.

##### ARINC 750 VDR

When selected from the LRU Selection Screen, the Standard LRU Format Screen is displayed with the following default transmitted words:

- **Function:** VDR SAL | **Label:** 172 | **Data:** 000000 HEX
  - SDI: 00 | PAD: — | SSM: 00 | PAR: ODD | Rate: 100 ms
- **Function:** DSCR DAT1 | **Label:** 270 | **Data:** 000000 HEX
  - SDI: 00 | PAD: — | SSM: 00 | PAR: ODD | Rate: 100 ms

The word may be edited as described in Chapter 1-3, Section 3, Paragraph B. The first two words recognized by receiver channel A will be displayed both in the label list and listed next to the RX-A area. Any more labels received will be added to the labels list.

##### ARINC 719 HF

Default transmitted word:

- **Function:** HF COMM Frequency | **Label:** 037 | **Data:** 10.0000 MHz
  - SB: LSB | MOD: AM | CW: OFF | SSM: NML | PAR: ODD | Rate: 200 ms

This word actually consists of two separate words using the same label. There are no SDI bits, but bit 9 indicates whether the word is the #1 or #2 word. These words are transmitted with a 75 ms spacing between them. In addition, bit 10 is dedicated to a separate discrete function which is toggled separately.

- The **SB** field refers to bit 11 of word #1
- The **MOD** field refers to bit 10 of word #1
- The **CW** field refers to bit 10 of word #2

Due to the uniqueness of this screen, no label other than 037 can be transmitted. Therefore, the touch screen for the label field is inactive.

##### ARINC 753 HFDU

Default transmitted word:

- **Function:** HF COMM Frequency | **Label:** 037 | **Data:** 10.0000 MHz
  - SB: LSB | MOD: AM | CW: OFF | SSM: NML | PAR: ODD | Rate: 200 ms

This word actually consists of two separate words using the same label. There are no SDI bits, but bit 9 indicates whether the word is the #1 or #2 word. These words are transmitted with a 75 ms spacing between them. In addition, bit 10 is dedicated to a separate discrete function which is toggled separately.

- The **SB** field refers to bit 11 of word #1
- The **MOD** field refers to bit 10 of word #1
- The **CW** field refers to bit 10 of word #2

Due to the uniqueness of this screen, no label other than 037 can be transmitted. Therefore, the touch screen for the label field is inactive.

##### ARINC 753 HFDR

Default transmitted word:

- **Function:** HF COMM Frequency | **Label:** 037 | **Data:** 10.0000 MHz
  - SB: LSB | MOD: AM | CW: OFF | SSM: NML | PAR: ODD | Rate: 200 ms

This word actually consists of two separate words using the same label. There are no SDI bits, but bit 9 indicates whether the word is the #1 or #2 word. These words are transmitted with a 75 ms spacing between them. In addition, bit 10 is dedicated to a separate discrete function which is toggled separately.

- The **SB** field refers to bit 11 of word #1
- The **MOD** field refers to bit 10 of word #1
- The **CW** field refers to bit 10 of word #2

Due to the uniqueness of this screen, no label other than 037 can be transmitted. Therefore, the touch screen for the label field is inactive.

##### ARINC 719 HF ACARS

Default transmitted words:

- **Function:** HF-A COMM Frequency | **Label:** 206 | **Data:** 10.0000 MHz
  - SDI: 00 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** HF-A COMM Frequency | **Label:** 206 | **Data:** 0.0000 MHz
  - SDI: 00 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** HF MODE | **Label:** 207 | **Data:** 000000 HEX
  - SDI: 00 | SSM: 00 | PAR: ODD | Rate: 200 ms

The second label 206 is used to send the .1 kHz part of the tuning frequency. Bit 11 of the label 206 word indicates whether the word is the #1 or #2 word.

> **WARNING:** THE #2 FREQUENCY WORD SHOULD NOT BE EDITED.

##### ARINC 719 HF RMP

Default transmitted words:

- **Function:** HF-A COMM Frequency | **Label:** 205 | **Data:** 10.0000 MHz
  - SDI: 00 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** HF-A COMM Frequency | **Label:** 205 | **Data:** 0.0000 MHz
  - SDI: 00 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** HF MODE | **Label:** 207 | **Data:** 000000 HEX
  - SDI: 00 | SSM: 00 | PAR: ODD | Rate: 200 ms

The second label 205 is used to send the .1 kHz part of the tuning frequency. Bit 11 of the label 205 word indicates whether the word is the #1 or #2 word.

> **WARNING:** THE #2 FREQUENCY WORD SHOULD NOT BE EDITED.

##### ARINC 719 HFDU RMP

Default transmitted words:

- **Function:** HF-A COMM Frequency | **Label:** 205 | **Data:** 10.0000 MHz
  - SDI: 00 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** HF-A COMM Frequency | **Label:** 205 | **Data:** 0.0000 MHz
  - SDI: 00 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** HF MODE | **Label:** 207 | **Data:** 000000 HEX
  - SDI: 00 | SSM: 00 | PAR: ODD | Rate: 200 ms

The second label 205 is used to send the .1 kHz part of the tuning frequency. Bit 11 of the label 205 word indicates whether the word is the #1 or #2 word.

> **WARNING:** THE #2 FREQUENCY WORD SHOULD NOT BE EDITED.

##### ARINC 719 HFDR RMP

Default transmitted words:

- **Function:** HF-A COMM Frequency | **Label:** 205 | **Data:** 10.0000 MHz
  - SDI: 00 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** HF-A COMM Frequency | **Label:** 205 | **Data:** 0.0000 MHz
  - SDI: 00 | SSM: NML | PAR: ODD | Rate: 200 ms
- **Function:** HF MODE | **Label:** 207 | **Data:** 000000 HEX
  - SDI: 00 | SSM: 00 | PAR: ODD | Rate: 200 ms

The second label 205 is used to send the .1 kHz part of the tuning frequency. Bit 11 of the label 205 word indicates whether the word is the #1 or #2 word.

> **WARNING:** THE #2 FREQUENCY WORD SHOULD NOT BE EDITED.

##### ARINC 579 VOR

- **Function:** VOR Frequency | **Label:** 034 | **Data:** 108.00 MHz
  - SDI: 00 | PAD: 0000 | SSM: NML | PAR: ODD | Rate: 200 ms

##### ARINC 755 MMR

When the 755 MMR is selected from the LRU selection screen, the following menus become accessible.

Default labels transmitted by the T1200 in the 710 ILS, DADS, & FMS menus:

| Channel A (12.5 KHz) | Channel B (12.5 KHz) | Channel C (100 KHz) |
|----------------------|----------------------|---------------------|
| 033 Landing System Mode / Freq | 040 Set Altitude | 040 Set Altitude |
| 017 Selected Runway Heading (BCD) | 041 Set Latitude | 041 Set Latitude |
| | 042 Set Longitude | 042 Set Longitude |
| | 125 UTCI | 125 UTCI |
| | 203 Set Altitude | 203 Set Altitude |
| | 210 True Air Speed | 210 True Air Speed |
| | 260 DATE | 260 DATE |
| | 320 Magnetic Heading | 320 Magnetic Heading |

In addition to the transmitted labels displayed on the screen, the default labels for the other two menus are also transmitted. For example, if the user selects the ILS button the display shows labels 033 and 017 as being transmitted on channel A. In addition, the default labels for the DADS / FMS (Channel B) and the IRS (Channel C) menu selections are also transmitted. The displayed labels may be edited as usual, but no changes may be made to the default labels being transmitted on the other channels. The purpose of transmitting the default labels in the background is to simulate the real-world environment which the 755-MMR operates in.

Automatic time increment of labels 125 & 150 occurs when the INC TIME button is highlighted. This button is only present in the MMR sub-menus. This automatic time increment applies to the time labels for other channels as well. Editing label data is not available when the INC TIME button is highlighted.

##### ARINC 709 DME

The ARINC 429 I/O requirements of the ARINC 709 frequency scanning DME are entirely met by the T1200B. Special software has been written specifically for the 709 DME to channel it to several directed frequencies and/or free scan and to sort and display the BNR and BCD distance outputs that correspond to each frequency. The T1200B also monitors the simulated distance, compares it with the DME BNR distance outputs, and displays the difference. This feature is particularly useful for monitoring DME tracking error at high velocities.

When the 709 DME area is selected from the LRU Selection Screen, the DME Test Configuration Screen is displayed (Figure 16). This screen allows the operator to choose one of three screen formats:

- **STANDARD NAV CONFIGURATION** → Standard LRU Test Format
- **SINGLE CHANNEL MODE** → Single Channel DME Test Screen (Figure 17)
- **MULTI CHANNEL MODE** → Multi Channel DME Test Screen (Figure 18)

> **NOTE:** Optional SQUAWK/NAUT is not supported by the T1200B.

###### DME Single Channel Mode

**Figure 17 — SINGLE CHANNEL DME TEST SCREEN**

**Transmitter** — Channel A transmitter is automatically programmed:

- **Function:** DME Frequency | **Label:** 035 | **Data:** 134.40 MHz
  - SDI: 00 | SSM: 00 | PAR: ODD | Rate: 100 ms

The DME mode bits (11–13) and SSM bits of the transmitted word are controllable by the touch screen. Simply touch the MODE SSM field. This causes the DME mode bits to be toggled through a list of options. The options, in order, are: **DF1, STBY, OFF, NCD, FT, and UND**.

| Mode | SSM | DME Mode Bits (13–11) | Description |
|------|-----|----------------------|-------------|
| DF1-5 | 00 | 001 | Normal operation; pressing MODE/ADVAN toggles to next directed frequency |
| SCAN | 00 | 110 | SCAN command |
| NCD | 01 | unchanged | No Computed Data |
| FT | 10 | unchanged | Functional Test |
| UND | 11 | unchanged | Undefined |
| STBY | 00 | 000 | Standby |
| OFF | — | — | T1200B stops transmitting the word |

**CHAN FIELD** — The frequency data of the transmitted word can be modified by pressing the CHAN field. Valid channels are 0–126. The state of the X/Y field sets the channel to the X or Y channel.

**SDI FIELD** — Toggles through: ALL (00 all call), 1 (01 unit #1), 2 (10 unit #2), and 3 (11 unit #3).

**DISP FIELD** — Programs Display Bit (bit 16): OFF (0) or ON (1).

**IDENT FIELD** — Programs IDENT Bit (bit 17): OFF (0) or ON (1).

**NAV FIELD** — Programs State Bits (bits 15 and 14):

| State | Bit 15 | Bit 14 |
|-------|--------|--------|
| VOR | 0 | 0 |
| ILS | 0 | 1 |
| MLS | 1 | 0 |
| Undefined | 1 | 1 |

**TX-A/TX-B FIELD** — Selects transmitter channel.

**1 X FIELD** — Changes output frequency of SQUAWK/NAUT when INDEP. is highlighted.

**NM FIELD** — Programs simulated distance (0.00 to 399.99 NM).

**KTS FIELD** — Programs simulated velocity (0 to 3999 KTS).

**REPLY EFF. FIELD** — Programs reply efficiency (0 to 100%).

**RF LEVEL FIELD** — Programs RF output level (-109 to -10 dBm).

**RECEIVER** — The ARINC 709 DME outputs a burst of ARINC 429 words containing: DME frequency (label 035), BNR distance (label 202), Ground Station Ident #1 (label 246), Ground with a SSM of NCD unless the display bit (bit 16) of the frequency word is set. The T1200B receives these data bursts, translates the distance data into engineering units, and computes the difference (delta) between the simulated and measured BNR distance.

ECHO field results:

| Value | Meaning |
|-------|---------|
| NONE | No frequency word received that corresponds with the transmitted word |
| OK | Received frequency word exactly matches (except SDI) the transmitted word |
| ERR | Received word does not match in SSM, frequency, IDENT, DISP, NAV, or parity bit |

**BNR DIST CONDITIONS:**

| Display | Condition |
|---------|-----------|
| PAR.ERR | Even parity word received, regardless of SSM and data fields |
| FW | Failure Warning SSM |
| NCD | No Computed Data SSM |
| 53.69T | Functional Test SSM (distance + T suffix) |
| 53.69 | Normal operation SSM |

**MEM field** — State of bit 11 (ON=1, OFF=0).
**B/F field** — State of bit 12 (F=1, B=0).

###### DME Multi Channel Mode

**Figure 18 — MULTI CHANNEL DME TEST SCREEN**

Channel A transmitter is automatically programmed to transmit six label 035 DME frequency words (SDI 00, SSM 00, odd parity at 100 ms rate):

| Data | Mode | Bits 13 12 11 |
|------|------|---------------|
| 134.40 MHz | Directed scan 1st frequency | 0 0 1 |
| 109.75 MHz | Directed scan 2nd frequency | 0 1 0 |
| 133.70 MHz | Directed scan 3rd frequency | 0 1 1 |
| 114.65 MHz | Directed scan 4th frequency | 1 0 0 |
| 117.90 MHz | Directed scan 5th frequency | 1 0 1 |
| 108.00 MHz | Free scan | 1 1 0 |

Each word being transmitted is displayed on the Multi Channel DME Test Screen. Press the **LINE ADVANCE** field to access the next transmit word in the list.

The Multi Channel DME Test Screen transmits all six modes. Any one of the five directed frequencies can be changed to standby mode by pressing the MODE SSM field until STBY mode is shown, then pressing ENTER.

**SQ/NT/INDEP. field:**
- When **SQ/NT** is highlighted: SQUAWK/NAUT frequency is programmed automatically to the frequency specified by the word being edited
- When **INDEP.** is highlighted: SQUAWK/NAUT is under operator control

Press the **SQ/NT CTL** field to access the SQUAWK/NAUT Control Screen (Figure 19). Press **DME RETURN** to return to the Multi Channel DME Test Screen.

**Figure 19 — SQUAWK/NAUT CONTROL SCREEN**

The DME frequency words received while in the Multi Channel DME Test Screen are displayed in the same manner described in the Single Channel DME Test Screen.
