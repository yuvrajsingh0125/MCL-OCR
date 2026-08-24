# MCL Patr (Ward Sanitation Digitization)

MCL Patr is the Municipal Corporation Ludhiana document digitization system. This branch (`sheets`) is configured to digitize large ward sanitation worker register documents and sync them to a Google Sheets archive.

---

## Architecture & Pipeline

Due to the size of ward registers (often 10+ pages), the system uses a **stateful chunked multi-request pipeline** to avoid HTTP timeouts and API token rate-limits:

```text
Upload PDF / Image
    ↓
Initialize Session (/upload-ward/initialize/)
    ↓
Split PDF into chunks of 5 pages
    ↓
Process Chunks sequentially (/upload-ward/process-chunk/)
  ├── OCR each page in the chunk using Mistral OCR
  ├── Extract data using Claude (strict 7-column schema)
  ├── Propagate and lock ward number across chunks (prevents OCR overrides)
  └── Sync chunk rows to Google Sheets (including a blank separator row at page ends)
    ↓
Finalize Session (/upload-ward/finalize/)
  └── Clean up temporary directories on disk
```

---

## Standardized 7-Column Schema

All extractions are mapped to a strict 7-column layout (translated to English):

1. **Serial Number** (e.g. `1`, `2`)
2. **Sanitation Worker Name** (e.g. `Chandrapal`)
3. **Father/Husband Name** (e.g. `Tara Chand`)
4. **Employee Beat** (e.g. `New Sant Nagar`)
5. **Address** (e.g. `House No. 12, Gali No. 3`)
6. **Employability Status** (e.g. `Permanent`, `Sanctioned`, `DC Rate`, `Outsourced`)
7. **Mobile Number** (e.g. `9877174834`)

---

## Live Deployments

- **Frontend dev**: https://mcl-ocr.vercel.app
- **Backend dev**: https://mcl-ocr.onrender.com

---

## Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | React 19 + Vite + TypeScript | Premium Glassmorphic Digitizer UI |
| **Backend** | FastAPI + Uvicorn | API and pipeline orchestration |
| **OCR** | Mistral OCR | Text extraction |
| **Extraction** | Anthropic Claude | Structured field parsing |
| **Archival** | Google Sheets webhook | Long-term record archive |

---

## Repository Layout

```text
MCL-OCR/
├── backend/
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── routes/
│       │   ├── upload_ward.py     # Chunked PDF endpoints
│       │   └── history_ward.py    # Local history endpoints
│       ├── services/
│       │   ├── claude_ward_service.py
│       │   └── sheets_ward_service.py
│       └── utils/
│           └── file_utils.py
├── frontend/
│   └── src/
│       ├── App.tsx                # Frontend state machine & chunk loop
│       ├── index.css              # Premium Glassmorphic design styles
│       └── screens/
│           ├── CameraScreen.tsx
│           ├── HistoryScreen.tsx
│           └── ResultScreen.tsx
└── docs/
    ├── README.md
    ├── PROJECT_CONTEXT.md
    └── DESIGN.md
```
