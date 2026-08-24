import json
import os
from datetime import datetime
from pathlib import Path

HISTORY_FILE = Path("data/history.json")

def _ensure_history_file():
    # Ensure data directory exists
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not HISTORY_FILE.exists():
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)

def save_submission(entry: dict) -> None:
    """
    Appends a new submission entry to the flat history JSON array.
    """
    _ensure_history_file()
    try:
        with open(HISTORY_FILE, "r+", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = []
            
            # Append the entry
            data.append(entry)
            
            # Rewrite from start
            f.seek(0)
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.truncate()
    except Exception as e:
        print(f"Error saving to history file: {e}")

def get_history(limit: int = 20) -> list:
    """
    Reads the history file and returns the last N entries reversed (newest first).
    """
    if not HISTORY_FILE.exists():
        return []
    
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, list):
                return []
            # Return last N entries, reversed
            return list(reversed(data))[:limit]
    except Exception as e:
        print(f"Error reading history file: {e}")
        return []
