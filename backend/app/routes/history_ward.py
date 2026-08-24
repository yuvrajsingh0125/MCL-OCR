from fastapi import APIRouter
from app.services.history_service import get_history

router = APIRouter()

@router.get("/history-ward/")
def get_ward_history():
    """
    Returns the latest 20 ward processing history entries, newest first.
    """
    return get_history(limit=20)
