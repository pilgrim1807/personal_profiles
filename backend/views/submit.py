import json
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Form, File, UploadFile, HTTPException
from backend.db.b_utils import save_answers_to_db
from backend.config import DB_PATH
print(f"📂 DB_PATH answers: {DB_PATH}")

from backend.utils.sheets_utils import (
    get_sheet_first_tab,
    find_next_available_column,
    rowcol_to_a1,
    safe_batch_update
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/submit")
async def submit_answers(
    username: str = Form(...),
    answers: str = Form(...),
    photo: UploadFile = File(None),
    photos: List[UploadFile] = File(default=[]),
):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        parsed = json.loads(answers)

        if not isinstance(parsed, list):
            raise ValueError("Поле 'answers' должно быть массивом")

        for i, item in enumerate(parsed):
            if not isinstance(item, dict):
                raise ValueError(f"Ответ #{i+1} не объект")
            if "question" not in item or "answer" not in item:
                raise ValueError(f"Ответ #{i+1} должен содержать question и answer")

        logger.info(f"📩 ▶️ SUBMIT от {username}, {len(parsed)} ответов")

        # 1️⃣ SQLite
        save_answers_to_db(username, parsed, now)

        # 2️⃣ Google Sheets — ТЕСТ
        ws = get_sheet_first_tab()
        if not ws:
            raise RuntimeError("Google Sheets недоступен")

        ws.append_row(
            [username, now] + [item.get("answer", "") for item in parsed],
            value_input_option="USER_ENTERED"
        )

        logger.info("✅ TEST: append_row сработал")

        return {
            "status": "ok",
            "saved_count": len(parsed),
            "sheets_ok": True,
        }

    except Exception as e:
        logger.exception("❌ Ошибка при сохранении")
        raise HTTPException(status_code=500, detail=str(e))
