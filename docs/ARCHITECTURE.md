# System Architecture Documentation

## 1. System Topology

```
                  +-----------------------------------------+
                  |         Web Browser Client              |
                  |  http://localhost:8080 (or 10.11.11.2)   |
                  +--------------------+--------------------+
                                       |
                     +-----------------+-----------------+
                     |                                   |
           /arinc.html & arinc.js              /dist/index.html (React SPA)
       [Operator & T1200 Workbench]        [Dynapro 1780A Infotouch CRT Console]
                     |                                   |
                     +-----------------+-----------------+
                                       |
                   +-------------------+-------------------+
                   |           FastAPI Kernel              |
                   |   ate_platform.web.app / uvicorn      |
                   +-------------------+-------------------+
                                       |
            +--------------------------+--------------------------+
            |                          |                          |
     /api/standard/*              /api/cfds/*                /api/cmc/*
   [Dynamic LRU Registry]     [Airbus ABD0018/48]      [Boeing D243W201-1]
            |                          |                          |
            +--------------------------+--------------------------+
                                       |
                   +-------------------+-------------------+
                   |        Arinc429Coordinator            |
                   |     (Ownership & Channel Lock)        |
                   +-------------------+-------------------+
                                       |
                     +-----------------+-----------------+
                     |                                   |
       [Hardware OmniBus II Card]             [Software Simulation Fallback]
          (BTI429 Ballard Driver)                 (Virtual ARINC 429 Words)
```

---

## 2. Dynamic STANDARD MODE per LRU

The Dynamic STANDARD MODE replaces hardcoded LRU screens with a data-driven registry pattern:
- **Registry (`lru_registry.py` & `lruRegistry.ts`):** Defines parameter schemas, default bit boundaries, and validation rules per LRU (DME, VOR, ILS, ADF, MMR).
- **Single Channel Mode (`LruSingleChannelModeView.tsx`):** Renders the retro CRT screen faithfully according to Aeroflex T1200B Manual Section 4.B (Figure 17).
- **Manual Parameter Editing:** Allows real-time editing of PAD bit-strings (`1100001`), frequency engineering values, SDI, SSM, Parity, and Rate with instant input validation.
- **Dynapro F-Keys:** Implements `DISP CURSOR`, `DATA STEP`, `INC/DECR`, `BIT RATE`, `TX-A/TX-B`, `RX-A/RX-B`, and `TRANSMIT WORD`.
