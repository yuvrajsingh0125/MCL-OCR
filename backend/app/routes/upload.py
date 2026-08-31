from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import logging
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional

from app.services.opencv_services import process_image
from app.services.mistral_ocr_services import mistral_process_ocr
from app.services.claude_service import process_document
from app.services.sheets_service import push_to_sheets
from app.utils.file_utils import save_uploaded_file, delete_file
from app.services.supabase_service import insert_data, update_status

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/upload",
    tags=["Upload"],
)

# Max characters to send to Claude in a single request
CLAUDE_CHUNK_CHARS = 40_000


@router.post("/")
async def upload_images(
    files: list[UploadFile] = File(...),
    ward_number: Optional[str] = Form(None),
    employability_status: Optional[str] = Form(None),
):

    if not files:
        raise HTTPException(
            status_code=400,
            detail="No images were provided.",
        )

    submission_id = str(uuid4())

    logger.info(
        "Starting document submission %s with %d image(s) | Ward: %s | Employability: %s",
        submission_id,
        len(files),
        ward_number,
        employability_status,
    )

    image_items = []

    for index, file in enumerate(files, start=1):

        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail=f"Image {index} does not have a filename.",
            )

        logger.info(
            "[%s] Processing page %d/%d: %s",
            submission_id,
            index,
            len(files),
            file.filename,
        )

        saved_path = None
        processed_path = None

        try:
            saved_path = save_uploaded_file(file)
            processed_path = process_image(saved_path)
            ocr_result = mistral_process_ocr(processed_path)
            ocr_text = ocr_result.get("text", "")

            if not ocr_text:
                logger.warning(
                    "[%s] Page %d returned empty OCR text",
                    submission_id,
                    index,
                )

            delete_file(saved_path)
            delete_file(processed_path)

            image_items.append(
                {
                    "img_index": index,
                    "filename": file.filename,
                    "ocr_md": ocr_text,
                }
            )
        except HTTPException:
            raise

        except Exception as exc:
            if saved_path:
                delete_file(saved_path)
            if processed_path:
                delete_file(processed_path)

            logger.exception(
                "[%s] Failed while processing page %d: %s",
                submission_id,
                index,
                exc,
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Failed to process image "
                    f"{index} ({file.filename})."
                ),
            ) from exc

    page_sections = []
    for image in image_items:
        page_sections.append(
            "\n".join(
                [
                    f"===== BEGIN PAGE {image['img_index']} =====",
                    "",
                    image["ocr_md"],
                    "",
                    f"===== END PAGE {image['img_index']} =====",
                ]
            )
        )

    combined_ocr = "\n\n".join(page_sections)

    if not combined_ocr.strip():
        raise HTTPException(
            status_code=400,
            detail={"message": "All pages returned empty OCR text.", "status": "failed"}
        )

    # Build metadata prefix — prepended to every Claude chunk
    metadata_prefix = ""
    if ward_number or employability_status:
        parts = []
        if ward_number:
            parts.append(f"Ward Number: {ward_number}")
        if employability_status:
            parts.append(f"Employability Status: {employability_status}")
        metadata_prefix = (
            "===== DOCUMENT METADATA (provided by operator) =====\n"
            + "\n".join(parts)
            + "\n===== END METADATA =====\n\n"
        )

    logger.info(
        "[%s] Combined OCR length: %d chars | Metadata prefix: %d chars",
        submission_id,
        len(combined_ocr),
        len(metadata_prefix),
    )

    try:
        full_text = metadata_prefix + combined_ocr
        chunks = _split_into_chunks(full_text, metadata_prefix, CLAUDE_CHUNK_CHARS)

        logger.info(
            "[%s] Sending %d chunk(s) to Claude",
            submission_id,
            len(chunks),
        )

        if len(chunks) == 1:
            llm_result = process_document(chunks[0])
        else:
            llm_result = process_document_chunked(chunks, submission_id)

        if not llm_result:
            raise HTTPException(
                status_code=422,
                detail={"message": "Failed to extract subject or summary.", "status": "failed"}
            )

        if not llm_result.get("subject") or not llm_result.get("summary"):
            raise HTTPException(
                status_code=422,
                detail={"message": "Failed to extract data.", "status": "failed"}
            )

        # Inject ward/employability if Claude missed them
        if ward_number and not llm_result.get("ward_number"):
            llm_result["ward_number"] = ward_number
        if employability_status and not llm_result.get("employability_status"):
            llm_result["employability_status"] = employability_status

        logger.info("[%s] LLM extraction complete", submission_id)

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("[%s] LLM processing failed: %s", submission_id, exc)
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to extract structured document data.", "status": "failed"},
        ) from exc

    fields = ["date", "department", "sender_name", "sender_contact", "receiver", "reference_number"]
    for field in fields:
        if not llm_result.get(field):
            llm_result[field] = "N/A"

    try:
        serial_number = insert_data(llm_result)
    except Exception as exc:
        logger.exception("[%s] Failed to insert data into database: %s", submission_id, exc)
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to insert data into database.", "status": "failed"},
        ) from exc

    try:
        sheets_filename = (
            files[0].filename if len(files) == 1 else f"submission_{submission_id}"
        )
        await push_to_sheets(llm_result, sheets_filename, serial_number)
        logger.info("[%s] Google Sheets sync complete", submission_id)
    except Exception as exc:
        logger.exception("[%s] Google Sheets sync failed: %s", submission_id, exc)
        raise HTTPException(
            status_code=500,
            detail="Document processed but Google Sheets sync failed.",
        ) from exc

    try:
        update_status(serial_number, "complete")
        logger.info("[%s] Status updated to complete", submission_id)
    except Exception as exc:
        logger.exception("[%s] Failed to update status: %s", submission_id, exc)
        raise HTTPException(
            status_code=500,
            detail={"message": "Document processed but status update failed.", "status": "failed"},
        ) from exc

    return {
        "serial_number": serial_number,
        "message": "Document processed successfully",
        "submission_id": submission_id,
        "status": "complete",
        "file_count": len(image_items),
        "files": [image["filename"] for image in image_items],
        "images": image_items,
        "extracted_data": llm_result,
    }


def _split_into_chunks(full_text: str, metadata_prefix: str, max_chars: int) -> list[str]:
    """
    Split OCR text into chunks that fit within max_chars.
    Metadata prefix is prepended to every chunk.
    Splits only at page boundaries to avoid cutting mid-page.
    """
    if len(full_text) <= max_chars:
        return [full_text]

    body = full_text[len(metadata_prefix):]
    pages = body.split("===== BEGIN PAGE ")
    pages = [("===== BEGIN PAGE " + p) for p in pages if p.strip()]

    chunks = []
    current_chunk_pages = []
    current_len = len(metadata_prefix)

    for page in pages:
        page_len = len(page)
        if current_len + page_len > max_chars and current_chunk_pages:
            chunks.append(metadata_prefix + "\n\n".join(current_chunk_pages))
            current_chunk_pages = [page]
            current_len = len(metadata_prefix) + page_len
        else:
            current_chunk_pages.append(page)
            current_len += page_len

    if current_chunk_pages:
        chunks.append(metadata_prefix + "\n\n".join(current_chunk_pages))

    return chunks if chunks else [full_text]


def process_document_chunked(chunks: list[str], submission_id: str) -> dict:
    """
    Process multiple OCR chunks through Claude and merge results.
    First chunk gets full extraction. Subsequent chunks extend summary
    and fill in any null fields.
    """
    from app.services.claude_service import process_document

    logger.info(
        "[%s] Processing %d chunks sequentially",
        submission_id,
        len(chunks),
    )

    merged = process_document(chunks[0])
    if not merged:
        return {}

    all_summaries = [merged.get("summary", "")]

    for i, chunk in enumerate(chunks[1:], start=2):
        logger.info("[%s] Processing chunk %d/%d", submission_id, i, len(chunks))
        chunk_result = process_document(chunk, continuation=True)
        if chunk_result and chunk_result.get("summary"):
            all_summaries.append(chunk_result["summary"])

        for field in ["date", "sender_name", "sender_contact", "receiver",
                       "reference_number", "department", "category",
                       "ward_number", "employability_status"]:
            if not merged.get(field) and chunk_result.get(field):
                merged[field] = chunk_result[field]

    combined_summary = " ".join(s for s in all_summaries if s)
    if combined_summary:
        merged["summary"] = combined_summary

    return merged
