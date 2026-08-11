from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router as health_router
from app.routes.upload import router as upload_router
from app.config import SHEETS_WEBHOOK_URL, SHEETS_SECRET
from app.services.sheets_service import init_sheets
import logging

if SHEETS_WEBHOOK_URL and SHEETS_SECRET:
    init_sheets(SHEETS_WEBHOOK_URL, SHEETS_SECRET)


logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://mcl-ocr.vercel.app",
        "https://mcl-ocr.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(upload_router)