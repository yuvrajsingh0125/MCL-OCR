from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import logging
from uuid import uuid4
from datetime import datetime
from pathlib import Path
import json
import time
import shutil
from pydantic import BaseModel

from pypdf import PdfReader, PdfWriter

from app.config import MAX_PDF_PAGES_LIMIT
from app.services.opencv_services import process_image
from app.services.mistral_ocr_services import mistral_process_ocr
from app.services.claude_ward_service import extract_ward_data
from app.services.sheets_ward_service import sync_to_sheets
from app.services.history_service import save_submission
from app.utils.file_utils import save_uploaded_file, delete_file

logger = logging.getLogger(__name__)

router = APIRouter()

def execute_with_backoff(step_name: str, report_callback, func, *args, **kwargs):
    """
    Executes a service step. If it hits a rate limit (HTTP 429) or a temporary
    server error (HTTP 502/503/504), sleeps with exponential backoff and retries (up to 5 attempts).
    For standard errors, executes a single-retry fallback.
    """
    max_attempts = 5
    attempt = 0
    while attempt < max_attempts:
        attempt += 1
        try:
            return func(*args, **kwargs)
        except Exception as e:
            status_code = getattr(e, "status_code", None)
            err_msg = str(e).lower()
            
            is_rate_limit = (status_code == 429) or ("rate limit" in err_msg) or ("429" in err_msg) or ("too many requests" in err_msg)
            is_temp_error = (status_code in [502, 503, 504]) or ("502" in err_msg) or ("503" in err_msg) or ("504" in err_msg)

            if (is_rate_limit or is_temp_error) and attempt < max_attempts:
                # Extract wait time from Retry-After header or calculate exponential backoff
                retry_after = 5
                headers = getattr(e, "headers", None)
                if headers and "retry-after" in headers:
                    try:
                        retry_after = int(headers["retry-after"])
                    except ValueError:
                        pass
                else:
                    retry_after = 2 * (attempt ** 2)

                report_callback(f"Rate limit / network error at '{step_name}'. Waiting {retry_after}s before retry (Attempt {attempt}/{max_attempts})...")
                time.sleep(retry_after)
            else:
                # If we've exhausted attempts or it's a hard error (e.g. 400 credit exhaustion)
                if attempt >= max_attempts:
                    logger.error(f"Step '{step_name}' failed permanently after {max_attempts} attempts: {e}")
                    raise e
                else:
                    # Single retry fallback for standard errors
                    logger.warning(f"Step '{step_name}' failed with standard error: {e}. Retrying once...")
                    time.sleep(1)
                    try:
                        return func(*args, **kwargs)
                    except Exception as retry_err:
                        logger.error(f"Step '{step_name}' failed on standard retry: {retry_err}")
                        raise retry_err

@router.post("/upload-ward/")
async def upload_ward(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files were provided.")

    submission_id = str(uuid4())
    logger.info(f"Starting ward submission {submission_id} with {len(files)} files.")

    def stream_process():
        temp_files_to_clean = []
        all_rows = []
        all_columns = set()
        total_rows_written = 0
        current_ward = None

        try:
            yield json.dumps({"type": "progress", "stage": "preprocess", "message": "Pre-validating page limits..."}) + "\n"
            
            saved_paths = []
            for file in files:
                saved_path = save_uploaded_file(file)
                temp_files_to_clean.append(saved_path)
                saved_paths.append(saved_path)

            pages_to_process = []

            for saved_path in saved_paths:
                path_obj = Path(saved_path)
                suffix = path_obj.suffix.lower()

                if suffix == ".pdf":
                    try:
                        reader = PdfReader(saved_path)
                        pages_count = len(reader.pages)
                        
                        if pages_count > MAX_PDF_PAGES_LIMIT:
                            raise ValueError(f"PDF exceeds the maximum page limit of {MAX_PDF_PAGES_LIMIT} pages.")

                        logger.info(f"Splitting PDF {path_obj.name} ({pages_count} pages)...")
                        for page_idx in range(pages_count):
                            writer = PdfWriter()
                            writer.add_page(reader.pages[page_idx])
                            
                            split_filename = f"split_{submission_id}_page_{page_idx + 1}.pdf"
                            split_path = path_obj.parent / split_filename
                            with open(split_path, "wb") as f:
                                writer.write(f)
                            
                            temp_files_to_clean.append(str(split_path))
                            pages_to_process.append({
                                "path": split_path,
                                "original_name": f"{path_obj.name} (Page {page_idx + 1})",
                                "is_temp": True
                            })
                    except Exception as e:
                        raise ValueError(f"Failed to read/split PDF: {str(e)}")
                else:
                    pages_to_process.append({
                        "path": path_obj,
                        "original_name": path_obj.name,
                        "is_temp": False
                    })

            total_pages = len(pages_to_process)
            logger.info(f"Resolved total of {total_pages} pages to process.")

            for idx, page_info in enumerate(pages_to_process, start=1):
                page_path = page_info["path"]
                page_name = page_info["original_name"]
                suffix = page_path.suffix.lower()
                
                # Callback helper to yield rate limit wait messages to client
                def report_wait(msg: str):
                    logger.info(msg)
                    # Use a connection-friendly chunk structure
                    # We output as progress log keeping active state unchanged
                    # We send it with a carriage return line feed
                    # We do this asynchronously within generator
                    # Wait, we can yield inside this generator. Since python functions cannot yield from inner closures unless we yield from generator,
                    # we will catch wait messages by updating a local list or yielding them.
                    # Wait, a callback inside a nested function cannot directly 'yield' from outer generator.
                    # Instead, we will store wait messages in a list and check them, or we can raise a customized exception,
                    # or we can pass a queue, or simply yield before running the step if we predict it, or we can yield from report_wait if it's a generator.
                    # Actually, we can just print it in logs.
                    pass

                yield json.dumps({
                    "type": "progress", 
                    "stage": "preprocess", 
                    "page": idx, 
                    "total": total_pages, 
                    "message": f"[{idx}/{total_pages}] Preprocessing {page_name}..."
                }) + "\n"

                processed_path = None
                ocr_source = page_path

                try:
                    # OpenCV Preprocessing
                    if suffix in [".jpg", ".jpeg", ".png", ".webp"]:
                        processed_path = execute_with_backoff(
                            "OpenCV Preprocessing",
                            lambda m: logger.warning(m),
                            process_image,
                            str(page_path)
                        )
                        ocr_source = Path(processed_path)
                        if processed_path:
                            temp_files_to_clean.append(processed_path)

                    # Mistral OCR
                    yield json.dumps({
                        "type": "progress", 
                        "stage": "ocr", 
                        "page": idx, 
                        "total": total_pages, 
                        "message": f"[{idx}/{total_pages}] Running OCR on {page_name}..."
                    }) + "\n"

                    ocr_result = execute_with_backoff(
                        "Mistral OCR",
                        lambda m: logger.warning(m),
                        mistral_process_ocr,
                        ocr_source
                    )
                    ocr_text = ocr_result.get("text", "")

                    if not ocr_text.strip():
                        logger.warning(f"Page {page_name} returned empty OCR text. Skipping.")
                        continue

                    # Claude Extraction
                    yield json.dumps({
                        "type": "progress", 
                        "stage": "extraction", 
                        "page": idx, 
                        "total": total_pages, 
                        "message": f"[{idx}/{total_pages}] Extracting ward table from {page_name}..."
                    }) + "\n"

                    extraction = execute_with_backoff(
                        "Claude Data Extraction",
                        lambda m: logger.warning(m),
                        extract_ward_data,
                        ocr_text
                    )
                    if "error" in extraction:
                        raise Exception(extraction["error"])

                    ward = extraction.get("ward")
                    columns = extraction.get("columns", [])
                    rows = extraction.get("rows", [])

                    if not ward:
                        ward = current_ward
                    else:
                        current_ward = ward

                    if not ward:
                        raise Exception(f"Ward number not found on {page_name}. Please verify the document.")

                    if not rows:
                        logger.info(f"No rows extracted on page {page_name}. Skipping Sheets sync.")
                        continue

                    # Sync to Google Sheets
                    yield json.dumps({
                        "type": "progress", 
                        "stage": "sheets", 
                        "page": idx, 
                        "total": total_pages, 
                        "message": f"[{idx}/{total_pages}] Syncing Ward {ward} records to Google Sheets..."
                    }) + "\n"

                    rows_written = execute_with_backoff(
                        "Google Sheets Sync",
                        lambda m: logger.warning(m),
                        sync_to_sheets,
                        ward,
                        columns,
                        rows
                    )
                    total_rows_written += rows_written

                    all_rows.extend(rows)
                    for col in columns:
                        all_columns.add(col)

                    # Page cleanup
                    if processed_path:
                        delete_file(processed_path)
                    if page_info["is_temp"]:
                        delete_file(str(page_path))

                except Exception as page_err:
                    logger.error(f"Permanent error processing page {idx} ({page_name}): {page_err}")
                    
                    # Graceful Partial Completion Recovery
                    if total_rows_written > 0:
                        final_columns = list(all_columns)
                        error_detail = f"Halted at page {idx} ({page_name}) due to: {str(page_err)}"
                        
                        entry = {
                            "submission_id": submission_id,
                            "ward": str(current_ward or "Multiple"),
                            "rows_written": total_rows_written,
                            "columns": final_columns,
                            "rows": all_rows,
                            "created_at": datetime.utcnow().isoformat(),
                            "status": "partial_complete",
                            "error_message": error_detail
                        }
                        save_submission(entry)

                        yield json.dumps({
                            "type": "result",
                            "status": "partial_complete",
                            "submission_id": submission_id,
                            "ward": str(current_ward or "Multiple"),
                            "columns": final_columns,
                            "rows_written": total_rows_written,
                            "rows": all_rows,
                            "error_message": error_detail
                        }) + "\n"
                        return
                    else:
                        yield json.dumps({"type": "error", "message": f"Failed on page {idx} ({page_name}): {str(page_err)}"}) + "\n"
                        return

            # Final success complete
            final_columns = list(all_columns)
            entry = {
                "submission_id": submission_id,
                "ward": str(current_ward or "Multiple"),
                "rows_written": total_rows_written,
                "columns": final_columns,
                "rows": all_rows,
                "created_at": datetime.utcnow().isoformat(),
                "status": "complete"
            }
            save_submission(entry)

            yield json.dumps({
                "type": "result",
                "status": "complete",
                "submission_id": submission_id,
                "ward": str(current_ward or "Multiple"),
                "columns": final_columns,
                "rows_written": total_rows_written,
                "rows": all_rows
            }) + "\n"

        except Exception as e:
            logger.error(f"Execution error in streaming pipeline: {e}")
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"
        finally:
            for temp_file in temp_files_to_clean:
                if Path(temp_file).exists():
                    delete_file(temp_file)

    return StreamingResponse(stream_process(), media_type="application/x-ndjson")


class ProcessChunkRequest(BaseModel):
    submission_id: str
    chunk_index: int
    type: str  # "pdf" or "image"
    filename: str
    original_name: str
    current_ward: str | None = None


class FinalizeRequest(BaseModel):
    submission_id: str
    status: str  # "complete" or "partial_complete"


@router.post("/upload-ward/initialize/")
async def initialize_upload(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files were provided.")

    submission_id = str(uuid4())
    logger.info(f"Initializing upload {submission_id} with {len(files)} files.")

    # Create folder uploads/{submission_id}
    session_dir = Path("uploads") / submission_id
    session_dir.mkdir(parents=True, exist_ok=True)

    chunks = []
    chunk_index = 1

    for file in files:
        suffix = Path(file.filename).suffix.lower()
        
        # Save file temporarily under session folder
        temp_file_path = session_dir / file.filename
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        if suffix == ".pdf":
            try:
                reader = PdfReader(temp_file_path)
                pages_count = len(reader.pages)
                
                # Split the PDF into chunks of 5 pages
                chunk_size = 5
                for i in range(0, pages_count, chunk_size):
                    start_page = i + 1
                    end_page = min(i + chunk_size, pages_count)
                    
                    writer = PdfWriter()
                    for page_idx in range(i, end_page):
                        writer.add_page(reader.pages[page_idx])
                    
                    chunk_filename = f"chunk_{chunk_index}_page_{start_page}_to_{end_page}.pdf"
                    chunk_path = session_dir / chunk_filename
                    with open(chunk_path, "wb") as f:
                        writer.write(f)
                    
                    chunks.append({
                        "chunk_index": chunk_index,
                        "type": "pdf",
                        "filename": chunk_filename,
                        "original_name": f"{file.filename} (Pages {start_page}-{end_page})",
                        "start_page": start_page,
                        "end_page": end_page
                    })
                    chunk_index += 1
                
                # Delete the original full PDF as it has been split
                if temp_file_path.exists():
                    temp_file_path.unlink()
            except Exception as e:
                # Clean up and raise
                if session_dir.exists():
                    shutil.rmtree(session_dir)
                raise HTTPException(status_code=400, detail=f"Failed to read/split PDF {file.filename}: {str(e)}")
        else:
            # Image file
            # Rename the file to chunk_X_filename
            chunk_filename = f"chunk_{chunk_index}_{file.filename}"
            chunk_path = session_dir / chunk_filename
            temp_file_path.rename(chunk_path)
            
            chunks.append({
                "chunk_index": chunk_index,
                "type": "image",
                "filename": chunk_filename,
                "original_name": file.filename,
                "start_page": 1,
                "end_page": 1
            })
            chunk_index += 1

    return {
        "submission_id": submission_id,
        "total_chunks": len(chunks),
        "chunks": chunks
    }


@router.post("/upload-ward/process-chunk/")
async def process_chunk(req: ProcessChunkRequest):
    submission_id = req.submission_id
    chunk_index = req.chunk_index
    chunk_type = req.type
    filename = req.filename
    original_name = req.original_name

    logger.info(f"Processing chunk {chunk_index} ({original_name}) for submission {submission_id}")

    session_dir = Path("uploads") / submission_id
    page_path = session_dir / filename

    if not page_path.exists():
        raise HTTPException(status_code=404, detail=f"Chunk file not found: {filename}")

    all_rows = []
    all_columns = set()
    total_rows_written = 0
    current_ward = req.current_ward

    processed_path = None
    ocr_source = page_path

    try:
        # OpenCV Preprocessing (only for images)
        suffix = page_path.suffix.lower()
        if chunk_type == "image" and suffix in [".jpg", ".jpeg", ".png", ".webp"]:
            processed_path = execute_with_backoff(
                "OpenCV Preprocessing",
                lambda m: logger.warning(m),
                process_image,
                str(page_path)
            )
            if processed_path:
                ocr_source = Path(processed_path)

        # Mistral OCR
        ocr_result = execute_with_backoff(
            "Mistral OCR",
            lambda m: logger.warning(m),
            mistral_process_ocr,
            ocr_source
        )
        ocr_text = ocr_result.get("text", "")

        if not ocr_text.strip():
            logger.warning(f"Chunk {original_name} returned empty OCR text.")
            return {
                "chunk_index": chunk_index,
                "ward": None,
                "columns": [],
                "rows": [],
                "rows_written": 0
            }

        # Split OCR text back into pages if multiple pages are returned by Mistral OCR
        pages = []
        parts = ocr_text.split("===== PAGE ")
        for part in parts:
            if not part.strip():
                continue
            subparts = part.split("=====\n", 1)
            if len(subparts) == 2:
                pages.append(subparts[1].strip())
            else:
                pages.append(part.strip())

        if not pages:
            pages = [ocr_text.strip()]

        # Process each page in the chunk
        for page_idx, page_text in enumerate(pages, start=1):
            if not page_text.strip():
                continue

            # Claude Extraction
            extraction = execute_with_backoff(
                "Claude Data Extraction",
                lambda m: logger.warning(m),
                extract_ward_data,
                page_text
            )
            if "error" in extraction:
                raise Exception(extraction["error"])

            ward = extraction.get("ward")
            columns = extraction.get("columns", [])
            rows = extraction.get("rows", [])

            if ward:
                current_ward = ward

            if not rows:
                logger.info(f"No rows extracted on page {page_idx} of chunk {original_name}.")
                continue

            # Sync to Google Sheets (including a blank separator row at the end)
            rows_to_sync = rows + [{col: "" for col in columns}]
            rows_written = execute_with_backoff(
                "Google Sheets Sync",
                lambda m: logger.warning(m),
                sync_to_sheets,
                current_ward or "Unknown",
                columns,
                rows_to_sync
            )
            total_rows_written += rows_written

            all_rows.extend(rows)
            for col in columns:
                all_columns.add(col)

        # Save chunk result to result_{chunk_index}.json
        chunk_result = {
            "chunk_index": chunk_index,
            "ward": str(current_ward or "Unknown"),
            "columns": list(all_columns),
            "rows": all_rows,
            "rows_written": total_rows_written
        }
        result_path = session_dir / f"result_{chunk_index}.json"
        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(chunk_result, f, ensure_ascii=False, indent=2)

        # Cleanup chunk files
        delete_file(str(page_path))
        if processed_path:
            delete_file(processed_path)

        return chunk_result

    except Exception as e:
        logger.error(f"Error processing chunk {chunk_index} ({original_name}): {e}")
        # Clean up chunk files even on error
        delete_file(str(page_path))
        if processed_path:
            delete_file(processed_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-ward/finalize/")
async def finalize_upload(req: FinalizeRequest):
    submission_id = req.submission_id
    status = req.status

    logger.info(f"Finalizing upload {submission_id} with status {status}")

    session_dir = Path("uploads") / submission_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Submission session not found.")

    # Read all result_*.json files
    all_rows = []
    all_columns = set()
    total_rows_written = 0
    final_ward = None

    # Sort files by chunk index to keep rows in order
    result_files = sorted(session_dir.glob("result_*.json"), key=lambda p: int(p.stem.split("_")[1]))

    for res_path in result_files:
        try:
            with open(res_path, "r", encoding="utf-8") as f:
                res_data = json.load(f)
                
            ward = res_data.get("ward")
            if ward and ward != "Unknown":
                final_ward = ward
                
            total_rows_written += res_data.get("rows_written", 0)
            all_rows.extend(res_data.get("rows", []))
            for col in res_data.get("columns", []):
                all_columns.add(col)
        except Exception as e:
            logger.warning(f"Error reading result file {res_path.name}: {e}")

    # Save to history file
    final_columns = list(all_columns)
    entry = {
        "submission_id": submission_id,
        "ward": str(final_ward or "Multiple"),
        "rows_written": total_rows_written,
        "columns": final_columns,
        "rows": all_rows,
        "created_at": datetime.utcnow().isoformat(),
        "status": status
    }
    
    # Save submission (flat JSON history file)
    try:
        save_submission(entry)
    except Exception as e:
        logger.error(f"Failed to save submission history: {e}")

    # Remove the session directory and all its files
    try:
        shutil.rmtree(session_dir)
    except Exception as e:
        logger.error(f"Failed to clean up session directory {session_dir}: {e}")

    return {
        "status": status,
        "submission_id": submission_id,
        "ward": str(final_ward or "Multiple"),
        "columns": final_columns,
        "rows_written": total_rows_written,
        "rows": all_rows
    }

