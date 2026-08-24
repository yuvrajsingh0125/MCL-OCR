# MCL Patr — Project Context Handoff

**Last updated:** August 24, 2026

## Purpose
MCL Patr is a municipal document digitization system for Municipal Corporation Ludhiana. This branch (`sheets`) is optimized for digitizing large multi-page ward sanitation worker registers and archiving them to Google Sheets.

---

## Active Git Workflow
- **Repository**: `yuvrajsingh0125/MCL-OCR`
- **Active Branch**: `sheets` (used for ward digitization, sheets syncing, and visual upgrades)
- **Status**: The pipeline supports large PDFs, automatically chunking them into 5-page batches to avoid timeouts, and syncing records directly to Google Sheets via a Google Apps Script webhook.

---

## Current Architecture

```text
React 19 + Vite + TypeScript (App.tsx Loop)
        ↓
Initialize Session (/upload-ward/initialize/)
        ↓
FastAPI processes chunks of 5 pages (/upload-ward/process-chunk/)
  ├── Temporary save to session uploads/
  ├── Mistral OCR per page
  ├── Anthropic Claude structured extraction
  ├── Lock ward number on first detection (prevents overrides from OCR typos)
  └── Sync rows to Google Sheets (adding blank separators at page boundaries)
        ↓
Finalize Session (/upload-ward/finalize/)
  └── Clean up temp uploads and files
```

---

## Repository Structure

```text
backend/app/
  main.py
  config.py
  routes/
    upload_ward.py        # Chunk processing API
    history_ward.py       # Local history log
  services/
    mistral_ocr_services.py
    claude_ward_service.py # Prompt mappings for status & ward
    sheets_ward_service.py # GAS webhook sync
  utils/
    file_utils.py

frontend/src/
  App.tsx                 # Chunk loop state machine
  index.css               # Premium Glassmorphism UI
  screens/
    CameraScreen.tsx      # Dropzone & scanner
    HistoryScreen.tsx     # View submission history
    ResultScreen.tsx      # Show tables of parsed records
```

---

## Extracted Schema & Mapping

Extractions target exactly 7 standard columns, with all Gurmukhi translated to English:
1. `Serial Number`
2. `Sanitation Worker Name`
3. `Father/Husband Name`
4. `Employee Beat`
5. `Address`
6. `Employability Status` (`Permanent`, `Sanctioned`, `DC Rate`, `Outsourced`)
7. `Mobile Number`

---

## UI Styling Design
The frontend uses a **premium light/dark Glassmorphism design** featuring:
- Soft radial color gradients on the body background.
- Frosted glass headers and docks (`backdrop-filter: blur(24px)`).
- Outfit (display) and Inter (body) Google Fonts.
- Hover lift transformations and active press animations.
- Interactive file dropzones with pulsing scanning animation indicators.
