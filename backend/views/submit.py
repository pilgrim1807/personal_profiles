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
    photo: UploadFile = File(None),              # зарезервировано
    photos: List[UploadFile] = File(default=[]), # зарезервировано
):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        # 1️⃣ Парсим ответы
        parsed = json.loads(answers)

        if not isinstance(parsed, list):
            raise ValueError("Поле 'answers' должно быть массивом")

        for i, item in enumerate(parsed):
            if not isinstance(item, dict):
                raise ValueError(f"Ответ #{i + 1} не объект")
            if "question" not in item or "answer" not in item:
                raise ValueError(f"Ответ #{i + 1} должен содержать question и answer")

        logger.info(f"📩 ▶️ SUBMIT от {username}, {len(parsed)} ответов")

        # 2️⃣ Приводим ответы к русскому виду
        for item in parsed:
            raw = str(item.get("answer", "")).strip().lower()

            if raw == "yes":
                item["answer"] = "Да"
            elif raw == "no" or raw == "":
                item["answer"] = "Нет"
            else:
                item["answer"] = item.get("answer", "").strip()

        # 3️⃣ Сохраняем в SQLite (ВСЕГДА)
        save_answers_to_db(username, parsed, now)

        # 4️⃣ Пытаемся сохранить в Google Sheets (НЕ БЛОКИРУЕТ)
        try:
            ws = get_sheet_first_tab()
            if ws:
                for item in parsed:
                    ws.append_row(
                        [
                            item["question"],  # Вопрос
                            item["answer"],    # Ответ (Да / Нет / текст)
                            username,          # Кто
                            now,               # Когда
                        ],
                        value_input_option="USER_ENTERED",
                    )
                logger.info("✅ Ответы записаны в Google Sheets")
        except Exception:
            logger.warning("⚠️ Google Sheets недоступен, ответы сохранены только в БД")

        # 5️⃣ Отдаём ответ сразу (без ожидания Sheets)
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
