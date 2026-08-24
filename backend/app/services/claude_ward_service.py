import json
import logging
from app.config import anthropic_client

logger = logging.getLogger(__name__)

def extract_ward_data(ocr_text: str) -> dict:
    """
    Uses Anthropic Claude API to extract structured ward data from OCR text.
    """
    if anthropic_client is None:
        logger.error("Anthropic client is not configured.")
        return {"error": "Anthropic client is not configured."}

    system_prompt = (
        "You are extracting data from a municipal ward document from Ludhiana, India.\n"
        "The document is in Punjabi/Gurmukhi script mixed with some English/Hindi.\n\n"
        "CRITICAL RULE: You must translate ALL Gurmukhi/Punjabi text into English.\n"
        "DO NOT output raw Gurmukhi characters in any row cells. Everything must be fully translated.\n\n"
        "Extract:\n"
        "1. Ward number — Look at the top of the document (printed or handwritten with a pen, e.g. 'ਵਾਰਡ ਨੰਬਰ 66' or 'Ward 93').\n"
        "   If the document does not have a clear ward number at the top, or if this is a continuation page without a header, return null.\n"
        "   CRITICAL: DO NOT extract or guess ward numbers from handwritten signatures, stamps, dates, or notes at the bottom of the page (e.g., ignore 'S.S', '5.5', 'C.S.I', or '20/8/26' as ward numbers).\n"
        "2. All table rows as a JSON array. Each row must use EXACTLY the following 7 keys (standardized columns):\n"
        "   - \"Serial Number\" (derived from 'ਲੜੀ ਨੰ:')\n"
        "   - \"Name\" (derived from 'ਨਾਮ' or name of worker)\n"
        "   - \"Father/Husband Name\" (derived from 'ਪਿਤਾ/ਪਤੀ')\n"
        "   - \"Beat\" (derived from 'ਮੁਲਾਜ਼ਮ ਦੀ ਬੀਟ' or beat/area)\n"
        "   - \"Address\" (derived from 'ਮੁਲਾਜ਼ਮ ਦੇ ਘਰ ਦਾ ਪਤਾ' or address)\n"
        "   - \"Employability Status\" (derived from 'ਪੱਕਾ/ਕੱਚਾ' or status column. If the status column is missing on a page, look at the page header/title text to infer status. For example, if the header contains 'ਪੱਕੇ ਸਫਾਈ ਕਰਮਚਾਰੀਆਂ' or 'ਪੱਕੇ', set status to 'Permanent'; if the header contains 'ਸੈਕਸ਼ਨ' or 'ਸੈਕਸ਼ਨ ਵਾਲੇ' (transliterated Sectioned/Sanctioned), set status to 'Sanctioned'; if the header contains 'ਡੀ.ਸੀ. ਰੇਟ' or 'ਡੀਸੀ ਰੇਟ', set status to 'DC Rate'; if the header contains 'ਆਊਟ ਸੋਰਸ', set status to 'Outsourced' for all rows on that page).\n"
        "   - \"Mobile Number\" (derived from 'ਮੋਬਾਇਲ ਨੰਬਰ' or contact number)\n\n"
        "Mapping & Translation Rules:\n"
        "- You MUST map the Gurmukhi/Punjabi columns to these exact 7 English keys.\n"
        "- Do not create any other keys or columns. This prevents duplicate columns.\n"
        "- Translate all Gurmukhi values to English (e.g., translate 'ਡੀ.ਸੀ ਰੇਟ' to 'DC Rate', 'ਪੱਕਾ' to 'Permanent', 'ਕੱਚਾ' to 'Temporary', names, addresses, etc.).\n"
        "- If a cell is empty or does not exist for a row, set its value to null.\n\n"
        "Return ONLY valid JSON, no explanation, no markdown, no backticks:\n"
        "{\n"
        "  \"ward\": \"<number as string, or null>\",\n"
        "  \"columns\": [\n"
        "    \"Serial Number\",\n"
        "    \"Name\",\n"
        "    \"Father/Husband Name\",\n"
        "    \"Beat\",\n"
        "    \"Address\",\n"
        "    \"Employability Status\",\n"
        "    \"Mobile Number\"\n"
        "  ],\n"
        "  \"rows\": [\n"
        "    {\n"
        "      \"Serial Number\": \"...\",\n"
        "      \"Name\": \"...\",\n"
        "      \"Father/Husband Name\": \"...\",\n"
        "      \"Beat\": \"...\",\n"
        "      \"Address\": \"...\",\n"
        "      \"Employability Status\": \"...\",\n"
        "      \"Mobile Number\": \"...\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )

    prompt = f"DOCUMENT TEXT:\n{ocr_text}"

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}]
        )
        
        raw_text = response.content[0].text.strip()
        logger.info(f"Claude raw response:\n{raw_text}")
        
        # Clean response if markdown blocks are returned
        cleaned = raw_text
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
            
        result = json.loads(cleaned)
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from Claude response: {e}")
        return {"error": "Invalid JSON response from Claude.", "raw": raw_text}
    except Exception as e:
        logger.error(f"Error calling Claude: {e}")
        return {"error": f"Claude extraction failed: {str(e)}"}
