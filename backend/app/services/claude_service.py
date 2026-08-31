from app.config import anthropic_client
import json
import logging

logger = logging.getLogger(__name__)

DEPARTMENTS = [
        {"department": "Accounts & Audit Branch", "description": "Manages municipal funds, financial audits, annual budgets, and expense approvals."},
        {"department": "Advertisement Branch", "description": "Regulates outdoor hoarding spaces, commercial banners, and collects public advertisement taxes."},
        {"department": "AMRUT Cell Branch", "description": "Implements centrally funded infrastructure upgrades for water supply and sewerage networks."},
        {"department": "Building & Roads (B&R) Branch", "description": "Constructs, paves, and maintains public roads, bridges, and municipal buildings."},
        {"department": "Computerization Branch", "description": "Maintains digital infrastructure, the official portal, and online citizen services."},
        {"department": "Complaints & Enquiry Branch", "description": "Receives public grievances, logs citizen feedback, and tracks resolution progress."},
        {"department": "Drawing Branch", "description": "Prepares structural blueprints, engineering layouts, and mapping for civic projects."},
        {"department": "Estate & Property Branch", "description": "Oversees corporation-owned land, handles properties on lease, and collects rent."},
        {"department": "Establishment Branch", "description": "Handles internal human resources, payroll, transfers, and municipal staff administration."},
        {"department": "Fire Brigade Branch", "description": "Provides emergency firefighting services, disaster rescue, and issues fire safety certificates."},
        {"department": "Health & Sanitation Branch", "description": "Manages daily city garbage collection, street sweeping, and vector control drives."},
        {"department": "Horticulture Branch", "description": "Develops and maintains public parks, green belts, and city landscaping."},
        {"department": "House Tax / Property Tax Branch", "description": "Assesses property values, processes yearly evaluations, and collects property taxes."},
        {"department": "Land & Tehbazari Branch", "description": "Removes illegal street encroachments and regulates public vending zones."},
        {"department": "Legal Branch", "description": "Handles court cases, statutory compliance, and legal drafting for the corporation."},
        {"department": "Licensing Branch", "description": "Issues and renews trade licenses for businesses operating within city limits."},
        {"department": "Lights / Electrical Branch", "description": "Installs and repairs public streetlights, timers, and high-mast lights."},
        {"department": "Operations & Maintenance (O&M) Branch", "description": "Operates tubewells, maintains drinking water supply, and clears sewage systems."},
        {"department": "Projects Division Branch", "description": "Plans and monitors large-scale urban development schemes across the city."},
        {"department": "Slum Clearance Branch", "description": "Works on rehabilitation programs and basic service provisioning for slum areas."},
        {"department": "Town Planning / Building Branch", "description": "Enforces building bylaws, demolishes illegal structures, and approves building plans."},
        {"department": "Workshop Branch", "description": "Services, repairs, and maintains the fleet of municipal vehicles and machinery."}
    ]

CATEGORIES = [
    {"category": "Grievance", "description": "Citizen or staff complaints requiring resolution"},
    {"category": "Service Request", "description": "Requests for a specific municipal service (water, sanitation, lighting etc.)"},
    {"category": "Development & Infrastructure", "description": "Roads, buildings, sewerage, construction proposals"},
    {"category": "Financial & Budgetary", "description": "Fund allocation, expense approvals, audit matters"},
    {"category": "Legal & Compliance", "description": "Court notices, statutory obligations, violations"},
    {"category": "Administrative & HR", "description": "Transfers, appointments, internal staff matters"},
    {"category": "Licensing & Permits", "description": "Trade licenses, building approvals, NOCs"},
    {"category": "Public Health & Sanitation", "description": "Disease control, waste management, sanitation drives"},
    {"category": "Property & Estate", "description": "Land records, encroachment, property tax matters"},
    {"category": "General Correspondence", "description": "Anything that doesn't fit above"}
]


def process_document(ocr_output: str, continuation: bool = False) -> dict:
    """
    Extract structured fields from OCR text using Claude.

    Args:
        ocr_output:   The OCR text (may include metadata prefix with ward/employability).
        continuation: If True, this is a subsequent chunk — only extract summary
                      and any fields missing from earlier chunks.
    """

    if anthropic_client is None:
        logger.error("Anthropic client is not configured.")
        return {"error": "Anthropic client is not configured."}

    if continuation:
        prompt = f"""You are a language expert fluent in Hindi, Punjabi, and English processing a CONTINUATION CHUNK of a larger municipal document.

The beginning of the document was already processed. Your job for this chunk is:
1. Extract ONLY the fields listed below if they appear in THIS chunk and were likely missing from the first chunk.
2. Write a SUMMARY of the content in this chunk as flowing prose (3-5 sentences). This will be appended to the earlier summary.

DOCUMENT METADATA (if present at top, use for ward_number and employability_status):
- Ward Number: extract from "Ward Number:" line if present
- Employability Status: extract from "Employability Status:" line if present

FIELDS TO EXTRACT (only if found in this chunk):
- ward_number: from metadata header or document text
- employability_status: from metadata header or document text
- summary: summary of THIS chunk's content only
- sender_name: if not likely captured already
- sender_contact: phone or email if present
- receiver: if not likely captured already
- reference_number: if present
- date: if present and not captured already

RULES:
- Return null for any field not clearly present in this chunk
- Return only a valid JSON object, no explanation, no markdown fences

DOCUMENT CHUNK:
{ocr_output}

Return this JSON structure:
{{
    "date": null,
    "summary": "",
    "sender_name": null,
    "sender_contact": null,
    "receiver": null,
    "reference_number": null,
    "ward_number": null,
    "employability_status": null
}}"""
    else:
        prompt = f"""You are a language expert fluent in Hindi, Punjabi, and English with deep experience in translating official municipal documents.

Your job is to translate the document text below into English, preserving the original meaning and context. Then extract the following fields from the translated content.

IMPORTANT: The document may begin with a METADATA block like:
===== DOCUMENT METADATA (provided by operator) =====
Ward Number: <value>
Employability Status: <value>
===== END METADATA =====

Always extract ward_number and employability_status from this metadata block if present. If the values also appear in the document body, prefer the metadata block values.

DEPARTMENTS LIST:
{DEPARTMENTS}

CATEGORIES LIST:
{CATEGORIES}

FIELDS TO EXTRACT:
- date: the date the document was published or written
- subject: the topic or reason for this letter
- summary: a concise 3-5 line prose summary of the document body only.
            Do not repeat the date, sender name, receiver, or subject — those are captured separately.
            Focus on the core issue, context, and what action is being requested.
            Write as flowing prose, not numbered points or bullet points.
- department: the MCL department this document belongs to, chosen strictly from the DEPARTMENTS LIST above
- category: the type of document, chosen strictly from the CATEGORIES LIST above
- sender_name: full name of the sender
- sender_contact: phone or email of the sender if mentioned, otherwise null
- receiver: full name or designation of the receiver
- reference_number: the document reference number if present, otherwise null
- ward_number: ward number from the metadata block or document text, otherwise null
- employability_status: employability status from the metadata block or document text, otherwise null

RULES:
- If a field is not found in the document after careful reading, return null for that field
- Do not invent or guess any information
- Department must be chosen from the provided list only. If no match found, return null
- Category must be chosen from the provided list only. If no match found, return null
- Return only a valid JSON object, no explanation, no extra text, no markdown code fences

DOCUMENT TEXT:
{ocr_output}

Return this exact JSON structure:
{{
    "date": "",
    "subject": "",
    "summary": "",
    "department": "",
    "category": "",
    "sender_name": "",
    "sender_contact": null,
    "receiver": "",
    "reference_number": null,
    "ward_number": null,
    "employability_status": null
}}"""

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text
    logger.info(f"Claude raw response:\n{raw}")

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        llm_output = json.loads(cleaned)
        logger.info(f"Claude parsed output: {llm_output}")
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} | Raw: {raw}")
        llm_output = {"error": "Unable to parse Claude response as JSON.", "raw": raw}

    return llm_output
