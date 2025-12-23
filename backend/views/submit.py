import json
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Form, File, UploadFile, HTTPException

from backend.db.b_utils import save_answers_to_db
from backend.utils.sheets_utils import get_sheet_first_tab

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/submit")
async def submit_answers(
    username: str = Form(...),
    answers: str = Form(...),
    photo: UploadFile = File(None),   # зарезервировано
    photos: List[UploadFile] = File(default=[]),  # зарезервировано
):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        # --- Парсим ответы ---
        parsed = json.loads(answers)

        if not isinstance(parsed, list):
            raise ValueError("Поле 'answers' должно быть массивом")

        for i, item in enumerate(parsed):
            if not isinstance(item, dict):
                raise ValueError(f"Ответ #{i + 1} не объект")
            if "question" not in item or "answer" not in item:
                raise ValueError(f"Ответ #{i + 1} должен содержать question и answer")

        logger.info(f"📩 ▶️ SUBMIT от {username}, {len(parsed)} ответов")

        # --- Перевод ответов на русский ---
        for item in parsed:
            raw_answer = str(item.get("answer", "")).strip().lower()

            if raw_answer == "yes":
                item["answer"] = "Да"
            elif raw_answer == "no" or raw_answer == "":
                item["answer"] = "Нет"
            else:
                item["answer"] = item.get("answer", "").strip()

        # --- 1️⃣ Сохраняем в SQLite ---
        save_answers_to_db(username, parsed, now)

        # --- 2️⃣ Сохраняем в Google Sheets (ВЕРТИКАЛЬНО) ---
        ws = get_sheet_first_tab()
        if not ws:
            raise RuntimeError("Google Sheets недоступен")

        for item in parsed:
            ws.append_row(
                [
                    item["question"],  # Вопрос
                    item["answer"],    # Ответ (Да / Нет / текст)
                    username,
                    now,
                ],
                value_input_option="USER_ENTERED",
            )

        logger.info("✅ Ответы успешно записаны в Google Sheets")

        return {
            "status": "ok",
            "saved_count": len(parsed),
            "sheets_ok": True,
        }

    except Exception as e:
        logger.exception("❌ Ошибка при сохранении ответов")
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )
