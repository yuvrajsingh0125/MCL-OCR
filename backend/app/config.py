import os

<<<<<<< HEAD
=======
from dotenv import load_dotenv

>>>>>>> c728c2079154a0934e29b17955cfa132b21c3d8b
try:
    import anthropic
except ImportError:
    anthropic = None

try:
    from google import genai
except ImportError:
    genai = None


load_dotenv()


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = None
if genai and GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

<<<<<<< HEAD
=======

>>>>>>> c728c2079154a0934e29b17955cfa132b21c3d8b
# ==========================
# Anthropic Claude
# ==========================

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
anthropic_client = None
if anthropic and ANTHROPIC_API_KEY:
    anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
<<<<<<< HEAD
=======

>>>>>>> c728c2079154a0934e29b17955cfa132b21c3d8b

# ==========================
# Supabase
# ==========================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


# ==========================
# Google Sheets & Drive
# ==========================

GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
<<<<<<< HEAD
=======


# ==========================
# Google Apps Script Sheets
# ==========================

SHEETS_WEBHOOK_URL = os.getenv("SHEETS_WEBHOOK_URL")
SHEETS_SECRET = os.getenv("SHEETS_SECRET")
>>>>>>> c728c2079154a0934e29b17955cfa132b21c3d8b
