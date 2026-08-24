from asyncio.log import logger
import logging
from pathlib import Path
import base64
import os 

from dotenv import load_dotenv
from mistralai.client import Mistral

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

api_key = os.environ["MISTRAL_API_KEY"]
client = Mistral(api_key=api_key)

def mistral_process_ocr(file_path: Path)-> dict:    

    source = Path(file_path)
    
    # -----------------------------------
    # 1. validate input file
    # -----------------------------------
    if not source.exists():
        raise FileNotFoundError(
            f"File not found: {source}"
        )

    if not source.is_file():
        raise ValueError(
            f"Provide OCR Path is not a file: {source}"
        )

    def encode_file(file_path: Path) -> str:
        with file_path.open("rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")

    base64_file = encode_file(source)
    
    suffix = source.suffix.lower()
    if suffix == ".pdf":
        mime_type = "application/pdf"
        doc_payload = {
            "type": "document_url",
            "document_url": f"data:{mime_type};base64,{base64_file}"
        }
    else:
        MIME_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
        mime_type = MIME_TYPES.get(suffix, "image/jpeg")
        doc_payload = {
            "type": "image_url",
            "image_url": f"data:{mime_type};base64,{base64_file}"
        }

    ocr_response = client.ocr.process(
        document=doc_payload,
        model="mistral-ocr-latest",
    )#     document_annotation_format=ResponseFormat(
	# 	type="json_schema",
	# 	json_schema=JSONSchema(
	# 		name="response_schema",
	# 		schema_definition={
	# 			"type": "object",
	# 			"required": [
	# 				"document_metadata",
	# 				"letter_details"
	# 			],
	# 			"properties": {
	# 				"letter_details": {
	# 					"type": "object",
	# 					"required": [
	# 						"recipient",
	# 						"subject",
	# 						"date",
	# 						"body",
	# 						"signatories"
	# 					],
	# 					"properties": {
	# 						"date": {
	# 							"type": "string"
	# 						},
	# 						"subject": {
	# 							"type": "string"
	# 						},
	# 						"summary": {
	# 							"type": "string"
	# 						},
    #                         "department": {
    #                             "type": "string"
    #                         },
    #                         "sender_name": {
    #                             "type": "string"
    #                         },
    #                         "signatories": {
    #                             "type": "string"
    #                         },
    #                         "body_paragraphs": {
    #                             "type": "string"
    #                         }
	# 					}
	# 				}
	# 			}
	# 		},
	# 		strict=True,
	# 	),
	# ),
	# include_blocks=True
	# )

    pages_markdown = []
    for page_idx, page in enumerate(ocr_response.pages):
        pages_markdown.append(f"===== PAGE {page_idx + 1} =====\n{page.markdown}")
        
    combined_markdown = "\n\n".join(pages_markdown)
    logger = logging.getLogger(__name__)
    logger.info(f"Mistral OCR combined output:\n{combined_markdown}")
    return {
        "text": combined_markdown
    }