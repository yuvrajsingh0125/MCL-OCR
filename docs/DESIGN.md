# MCL Patr — Design Document

Architecture decisions and the reasoning behind them.

---

## 1. Why we use a Chunked Multi-Request Pipeline
Large PDF files (10+ pages) are slow to OCR and parse. If processed in a single HTTP request:
- It frequently hits API and Gateway timeouts (typically 30s–60s).
- It exceeds token limits of LLM calls.

**Decision**: The frontend initializes a submission session, divides the PDF pages into chunks of 5 pages, calls the backend sequentially for each chunk, and finalizes the session at the end. This keeps individual HTTP requests short and stable.

---

## 2. Why the Ward Number is Locked
Handwritten signatures, stamp numbers, or OCR typos on later pages of a ward list can misidentify the ward (e.g., reading a signature `5.5` as Ward 5, or `€85` as Ward 83).

**Decision**: Once a ward number is established on the first pages of a document, the `current_ward` is locked. Subsequent chunks/pages cannot overwrite it, ensuring all pages stay under a single consolidated sheet.

---

## 3. Why we use Google Sheets as the Archive
Municipal departments require a collaborative, easily readable, and live-updating list that acts as the source of truth for administrative tasks.

**Decision**: An Apps Script webhook writes standard records directly to Google Sheets, automatically merging duplicate worker rows (matching by name and father's name) and appending new entries with visual spacing.

---

## 4. Why we insert a Separator Row
To make the Google Sheets archive visually readable, it is helpful to insert line breaks between different categories/pages.

**Decision**: The backend appends a blank row at the end of each page's sync payload. The Apps Script webhook detects this completely blank row, skips deduplication, and appends a blank row to the Google Sheet.
