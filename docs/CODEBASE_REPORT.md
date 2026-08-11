# MCL-OCR Codebase Report

## Overview
This repository contains a full-stack OCR document processing prototype for Municipal Corporation Ludhiana (MCL). The current implementation combines a FastAPI backend with multiple OCR strategies (Mistral with Paddle fallback), image preprocessing, and LLM-based field extraction, paired with a React + Vite frontend for document upload and result display.

## Current Repository Structure

- `backend/` - Python backend service and deployment assets.
  - `app/` - FastAPI application package.
    - `main.py` - FastAPI app initialization with CORS middleware and router registration.
    - `config.py` - environment variable loading and external API client initialization.
    - `routes/` - API endpoints for health checks and document processing.
    - `services/` - image preprocessing, dual OCR engines, and LLM extraction.
    - `utils/` - file I/O and result persistence helpers.
    - `schemas/` - request/response model placeholders (currently empty).
  - `tests/` - unit and integration tests.
  - `requirements.txt` - Python dependencies including mistralai.
  - `Dockerfile` and `docker-compose.yml` - container deployment configuration.
- `frontend/` - React + Vite frontend application.
  - `src/App.tsx` - main document upload UI with image preview and extracted results display.
  - `src/main.tsx` - app entry point.
  - `src/App.css`, `src/index.css` - styling.
  - `package.json` - frontend dependencies and build scripts.
- `docs/` - project documentation including this report.

## Backend Architecture

### 1. Application Entry
The backend entry point is [backend/app/main.py](backend/app/main.py). It:
- initializes the FastAPI app with logging configuration.
- adds CORS middleware configured for `http://localhost:5173` (React frontend development server).
- registers two routers: `health_router` and `upload_router`.

### 2. Configuration and API Clients
The file [backend/app/config.py](backend/app/config.py) manages environment configuration and external API client initialization:
- **Gemini API**: Optional Google Gemini client initialization.
- **Anthropic API**: Claude client for structured field extraction.
- **Mistral API**: Support for Mistral OCR (loaded separately in mistral service).
- **Supabase**: Optional database configuration (not yet integrated).
- **Google Sheets & Drive**: Environment variables for future integration.

All clients are initialized with graceful fallback if API keys are missing.

### 3. Upload Flow with Dual OCR Strategy
The main endpoint in [backend/app/routes/upload.py](backend/app/routes/upload.py) orchestrates the processing pipeline:

1. **File Upload**: Saves uploaded image to `uploads/` folder.
2. **Image Preprocessing**: Applies OpenCV enhancements via `process_image()`.
3. **OCR (Dual Strategy)**:
   - Attempts **Mistral OCR** first (via `mistral_process_ocr()`).
   - Falls back to **Paddle OCR** on failure (via `paddle_process_ocr()`).
   - Logs failures for debugging.
4. **Structured Extraction**: Passes OCR text to Claude via `process_document()`.
5. **Result Persistence**: Saves JSON output with metadata to `output/` folder with timestamp-based naming for traceability.
6. **Response**: Returns extracted data and output file path to frontend.

### 4. File Handling and Traceability
The utility module [backend/app/utils/file_utils.py](backend/app/utils/file_utils.py) provides:
- `save_uploaded_file()`: Stores raw uploaded images in `uploads/`.
- `save_result_json()`: Writes processing results to `output/<sanitized_filename>_<timestamp>.json`.
  - Includes: original filename, original path, processed path, OCR text, LLM result, timestamp.
  - Enables complete traceability from source image to extracted result.

### 5. Image Preprocessing
The service [backend/app/services/opencv_services.py](backend/app/services/opencv_services.py):
- Reads the image via OpenCV.
- Converts BGR (OpenCV default) to RGB.
- Applies brightness and contrast adjustments (configurable, defaults to no-op).
- Applies Gaussian blur for denoising.
- Applies sharpening kernel filter.
- Validates 3-channel RGB format.
- Converts back to BGR and writes to `processed/<filename>`.
- Returns processed image path.

### 6. OCR Service: Mistral (Primary)
The service [backend/app/services/mistral_ocr_services.py](backend/app/services/mistral_ocr_services.py):
- Validates input file existence and type.
- Encodes the image to base64.
- Sends to Mistral OCR API with `mistral-ocr-latest` model.
- Returns markdown-formatted OCR output from `ocr_response.pages[0].markdown`.
- Supports MIME type detection for JPEG and PNG.
- Includes commented schema for future structured extraction via Mistral.

### 7. OCR Service: Paddle (Fallback)
The service [backend/app/services/paddle_ocr_service.py](backend/app/services/paddle_ocr_service.py):
- (Renamed from original `ocr_service.py`)
- Loads PaddleX OCR pipeline at module import.
- Validates input file existence.
- Runs `ocr_pipeline.predict()` on the image.
- Extracts text from results and joins into single string.
- Returns dict with: file path, raw results, combined text.

### 8. LLM-Based Extraction
The service [backend/app/services/claude_service.py](backend/app/services/claude_service.py):
- Uses Anthropic Claude API for structured field extraction.
- Builds a prompt for the LLM with OCR text and instructions.
- Expects JSON response with fields: date, subject, summary, department, sender_name, sender_contact, receiver, reference_number.
- Parses JSON response and returns structured dict.
- Handles JSON parse errors gracefully.

### 9. Tests
The test suite in [backend/tests/test_mistral_service.py](backend/tests/test_mistral_service.py) covers:
- Mock testing of Mistral OCR integration.
- Error handling and fallback scenarios.

## Frontend Architecture

### 1. Framework and Build Setup
The frontend uses:
- **React 19** + TypeScript for type-safe UI components.
- **Vite** for fast development server and optimized builds.
- **Tailwind CSS** for styling (configured via package.json).
- Development server runs on `http://localhost:5173`.

### 2. Main Application Component
The file [frontend/src/App.tsx](frontend/src/App.tsx) implements a document scanner UI with:
- **File Input**: Hidden input element for image selection.
- **Image Preview**: 3:4 aspect ratio viewfinder showing selected image.
- **Scan Button**: Uploads image to backend `/upload/` endpoint.
- **Loading State**: Shows animated scan-line overlay during processing.
- **Results Display**: Card showing extracted fields (date, subject, summary, department, sender info, receiver, reference number).
- **Styling**: Dark theme with blue accents, responsive layout centered on screen.

### 3. Current User Flow
1. User taps/clicks on preview area or scan button to select a document image.
2. Image appears in the 3:4 viewfinder with corner brackets (scanner aesthetic).
3. User clicks "Scan Document" button.
4. Frontend fetches `POST http://localhost:8000/upload/` with file FormData.
5. Backend processes and returns `extracted_data` JSON.
6. Frontend renders results in a card below the scanner area.
7. User can select another image to repeat.

## End-to-End Processing Flow

The complete document processing pipeline:

1. **Frontend**: User selects and uploads a document image via the React UI.
2. **Backend Save**: Image is saved to `uploads/<filename>`.
3. **OpenCV Processing**: Image is preprocessed (blur, sharpen, denoise) and saved to `processed/<filename>`.
4. **Dual OCR Strategy**:
   - **Primary**: Mistral OCR API converts image to markdown text.
   - **Fallback**: If Mistral fails, Paddle OCR (via PaddleX) extracts text.
   - Error is logged for monitoring.
5. **LLM Extraction**: Claude (Anthropic) receives OCR text and extracts structured fields (date, subject, department, etc.) as JSON.
6. **Result Persistence**: JSON output containing original filename, file paths, OCR text, LLM result, and timestamp is saved to `output/<sanitized>_<timestamp>.json`.
7. **Response**: Backend returns:
   - Extracted data (LLM result).
   - Output file path (for later retrieval or audit).
   - Original filename.
   - Success message.
8. **Frontend Display**: Results card renders extracted fields with user-friendly labels.
9. **Audit Trail**: All files (original, processed, output) are linked via filename and timestamp.

## Current Status

### Fully Implemented
- **Dual OCR Pipeline**: Mistral OCR as primary with Paddle OCR fallback.
- **Image Preprocessing**: OpenCV-based image enhancement (blur, sharpen, denoise).
- **Structured Extraction**: Claude LLM converts OCR text to JSON fields.
- **File Persistence**: Linked storage of uploaded, processed, and output files.
- **React Frontend**: Full document scanning UI with image preview and results display.
- **Logging**: Error and info logging for debugging and audit trails.
- **CORS Support**: Configured for React dev server on localhost:5173.
- **Environment Configuration**: Graceful client initialization for Mistral, Anthropic, Gemini APIs.

### Partial / Planned Implementation
- **Supabase Integration**: Config loaded but not used in processing flow.
- **Google Sheets Sync**: Config available but not implemented.
- **Google Drive Storage**: Not yet integrated.
- **Request/Response Schemas**: Placeholder files in `schemas/` directory—no Pydantic models defined.
- **Manual Verification Workflow**: Not yet built.
- **Authentication & Authorization**: Not implemented.

### Known Limitations
- Mistral API key is required for primary OCR; lack of key will cause immediate failure.
- Paddle OCR fallback requires correct PaddleX installation (can be finicky).
- No database persistence; results only saved to local JSON files.
- Frontend does not yet display output file paths or allow retrieval.
- No retry logic or queuing mechanism for failed uploads.

## Technical Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | FastAPI + Uvicorn | REST API server |
| Frontend | React 19 + Vite | Document scanner UI |
| Image Processing | OpenCV | Preprocessing and enhancement |
| Primary OCR | Mistral OCR API | High-accuracy document text extraction |
| Fallback OCR | PaddleX/PaddleOCR | Redundancy, local fallback |
| LLM Extraction | Anthropic Claude | Structured field extraction from OCR text |
| File Storage | Local filesystem | Uploaded, processed, and output files |
| Logging | Python logging | Audit trail and debugging |
| Styling | Inline CSS | Dark theme, scanner aesthetic |

## Key Files by Purpose

### Entry Points
- `backend/app/main.py` - FastAPI app initialization
- `frontend/src/main.tsx` - React app initialization

### Core Processing
- `backend/app/routes/upload.py` - Main request orchestration
- `backend/app/services/mistral_ocr_services.py` - Mistral OCR (primary)
- `backend/app/services/paddle_ocr_service.py` - Paddle OCR (fallback)
- `backend/app/services/claude_service.py` - Structured extraction
- `backend/app/services/opencv_services.py` - Image preprocessing

### File Management
- `backend/app/utils/file_utils.py` - File I/O and result persistence

### Configuration
- `backend/app/config.py` - Environment and API client setup
- `backend/requirements.txt` - Python dependencies

### Frontend
- `frontend/src/App.tsx` - Scanner UI component
- `frontend/package.json` - Node dependencies and build config

### Testing
- `backend/tests/test_mistral_service.py` - Unit tests for Mistral integration

## Next Steps & Recommendations

1. **Database Integration**: Replace local JSON files with Supabase for scalable, queryable results storage.
2. **Frontend Enhancement**:
   - Display output file paths and allow result retrieval.
   - Show processing status (upload → preprocessing → OCR → extraction).
   - Add error handling and retry UI.
3. **Request/Response Schemas**: Define Pydantic models in `schemas/` for API validation and OpenAPI docs.
4. **Retry Logic**: Add exponential backoff and retry attempts for Mistral API failures.
5. **Performance Optimization**:
   - Cache OCR results to avoid reprocessing same images.
   - Async processing for large batches.
   - Image compression before upload.
6. **Testing & Monitoring**:
   - Expand test coverage (currently minimal).
   - Add structured logging with timestamps and request IDs.
   - Monitor API failure rates and latencies.
7. **Deployment**:
   - Dockerize and test full stack.
   - Configure production API keys and rate limits.
   - Set up CI/CD pipeline for automated testing and deployment.

## Notes
The project has evolved from a placeholder prototype into a working end-to-end OCR pipeline with dual fallback strategies. The Mistral OCR API provides high accuracy, while Paddle OCR ensures processing continues even if external API fails. The React frontend provides a polished scanner UX, and the backend meticulously tracks files from source to extracted result. The main gaps are persistent storage, comprehensive error handling, and full-featured admin/audit UI.