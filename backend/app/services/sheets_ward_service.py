import httpx
import logging
from app.config import SHEETS_WARD_WEBHOOK_URL, SHEETS_WARD_SECRET

logger = logging.getLogger(__name__)

def sync_to_sheets(ward: str, columns: list, rows: list) -> int:
    """
    Syncs ward data to Google Sheets via GAS Webhook.
    Returns the number of rows written.
    Raises Exception if sync fails.
    """
    if not SHEETS_WARD_WEBHOOK_URL:
        raise ValueError("SHEETS_WARD_WEBHOOK_URL is not configured in the environment.")
    
    payload = {
        "secret": SHEETS_WARD_SECRET,
        "ward": str(ward),
        "columns": columns,
        "rows": rows
    }
    
    logger.info(f"Syncing to Sheets for Ward {ward} with {len(rows)} rows.")
    
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            response = client.post(SHEETS_WARD_WEBHOOK_URL, json=payload)
            
        if response.status_code != 200:
            raise Exception(f"HTTP error {response.status_code}: {response.text}")
            
        res_data = response.json()
        if res_data.get("status") != "success":
            raise Exception(f"GAS webhook returned error status: {res_data}")
            
        rows_written = res_data.get("rows_written", len(rows))
        logger.info(f"Sync completed successfully. Rows written: {rows_written}")
        return rows_written
        
    except Exception as e:
        logger.error(f"Failed to sync to Google Sheets: {e}")
        raise e
