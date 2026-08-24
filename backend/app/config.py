import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ==========================
# Mistral OCR
# ==========================
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

try:
    from mistralai.client import Mistral
    mistral_client = Mistral(api_key=MISTRAL_API_KEY) if MISTRAL_API_KEY else None
except ImportError:
    mistral_client = None

# ==========================
# Anthropic Claude
# ==========================
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

try:
    import anthropic
    anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
except ImportError:
    anthropic_client = None

# ==========================
# Google Apps Script Ward Sheets
# ==========================
SHEETS_WARD_WEBHOOK_URL = os.getenv("SHEETS_WARD_WEBHOOK_URL")
SHEETS_WARD_SECRET = os.getenv("SHEETS_WARD_SECRET")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173")

# Execution Limits
MAX_PDF_PAGES_LIMIT = 100
